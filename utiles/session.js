/**
 * Session and 2FA challenge management utilities.
 * Provides: JWT session cookie issuance, 2FA challenge issuance,
 * AES-256-GCM encryption (seal/unseal) for sensitive data, and role-to-dashboard mapping.
 */
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const pool = require('../database/pool');

/** Cookie options factory: httpOnly, secure in production, lax same-site. */
const options = (maxAge) => ({ httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge });

/**
 * Issues a 7-day session JWT and sets it as an httpOnly cookie.
 * Clears any pending 2FA challenge cookie.
 * @param {Object} res - Express response.
 * @param {Object} user - User row from database (must have id, session_version).
 */
function issueSession(res, user) {
  const token = jwt.sign(
    { id: user.id, sv: Number(user.session_version || 0), type: 'session' },
    process.env.JWT_SECRET,
    { expiresIn: '7d', algorithm: 'HS256' }
  );
  res.clearCookie('pending_token', { path: '/' });
  res.cookie('session_token', token, options(7 * 86400000));
}

/**
 * Issues a 10-minute 2FA challenge JWT and stores the nonce hash in auth_challenges.
 * Sets the challenge token as an httpOnly cookie (pending_token).
 * @param {Object} res - Express response.
 * @param {Object} user - User row from database.
 * @param {string} [purpose='login'] - Challenge purpose ('login', 'enable_2fa', etc.).
 * @returns {Promise<void>}
 */
async function issueChallenge(res, user, purpose = 'login') {
  const nonce = crypto.randomUUID();
  await pool.query(
    'INSERT INTO auth_challenges (nonce_hash,user_id,purpose,expires_at) VALUES (?,?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 10 MINUTE))',
    [crypto.createHash('sha256').update(nonce).digest('hex'), user.id, purpose]
  );
  const token = jwt.sign(
    { userId: user.id, type: 'pending_2fa', purpose, nonce, sv: Number(user.session_version || 0) },
    process.env.JWT_SECRET,
    { expiresIn: '10m', algorithm: 'HS256' }
  );
  res.cookie('pending_token', token, options(600000));
}

/**
 * Encrypts a value with AES-256-GCM using a key derived from JWT_SECRET.
 * Output format: base64url(iv).base64url(authTag).base64url(ciphertext)
 * @param {any} value - Value to encrypt (will be JSON.stringified).
 * @returns {string} Encrypted token string.
 */
function seal(value) {
  const key = crypto.createHash('sha256').update(process.env.JWT_SECRET).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map(x => x.toString('base64url')).join('.');
}

/**
 * Decrypts a value produced by seal().
 * @param {string} value - Encrypted token string (iv.tag.ciphertext).
 * @returns {any} Decrypted and parsed JSON value.
 * @throws {Error} If decryption fails (auth tag mismatch, tampering, etc.).
 */
function unseal(value) {
  const parts = String(value || '').split('.').map(x => Buffer.from(x, 'base64url'));
  const key = crypto.createHash('sha256').update(process.env.JWT_SECRET).digest();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, parts[0]);
  decipher.setAuthTag(parts[1]);
  return JSON.parse(Buffer.concat([decipher.update(parts[2]), decipher.final()]).toString('utf8'));
}

/**
 * Maps a user role to its default dashboard path.
 * @param {string} role - User role ('admin', 'delivery', 'chef', 'customer').
 * @returns {string} Dashboard URL path.
 */
function dashboard(role) {
  return role === 'admin' ? '/admin'
    : role === 'delivery' ? '/delivery'
    : role === 'chef' ? '/users/dashboard'
    : '/my-orders';
}

module.exports = { issueSession, issueChallenge, seal, unseal, options, dashboard };