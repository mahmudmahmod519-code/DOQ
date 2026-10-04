/**
 * User page rendering handlers.
 * Provides: profile page, settings page, admin users listing, chef/admin dashboard.
 */
const checkLogin = require("../utiles/checkLogin");

/**
 * Renders the user profile/portfolio page.
 * Includes reviews for customers; hides reviews for admin/chef.
 * Route: GET /users/profile
 * @param {Object} req - Express request; uses req.my (reviews) and req.pagination.
 * @param {Object} res - Express response.
 */
async function portfolio_render(req, res) {
    const path = './user/portfolio';
    const response = {
        reviews: req.my,
        total_reviews: req.pagination.total,
        ...checkLogin(req, res)
    };

    // Admin/chef don't see reviews on profile
    if (req.user.roles === 'admin' || req.user.roles === 'chef') {
        delete response.reviews;
        delete response.total_reviews;
    }

    res.render(path, response);
}

/**
 * Renders the user settings page.
 * Route: GET /users/settings
 * @param {Object} req - Express request.
 * @param {Object} res - Express response.
 */
async function setting_render(req, res) {
    res.render('./user/setting', checkLogin(req, res));
}

/**
 * Renders the admin users listing page.
 * Route: GET /users
 * @param {Object} req - Express request.
 * @param {Object} res - Express response.
 */
async function users_render(req, res) {
    res.render('./admin/users', checkLogin(req, res));
}

/**
 * Renders the dashboard page (chef or admin template).
 * Includes chef dashboard data from getUnifiedChefDashboard middleware.
 * Route: GET /users/dashboard
 * @param {Object} req - Express request; uses req.dashboard and req.user.roles.
 * @param {Object} res - Express response.
 */
async function dashboard_render(req, res) {
    let path = './chef/dashboard';
    const response = {
        ...checkLogin(req, res),
        dashboard: req.dashboard || {}
    };

    if (req.user.roles === 'admin') {
        path = './admin/dashboard';
        delete response.dashboard;
        response.pageTitle = 'لوحة التحكم | دوق DOQ';
    }

    res.render(path, response);
}

module.exports = {
    portfolio_render,
    dashboard_render,
    setting_render,
    users_render
};