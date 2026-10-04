/**
 * Dish page rendering handlers.
 * Provides: single dish detail page, dishes dashboard (role-based template).
 */
const checkLogin = require("../utiles/checkLogin");

/**
 * Renders a single dish detail page.
 * Converts ingredients string to array (handles Chinese comma).
 * Route: GET /dishes/:id
 * @param {Object} req - Express request; uses req.my populated by dish_get_id middleware.
 * @param {Object} res - Express response.
 */
async function SpecificDish_render(req, res) {
    // Convert ingredients string to array (split by comma, handles Chinese comma)
    req.my.ingredients = req.my.ingredients ? req.my.ingredients.split('，') : null;

    return res.render('./dish/dish', { dish: req.my, ...checkLogin(req, res) });
}

/**
 * Renders the dishes dashboard page (template varies by user role).
 * Route: GET /dishes
 * @param {Object} req - Express request; uses req.user.roles for template selection.
 * @param {Object} res - Express response.
 */
async function Dishes_render(req, res) {
    let path = './customer/dishes';
    if (req.user?.roles === 'admin')
        path = './admin/dishes';
    else if (req.user?.roles === 'chef')
        path = './chef/dishes';

    return res.render(path, checkLogin(req, res));
}

module.exports = {
    SpecificDish_render,
    Dishes_render
};