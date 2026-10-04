/**
 * Builds a minimal login-state object for view rendering.
 * Strips sensitive fields from the user object via removeSecrets.
 * @param {Object} req - Express request (reads req.user).
 * @returns {Object} { currentUser: sanitized user or undefined, status: 'success', login: boolean }
 */
const removeSecrets = require('./remove_password');
module.exports = (req) => ({
    currentUser: req.user ? removeSecrets(req.user) : undefined,
    status: 'success',
    login: Boolean(req.user)
});