/**
 * Home routes (mounted at /).
 * Provides landing page, about, FAQ, and contact pages.
 */
const router = require("express").Router();
const catchError = require('../utiles/catchError');
const auth = require('../middlware/auth');

const {
    about_render,
    content_render,
    fqs_render,
    getLandingPage_render
} = require("../rendering/home");

// GET / - Landing page (static & dynamic: top dishes with paid promotion)
// The Android APK (WebView, package com.doq.app) is the customer app: open it on /m directly
const fromApk = req => req.get('x-requested-with') === 'com.doq.app';
router.get('', auth.optional, (req, res, next) => {
    if (fromApk(req) && (!req.user || req.user.roles === 'customer')) return res.redirect('/m');
    next();
}, catchError(getLandingPage_render));

// GET /about - About page (static)
router.get('/about', catchError(about_render));

// GET /faqs - FAQ page (static)
router.get('/faqs', catchError(fqs_render));

// GET /contect-us - Contact page (static)
router.get('/contect-us', catchError(content_render));

module.exports = router;