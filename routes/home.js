/**
 * Home routes (mounted at /).
 * Provides landing page, about, FAQ, and contact pages.
 */
const router = require("express").Router();
const catchError = require('../utiles/catchError');

const {
    about_render,
    content_render,
    fqs_render,
    getLandingPage_render
} = require("../rendering/home");

// GET / - Landing page (static & dynamic: top dishes with paid promotion)
router.get('', catchError(getLandingPage_render));

// GET /about - About page (static)
router.get('/about', catchError(about_render));

// GET /faqs - FAQ page (static)
router.get('/faqs', catchError(fqs_render));

// GET /contect-us - Contact page (static)
router.get('/contect-us', catchError(content_render));

module.exports = router;