/**
 * Kitchen page rendering handlers.
 * Provides: public kitchens listing, chef's kitchen management, kitchen profile page.
 */
const checkLogin = require("../utiles/checkLogin");

/**
 * Renders the kitchens listing page (template varies by role).
 * Route: GET /kitchens
 * @param {Object} req - Express request; uses req.user.roles for template selection.
 * @param {Object} res - Express response.
 */
function kitchens_render(req, res) {
    let path_render = './customer/kitchens';

    if (req.user?.roles === 'admin')
        path_render = './admin/kitchens';

    res.status(200).render(path_render, checkLogin(req, res));
}

/**
 * Renders the chef's kitchen management page.
 * Uses first kitchen from req.my (populated by for_main middleware).
 * Route: GET /kitchens/my
 * @param {Object} req - Express request; uses req.my[0] for kitchen data.
 * @param {Object} res - Express response.
 */
function myKitchen_render(req, res) {
    res.render('./chef/kitchen', {
        kitchen: req.my[0] || null,
        ...checkLogin(req, res)
    });
}

/**
 * Renders a specific kitchen profile page.
 * Uses req.kitchen populated by getKitchenById_middleware.
 * Route: GET /kitchens/:id
 * @param {Object} req - Express request; uses req.kitchen.
 * @param {Object} res - Express response.
 */
function kitchenProfile_render(req, res) {
    res.render('./kitchen/kitchen', {
        kitchen: req.kitchen || null,
        ...checkLogin(req, res)
    });
}

module.exports = {
    kitchens_render,
    myKitchen_render,
    kitchenProfile_render
};