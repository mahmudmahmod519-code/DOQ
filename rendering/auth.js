/**
 * Authentication page rendering handlers.
 * Provides: login/signup page, 2FA verification page, forgot/reset password pages.
 */
const checkLogin = require('../utiles/checkLogin');

/**
 * Renders the main auth page (login/signup).
 * Route: GET /auth
 * @param {Object} req - Express request.
 * @param {Object} res - Express response.
 */
async function auth_render(req, res) {
    res.render("./auth/auth", checkLogin(req, res));
}

/**
 * Renders the 2FA OTP entry page (signup step 2).
 * Validates the pending_token from cookie or Authorization header.
 * Route: GET /auth/signup2
 * @param {Object} req - Express request; reads pending_token from cookie or Bearer header.
 * @param {Object} res - Express response.
 */
async function authSignUp2_render(req, res) {
    // 1. Read token from cookie (web) or Authorization header (mobile/API)
    let pendingToken = req.cookies?.pending_token;

    if (!pendingToken && req.headers.authorization) {
        const parts = req.headers.authorization.split(" ");
        if (parts[0] === "Bearer") pendingToken = parts[1];
    }

    // 2. No token -> redirect to login
    if (!pendingToken) {
        return res.redirect('/auth');
    }

    // 3. Validate token structure and type
    try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(pendingToken, process.env.JWT_SECRET);
        if (decoded.type !== 'pending_2fa') {
            return res.redirect('/auth');
        }
    } catch (err) {
        // Invalid/expired token
        return res.redirect('/auth');
    }

    // 4. Render 2FA entry page
    res.render('./auth/signup2', checkLogin(req, res));
}

/**
 * Renders the forgot password request page.
 * Route: GET /auth/forgetpassword
 * @param {Object} req - Express request.
 * @param {Object} res - Express response.
 */
function forgetPassword_render(req, res) {
    res.render("./auth/forgetpassword", checkLogin(req, res));
}

/**
 * Renders the password reset page (requires authenticated session).
 * Route: GET /auth/resetpassword
 * @param {Object} req - Express request.
 * @param {Object} res - Express response.
 */
function resetPassword_render(req, res) {
    res.render("./auth/resetpassword", checkLogin(req, res));
}

module.exports = {
    auth_render,
    forgetPassword_render,
    resetPassword_render,
    authSignUp2_render
};