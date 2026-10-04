/**
 * Legal/Policy routes (mounted at /police).
 * Provides static policy pages: privacy, terms, cookies, refund.
 */
const router = require('express').Router();

// GET /police/privacy-policy - Privacy policy page
router.get('/privacy-policy', (req, res) => {
    res.render('./police/privacy');
});

// GET /police/terms-of-service - Terms of service page
router.get('/terms-of-service', (req, res) => {
    res.render('./police/terms');
});

// GET /police/cookies-policy - Cookies policy page
router.get('/cookies-policy', (req, res) => {
    res.render('./police/cookies');
});

// GET /police/refund-policy - Refund policy page
router.get('/refund-policy', (req, res) => {
    res.render('./police/refund');
});

module.exports = router;