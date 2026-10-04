/**
 * Payment controller: Paymob integration for chef subscriptions.
 * Provides: payment initiation, webhook handler, subscription check middleware.
 */
const pool = require("../database/pool");
const { getPaymobAuthToken, registerOrder, getPaymentKey, verifyPaymobHmac } = require("../utiles/payment");

/**
 * Checks if Paymob payments are enabled via env var.
 * @returns {boolean}
 */
function paymentsEnabled() {
    return String(process.env.PAYMENTS_ENABLED || 'false').trim().toLowerCase() === 'true';
}

/**
 * Returns a standardized "payments disabled" response.
 * @param {Object} res - Express response.
 * @returns {Object} Response with 410 status.
 */
function paymentsDisabled(res) {
    return res.status(410).json({
        status: 'disabled',
        code: 'PAYMENTS_DISABLED',
        message: 'الدفع الإلكتروني متوقف حالياً والدفع يتم عبر إنستاباي بعد التواصل مع الإدارة'
    });
}

// ============================================
// 1. Initiate Subscription Payment
// ============================================

/**
 * Starts a Paymob payment flow for the authenticated user (chef subscription).
 * Calls Paymob: auth token -> order registration -> payment key -> returns iframe URL.
 * @param {Object} req - Authenticated request (req.user with id, name, email, phone).
 * @param {Object} res - Express response.
 * @returns {Promise<void>} 200 with iframe_url and order_id, 410 if payments disabled, 500 on error.
 */
async function initiateSubscription(req, res) {
    if (!paymentsEnabled()) return paymentsDisabled(res);
    try {
        const userId = req.user.id;
        const userName = `${req.user.first_name} ${req.user.last_name}`;
        const userEmail = req.user.email;
        const userPhone = req.user.phone_number;

        // 1. Get Auth Token
        const authToken = await getPaymobAuthToken();

        // 2. Register Order
        const orderId = await registerOrder(authToken, userId, userName, userEmail, userPhone);

        // 3. Get Payment Key
        const paymentToken = await getPaymentKey(authToken, orderId, userEmail, userPhone, userName);

        // 4. Return Iframe URL to Frontend
        const iframeUrl = `https://accept.paymob.com/api/acceptance/iframes/${process.env.PAYMOB_IFRAME_ID}?payment_token=${paymentToken}`;

        res.status(200).json({
            status: 'success',
            data: { iframe_url: iframeUrl, order_id: orderId }
        });
    } catch (error) {
        console.error("Paymob Initiation Error:", error && error.message);
        res.status(500).json({ status: 'error', message: 'فشل في بدء عملية الدفع' });
    }
}

// ============================================
// 2. Paymob Webhook Handler
// ============================================

/**
 * Receives Paymob payment webhook notifications.
 * Verifies HMAC, deduplicates via event_id, activates chef subscription on success.
 * @param {Object} req - Request body with Paymob payload.
 * @param {Object} res - Express response (must return 200 quickly).
 * @returns {Promise<void>} 200 on success/duplicate, 400 on invalid HMAC/reference, 500 on error.
 */
async function paymobWebhook(req, res) {
    if (!paymentsEnabled()) return paymentsDisabled(res);
    try {
        const payload = req.body;

        // Verify HMAC signature
        const isValid = verifyPaymobHmac(payload);
        if (!isValid) {
            return res.status(400).json({ status: 'error', message: 'Invalid HMAC' });
        }

        const eventId = String(payload.id || '').trim();
        const merchantOrderId = String(payload.order?.merchant_order_id || '');
        const match = /^SUB_(\d+)_\d+$/.exec(merchantOrderId);
        if (!eventId || !match || (process.env.PAYMOB_INTEGRATION_ID && String(payload.integration_id) !== String(process.env.PAYMOB_INTEGRATION_ID))) {
            return res.status(400).json({ status: 'error', message: 'Invalid payment reference' });
        }

        // Deduplicate webhook events
        const [event] = await pool.query('INSERT IGNORE INTO payment_webhook_events (event_id) VALUES (?)', [eventId]);
        if (!event.affectedRows) return res.status(200).json({ status: 'success' });

        // On successful payment (not refund), activate chef subscription
        if ((payload.success === true || payload.success === 'true') && payload.is_refunded !== true && payload.is_refunded !== 'true') {
            const userId = Number(match[1]);

            // Subscription end date: 1 month from now
            const now = new Date();
            const endDate = new Date(now.setMonth(now.getMonth() + 1));

            // Update user subscription status
            await pool.query(
                `UPDATE users SET subscription_status = 'active', subscription_ends_at = ? WHERE id = ? AND roles = 'chef'`,
                [endDate, userId]
            );
        }

        // Must respond 200 to Paymob immediately
        res.status(200).json({ status: 'success' });
    } catch (error) {
        console.error("Paymob Webhook Error:", error && error.message);
        res.status(500).json({ status: 'error' });
    }
}

// ============================================
// 3. Subscription Check Middleware
// ============================================

/**
 * Middleware that verifies the user has an active, non-expired subscription.
 * Skips check if payments are disabled (PAYMENTS_ENABLED !== 'true').
 * @param {Object} req - Authenticated request (req.user.id).
 * @param {Object} res - Express response.
 * @param {Function} next - Next middleware.
 * @returns {Promise<void>} Calls next() if valid, 403 if expired/inactive, 404 if user gone, 500 on error.
 */
async function checkSubscription(req, res, next) {
    // Disable payment gate only blocks Paymob; doesn't lock kitchen routes
    if (!paymentsEnabled()) return next();
    try {
        const userId = req.user.id;
        const [users] = await pool.query(
            `SELECT subscription_status, subscription_ends_at FROM users WHERE id = ?`,
            [userId]
        );

        if (users.length === 0) {
            return res.status(404).json({ status: 'error', message: 'المستخدم غير موجود' });
        }

        const user = users[0];
        const now = new Date();
        const endDate = user.subscription_ends_at ? new Date(user.subscription_ends_at) : null;

        if (user.subscription_status !== 'active' || (endDate && endDate < now)) {
            return res.status(403).json({
                status: 'error',
                message: 'اشتراكك غير فعال أو منتهي الصلاحية. يرجى تجديد الاشتراك.',
                code: 'SUBSCRIPTION_EXPIRED'
            });
        }

        next();
    } catch (error) {
        console.error("Subscription Check Error:", error && error.message);
        res.status(500).json({ status: 'error', message: 'خطأ في الخادم' });
    }
}

module.exports = {
    initiateSubscription,
    paymobWebhook,
    checkSubscription,
    paymentsEnabled
};