/**
 * Category page rendering handler (admin).
 * Route: GET /categories
 */
const checkLogin = require("../utiles/checkLogin");

/**
 * Renders the admin categories management page.
 * @param {Object} req - Express request.
 * @param {Object} res - Express response.
 */
function catgories_render(req, res) {
    res.render('./admin/cateogries', checkLogin(req, res));
}

module.exports = {
    catgories_render
};