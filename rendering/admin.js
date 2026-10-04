const checkLogin = require("../utiles/checkLogin");

/**
 * Render Admin Dashboard page
 * Route: GET /admin/
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
