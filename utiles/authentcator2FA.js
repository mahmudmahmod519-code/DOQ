/**
 * Helpers for TOTP-based two-factor authentication (speakeasy).
 */
const speakeasy = require('speakeasy');

/**
 * Generates a new random base32 TOTP secret for a user.
 * @returns {{base32: string, otpauth_url: string}} The base32 secret and an otpauth:// provisioning URL for authenticator apps.
 */
function generateSecret() {
    const secret = speakeasy.generateSecret({
        name: `DOQ-Platform-${Date.now()}`,
        length: 20
    });
    return {
        base32: secret.base32,
        otpauth_url: secret.otpauth_url
    };
}


/**
 * Verifies a TOTP token and returns the absolute 30-second step it matched.
 * Useful for storing the last accepted step so the same token cannot be reused.
 * @param {string} secret - The user's base32 TOTP secret.
 * @param {string|number} token - The 6-digit code supplied by the user.
 * @returns {number|null} The counter step of the matching token, or null when invalid/malformed.
 */
function verifyTokenStep(secret, token) {
    if (!secret || !/^\d{6}$/.test(String(token || ''))) return null;
    const result = speakeasy.totp.verifyDelta({ secret, encoding: 'base32', token: String(token), window: 1 });
    return result ? Math.floor(Date.now() / 30000) + result.delta : null;
}

/**
 * Verifies a TOTP token with a 1-step window (±30 seconds).
 * @param {string} secret - The user's base32 TOTP secret.
 * @param {string|number} token - The 6-digit code supplied by the user.
 * @returns {boolean} True if token is valid.
 */
function verifyToken(secret, token) {
    return speakeasy.totp.verify({
        secret: secret,
        encoding: 'base32',
        token: token,
        window: 1 // allows ±1 step (30 seconds)
    });
}

module.exports = {
    generateSecret,
    verifyToken,
    verifyTokenStep
};