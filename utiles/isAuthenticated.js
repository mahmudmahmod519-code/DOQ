/**
 * Standalone authentication check (no middleware chain).
 * Identifies the user via JWT (cookie or Authorization header) and returns
 * the sanitized user object or null. Used for server-side rendering helpers.
 * @param {Object} req - Express request.
 * @returns {Promise<Object|null>} Sanitized user or null if no valid session.
 */
module.exports = async (req) => require('../utiles/remove_password')(await require('../middlware/auth').identify(req));