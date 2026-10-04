/**
 * Home page rendering handlers.
 * Provides: landing page (with categories & featured kitchens), about, FAQ, contact pages.
 */
const { getCategoriesWithCount } = require("../controller/category");
const { getFeaturedKitchens } = require("../controller/kitchen");
const checkLogin = require("../utiles/checkLogin");

/**
 * Renders the landing page with dynamic data.
 * Fetches categories with dish counts and featured kitchens.
 * Route: GET /
 * @param {Object} req - Express request.
 * @param {Object} res - Express response.
 */
async function getLandingPage_render(req, res) {
    const categories = await getCategoriesWithCount();
    const kitchens = await getFeaturedKitchens();

    res.render('index', {
        ...checkLogin(req, res),
        categories,
        kitchens
    });
}

/**
 * Renders the about page.
 * Route: GET /about
 * @param {Object} req - Express request.
 * @param {Object} res - Express response.
 */
function about_render(req, res) {
    res.render('about', checkLogin(req, res));
}

/**
 * Renders the FAQ page.
 * Route: GET /faqs
 * @param {Object} req - Express request.
 * @param {Object} res - Express response.
 */
function fqs_render(req, res) {
    res.render('fqs', checkLogin(req, res));
}

/**
 * Renders the contact page.
 * Route: GET /contect-us
 * @param {Object} req - Express request.
 * @param {Object} res - Express response.
 */
function content_render(req, res) {
    res.render('contect-us', checkLogin(req, res));
}

module.exports = {
    about_render,
    fqs_render,
    content_render,
    getLandingPage_render
};