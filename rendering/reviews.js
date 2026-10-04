/**
 * Review page rendering handlers.
 * Provides: reviews listing page (role-based template), customer's reviews page.
 */
const checkLogin = require("../utiles/checkLogin");

/**
 * Renders the customer's reviews page.
 * Route: GET /reviews/my-reviews
 * @param {Object} req - Express request.
 * @param {Object} res - Express response.
 */
function myReviews_render(req, res) {
    return res.render('./customer/myreviews', checkLogin(req, res));
}

/**
 * Renders the reviews listing page (template varies by user role).
 * Includes type/id query params for dish/kitchen filtering (customer only).
 * Route: GET /reviews
 * @param {Object} req - Express request; uses req.user.roles for template, req.query for filters.
 * @param {Object} res - Express response.
 */
function reviews_render(req, res) {
    const { type, id } = req.query;
    let path = './customer/reviews';

    if (req.user?.roles === 'admin')
        path = './admin/reviews';
    else if (req.user?.roles === 'chef')
        path = './chef/reviews';

    const response = {
        type: type || null,
        id: id || null,
        ...checkLogin(req, res)
    };

    // Non-customer roles don't need type/id filters
    if (req.user?.roles !== 'customer') {
        delete response.type;
        delete response.id;
    }

    return res.render(path, response);
}

module.exports = {
    reviews_render,
    myReviews_render
};