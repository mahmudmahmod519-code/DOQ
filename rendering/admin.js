/**
 * Admin page rendering handler.
 * Route: GET /admin
 */
const checkLogin = require("../utiles/checkLogin");

/**
 * Renders the admin dashboard page.
 * @param {Object} req - Express request.
 * @param {Object} res - Express response.
 */
function Dashboard_render(req, res) {
    res.render('./admin/dashboard', {
        ...checkLogin(req, res),
        pageTitle: 'لوحة التحكم | دوق DOQ'
    });
}

module.exports = {
    Dashboard_render
};