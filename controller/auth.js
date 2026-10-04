/**
 * Auth controller: signup, login, 2FA enrollment/verification, logout,
 * password reset (with email), 2FA enable/disable, and secret key generation.
 * Uses JWT for sessions and pending 2FA challenges, AES-256-GCM for sealing secrets.
 */
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../database/pool');
const transaction = require('../utiles/transaction');
const { loginSchema, userSchema } = require('../utiles/validation');
const { generateSecret, verifyToken, verifyTokenStep } = require('../utiles/authentcator2FA');
const { issueSession, issueChallenge, seal, unseal, options, dashboard } = require('../utiles/session');
const notifications = require('../utiles/notifications');
const HttpError = require('../utiles/httpError');
const mailer = require('../utiles/mailer');

/** SHA-256 hex digest helper. */
const digest = v => crypto.createHash('sha256').update(String(v)).digest('hex');

/** Truthy check for 2FA enrollment flags. */
const enabled = v => v === true || v === '1' || v === 'on';

/** Extracts secret from sealed cookie value. */
const readSecret = v => v && v.startsWith('sealed:') ? unseal(v.slice(7)).secret : v;

/** Reads and validates the 2FA enrollment cookie (expires in 10 min). */
function enrollment(req) {
    try {
        const value = unseal(req.cookies?.doq_enrolment);
        return value.expires > Date.now() ? value : null;
    } catch {
        return null;
    }
}

// ============================================
// 1. Generate 2FA Secret Key
// ============================================

/**
 * Generates a new TOTP secret and stores it in a short-lived sealed cookie (10 min).
 * Used before signup with 2FA enabled.
 * @param {Object} req - Express request.
 * @param {Object} res - Express response (sets doq_enrolment cookie).
 * @returns {Promise<void>} 200 with secretKey and otpauth_url.
 */
async function generateSecretKey_controller(req, res) {
    const secret = generateSecret();
    res.cookie('doq_enrolment', seal({ secret: secret.base32, expires: Date.now() + 600000 }), options(600000));
    res.set('Cache-Control', 'no-store');
    return res.json({ status: 'success', data: { secretKey: secret.base32, otpauth_url: secret.otpauth_url } });
}

// ============================================
// 2. Sign In
// ============================================

/**
 * Authenticates a user with email/password.
 * If 2FA enabled/required, issues a 10-min challenge cookie and redirects to /auth/signup2.
 * Otherwise issues full session cookie and redirects to role dashboard.
 * @param {Object} req - Body validated by loginSchema (email, password).
 * @param {Object} res - Express response.
 * @returns {Promise<void>} 200 with redirect, 400/401/403 on validation/auth/account status.
 */
async function signIn_controller(req, res) {
    const checked = loginSchema.validate(req.body);
    if (checked.error) return res.status(400).json({ message: 'اكتب الإيميل والباسورد صح' });

    const [[user]] = await pool.query('SELECT * FROM users WHERE email=? LIMIT 1', [checked.value.email]);
    if (!user || !(await bcrypt.compare(checked.value.password, user.password_hash))) {
        return res.status(401).json({ message: 'الإيميل أو الباسورد غلط' });
    }
    if (user.account_status !== 'approved') {
        return res.status(403).json({
            message: user.account_status === 'rejected'
                ? 'طلب الانضمام اترفض. تواصل مع الإدارة لو محتاج تفاصيل'
                : 'حسابك لسه في انتظار موافقة الإدارة'
        });
    }
    if (Number(user.two_factor_enabled) || Number(user.two_factor_required)) {
        await issueChallenge(res, user, Number(user.two_factor_enabled) ? 'login' : 'enroll');
        return res.json({ status: 'success', message: 'اكتب رمز تطبيق المصادقة', redirect: '/auth/signup2' });
    }
    issueSession(res, user);
    return res.json({ status: 'success', message: 'تم تسجيل الدخول', redirect: dashboard(user.roles) });
}

// ============================================
// 3. Sign Up
// ============================================

/**
 * Registers a new user (customer/chef/delivery).
 * Validates input via userSchema. Handles optional 2FA enrollment via sealed cookie.
 * Creates user with account_status: approved (customer) or pending (chef/delivery).
 * Notifies admins of pending accounts. Handles referral cookie if present.
 * @param {Object} req - Body validated by userSchema; cookies: doq_enrolment (2FA), doq_referral.
 * @param {Object} res - Express response.
 * @returns {Promise<void>} 201 with redirect, 400/409 on validation/conflict.
 */
async function signUp_controller(req, res) {
    const checked = userSchema.validate(req.body);
    if (checked.error) return res.status(400).json({ message: checked.error.details[0].message });

    const value = checked.value;
    const wants2fa = enabled(value.enable_2fa);
    const setup = wants2fa ? enrollment(req) : null;

    if (wants2fa && !setup) {
        return res.status(400).json({ message: 'كود الإعداد انتهى. اعمل كود جديد وجرب تاني' });
    }

    const [existing] = await pool.query('SELECT id FROM users WHERE email=? OR phone_number=? LIMIT 1', [value.email, value.phone_number]);
    if (existing.length) return res.status(409).json({ message: 'الإيميل أو رقم الموبايل مسجل قبل كده' });

    const passwordHash = await bcrypt.hash(value.password, 12);
    const role = value.roles;
    const status = role === 'customer' ? 'approved' : 'pending';
    const companyName = role === 'delivery' ? String(value.company_name || '').trim() : null;

    if (role === 'delivery' && (companyName.length < 2 || companyName.length > 120)) {
        return res.status(400).json({ message: 'اسم شركة الدليفري مطلوب' });
    }

    const user = await transaction(async db => {
        const [created] = await db.query(
            `INSERT INTO users
            (first_name,last_name,email,password_hash,phone_number,roles,company_name,city,address,two_factor_secret,two_factor_required,account_status)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
            [value.firstname, value.lastname, value.email, passwordHash, value.phone_number, role, companyName,
             value.city || null, value.address || null,
             setup ? 'sealed:' + seal({ secret: setup.secret }) : null,
             wants2fa ? 1 : 0, status]
        );
        if (status === 'pending') {
            await notifications.admins(db, 'account_pending', 'حساب جديد للمراجعة', 'طلب انضمام جديد من ' + (role === 'chef' ? 'مطبخ' : 'شركة دليفري'), 'user', created.insertId);
        }
        const referral = req.cookies?.doq_referral;
        if (referral && role === 'customer') {
            await db.query('INSERT IGNORE INTO referral_signups (customer_id,referral_id) SELECT ?,id FROM dish_referrals WHERE token=? AND referrer_id<>?', [created.insertId, referral, created.insertId]);
        }
        return { id: created.insertId, roles: role, session_version: 0, account_status: status };
    });

    res.clearCookie('doq_enrolment', { path: '/' });
    if (wants2fa) {
        await issueChallenge(res, user, 'enroll');
        return res.status(201).json({ status: 'success', message: 'اكتب رمز تطبيق المصادقة', redirect: '/auth/signup2' });
    }
    if (status === 'approved') issueSession(res, user);
    return res.status(201).json({
        status: 'success',
        message: status === 'pending' ? 'تم إرسال الحساب للمراجعة من الإدارة' : 'تم إنشاء الحساب',
        redirect: status === 'pending' ? '/auth?pending=1' : dashboard(role)
    });
}

// ============================================
// 4. Sign Up Step 2: Verify 2FA OTP
// ============================================

/**
 * Verifies the 2FA OTP from signup/enrollment challenge.
 * Validates challenge nonce, attempts limit, user session version, and OTP step replay protection.
 * On success: marks challenge consumed, enables 2FA, updates last_step, issues session if approved.
 * @param {Object} req - Body: otp (6 digits); cookie: pending_token (JWT with nonce).
 * @param {Object} res - Express response.
 * @returns {Promise<void>} 200 with redirect, 400/401 on invalid/expired/used OTP.
 */
async function signUp2_verify_controller(req, res) {
    if (!/^\d{6}$/.test(String(req.body.otp || ''))) return res.status(400).json({ message: 'اكتب كود من 6 أرقام' });
    let pending;
    try {
        pending = jwt.verify(req.cookies?.pending_token || '', process.env.JWT_SECRET, { algorithms: ['HS256'] });
    } catch {
        return res.status(401).json({ message: 'الجلسة انتهت. سجل دخول تاني' });
    }
    if (pending.type !== 'pending_2fa' || !pending.nonce) return res.status(401).json({ message: 'الجلسة انتهت. سجل دخول تاني' });

    const result = await transaction(async db => {
        const [[challenge]] = await db.query(
            'SELECT * FROM auth_challenges WHERE nonce_hash=? AND expires_at>UTC_TIMESTAMP() AND consumed_at IS NULL FOR UPDATE',
            [digest(pending.nonce)]
        );
        if (!challenge || challenge.attempts >= 5) return { error: 'الكود انتهى أو المحاولات خلصت. سجل دخول تاني' };

        const [[user]] = await db.query('SELECT * FROM users WHERE id=? FOR UPDATE', [pending.userId]);
        if (!user || Number(user.session_version) !== Number(pending.sv) || challenge.user_id !== user.id || challenge.purpose !== pending.purpose) {
            return { error: 'الجلسة مش صالحة. سجل دخول تاني' };
        }

        await db.query('UPDATE auth_challenges SET attempts=attempts+1 WHERE nonce_hash=?', [digest(pending.nonce)]);

        const verifiedStep = verifyTokenStep(readSecret(user.two_factor_secret), String(req.body.otp));
        if (verifiedStep === null || (user.two_factor_last_step !== null && user.two_factor_last_step !== undefined && verifiedStep <= Number(user.two_factor_last_step))) {
            return { error: 'الكود غلط أو اتستخدم قبل كده' };
        }

        await db.query('UPDATE auth_challenges SET consumed_at=UTC_TIMESTAMP() WHERE nonce_hash=?', [digest(pending.nonce)]);
        await db.query('UPDATE users SET two_factor_enabled=1,two_factor_required=1,two_factor_last_step=? WHERE id=?', [verifiedStep, user.id]);

        return { user };
    });

    if (result.error) return res.status(400).json({ message: result.error });
    res.clearCookie('pending_token', { path: '/' });
    if (result.user.account_status !== 'approved') {
        return res.json({ status: 'success', message: 'تم تفعيل المصادقة والحساب في انتظار موافقة الإدارة', redirect: '/auth?pending=1' });
    }
    issueSession(res, result.user);
    return res.json({ status: 'success', message: 'تم تسجيل الدخول', redirect: dashboard(result.user.roles) });
}

// ============================================
// 5. Logout
// ============================================

/**
 * Clears session and pending cookies.
 * @param {Object} req - Express request.
 * @param {Object} res - Express response.
 * @returns {Promise<void>} 200 with redirect to /auth.
 */
function logout_controller(req, res) {
    res.clearCookie('session_token', { path: '/' });
    res.clearCookie('pending_token', { path: '/' });
    return res.json({ status: 'success', redirect: '/auth' });
}

// ============================================
// 6. Change Password (authenticated)
// ============================================

/**
 * Changes password for authenticated user.
 * Requires current password; if 2FA enabled, requires valid OTP.
 * Increments session_version to invalidate other sessions.
 * @param {Object} req - Authenticated; body: current_password, new_password, confirm_password, otp (if 2FA).
 * @param {Object} res - Express response.
 * @returns {Promise<void>} 200 with redirect to /auth, 400 on validation/current password/OTP mismatch.
 */
async function resetPassword_controller(req, res) {
    const { current_password, new_password, confirm_password, otp } = req.body;
    if (typeof new_password !== 'string' || new_password.length < 8 || new_password.length > 72 || new_password !== confirm_password) {
        return res.status(400).json({ message: 'الباسورد الجديد لازم يكون 8 حروف على الأقل ومطابق للتأكيد' });
    }
    const [[user]] = await pool.query('SELECT * FROM users WHERE id=?', [req.user.id]);
    if (!user || !(await bcrypt.compare(String(current_password || ''), user.password_hash))) {
        return res.status(400).json({ message: 'الباسورد الحالي غلط' });
    }
    if (Number(user.two_factor_enabled) && !verifyToken(readSecret(user.two_factor_secret), String(otp || ''))) {
        return res.status(400).json({ message: 'كود المصادقة غلط' });
    }
    await pool.query('UPDATE users SET password_hash=?,session_version=session_version+1 WHERE id=?', [await bcrypt.hash(new_password, 12), user.id]);
    res.clearCookie('session_token', { path: '/' });
    return res.json({ status: 'success', message: 'تم تغيير كلمة المرور', redirect: '/auth' });
}

// ============================================
// 7. Forgot Password (email reset link)
// ============================================

/**
 * Initiates password reset by email.
 * Creates a 20-min token in password_resets table and queues email via email_outbox.
 * Always returns success message to avoid email enumeration.
 * @param {Object} req - Body: email.
 * @param {Object} res - Express response.
 * @returns {Promise<void>} 200 with generic success message.
 */
async function forgetPassword_controller(req, res) {
    const email = String(req.body.email || '').trim().toLowerCase();
    if (!email.includes('@')) return res.status(400).json({ message: 'اكتب إيميل صحيح' });

    const baseUrl = process.env.PUBLIC_URL || (process.env.NODE_ENV === 'production' ? null : 'http://localhost:' + (process.env.PORT || 3000));
    if (!baseUrl) console.error('forget_password_public_url_missing');
    if (!mailer.configured()) console.error('forget_password_smtp_not_configured');

    const [[user]] = await pool.query('SELECT id FROM users WHERE email=?', [email]);
    if (user && baseUrl) {
        await transaction(async db => {
            const token = crypto.randomBytes(32).toString('hex');
            const url = new URL('/auth/recovery', baseUrl);
            url.searchParams.set('token', token);
            await db.query('INSERT INTO password_resets (token_hash,user_id,expires_at) VALUES (?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 20 MINUTE))', [digest(token), user.id]);
            await db.query('INSERT INTO email_outbox (recipient,subject,body) VALUES (?,?,?)', [email, 'استعادة حساب دوق', 'رابط تغيير كلمة المرور صالح لمدة 20 دقيقة: ' + url.href]);
        });
    }
    setImmediate(() => mailer.flushOutbox().catch(() => console.error('mail_flush_failed')));
    return res.json({ status: 'success', message: 'لو الإيميل ده مسجل عندنا هيوصلك لينك تغيير الباسورد خلال دقايق' });
}

// ============================================
// 8. Password Recovery (token from email)
// ============================================

/**
 * Completes password reset using token from email link.
 * Validates token (20 min, unused), marks used, updates password, increments session_version.
 * @param {Object} req - Body: token (64 hex), new_password, confirm_password.
 * @param {Object} res - Express response.
 * @returns {Promise<void>} 200 with redirect to /auth, 400 on invalid/used/expired token.
 */
async function recover_controller(req, res) {
    const { token, new_password, confirm_password } = req.body;
    if (typeof token !== 'string' || !/^\w{64}$/.test(token) || typeof new_password !== 'string' || new_password.length < 8 || new_password.length > 72 || new_password !== confirm_password) {
        return res.status(400).json({ message: 'الباسورد الجديد لازم يكون 8 حروف على الأقل ومطابق للتأكيد' });
    }
    await transaction(async db => {
        const [[reset]] = await db.query(
            'SELECT * FROM password_resets WHERE token_hash=? AND expires_at>UTC_TIMESTAMP() AND used_at IS NULL FOR UPDATE',
            [digest(token)]
        );
        if (!reset) throw new HttpError(400, 'اللينك انتهى أو اتستخدم قبل كده. اطلب لينك جديد');
        await db.query('UPDATE password_resets SET used_at=UTC_TIMESTAMP() WHERE user_id=? AND used_at IS NULL', [reset.user_id]);
        await db.query('UPDATE users SET password_hash=?,session_version=session_version+1 WHERE id=?', [await bcrypt.hash(new_password, 12), reset.user_id]);
    });
    return res.json({ status: 'success', message: 'تم تغيير كلمة المرور', redirect: '/auth' });
}

// ============================================
// 9. Enable/Disable 2FA (authenticated)
// ============================================

/**
 * Toggles 2FA for authenticated user.
 * To enable: requires valid enrollment cookie and OTP; seals new secret.
 * To disable: requires password and current 2FA OTP; clears secret.
 * Increments session_version and re-issues session cookie.
 * @param {Object} req - Authenticated; body: enabled (bool), password, otp.
 * @param {Object} res - Express response.
 * @returns {Promise<void>} 200 with success message, 400/409 on validation/password/OTP/state errors.
 */
async function change2fa_controller(req, res) {
    const [[user]] = await pool.query('SELECT * FROM users WHERE id=?', [req.user.id]);
    if (!user || !(await bcrypt.compare(String(req.body.password || ''), user.password_hash))) {
        return res.status(400).json({ message: 'الباسورد غلط' });
    }
    const wants = enabled(req.body.enabled);
    if (wants && Number(user.two_factor_enabled)) {
        return res.status(409).json({ message: 'المصادقة مفعلة بالفعل' });
    }
    const setup = wants ? enrollment(req) : null;
    const secret = wants ? setup?.secret : readSecret(user.two_factor_secret);
    if (!secret || !verifyToken(secret, String(req.body.otp || ''))) {
        return res.status(400).json({ message: 'كود المصادقة غلط' });
    }
    await pool.query(
        'UPDATE users SET two_factor_secret=?,two_factor_enabled=?,two_factor_required=?,session_version=session_version+1 WHERE id=?',
        [wants ? 'sealed:' + seal({ secret }) : null, wants ? 1 : 0, wants ? 1 : 0, user.id]
    );
    res.clearCookie('doq_enrolment', { path: '/' });
    issueSession(res, { ...user, session_version: Number(user.session_version) + 1 });
    return res.json({ status: 'success', message: wants ? 'تم تفعيل المصادقة' : 'تم إيقاف المصادقة' });
}

module.exports = {
    signIn_controller,
    signUp_controller,
    signUp2_verify_controller,
    generateSecretKey_controller,
    logout_controller,
    resetPassword_controller,
    forgetPassword_controller,
    recover_controller,
    change2fa_controller
};