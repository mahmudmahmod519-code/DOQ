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

/**
 * Renders the admin financial reports & settlement page.
 * Route: GET /admin/reports
 * @param {Object} req - Express request.
 * @param {Object} res - Express response.
 */
function reports_render(req, res) {
    res.render('./admin/reports', {
        ...checkLogin(req, res),
        pageTitle: 'تقارير وحسابات الطلبات | دوق DOQ'
    });
}

module.exports = {
    Dashboard_render,
    reports_render
};