/**
 * 404 handler for unmatched routes.
 * Renders the 404 error page with login state.
 */
const checkLogin = require("../utiles/checkLogin");

/**
 * Express middleware for 404 responses.
 * @param {Object} req - Express request.
 * @param {Object} res - Express response.
 */
module.exports = (req, res) => {
    res.status(404).render('./errors/page_404', checkLogin(req, res));
};