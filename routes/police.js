const router = require('express').Router();


router.get('/privacy-policy', (req, res) => {
    res.render('./police/privacy'); // هيفتح ملف views/privacy.ejs
});

router.get('/terms-of-service', (req, res) => {
    res.render('./police/terms');
});

router.get('/cookies-policy', (req, res) => {
    res.render('./police/cookies');
});

router.get('/refund-policy', (req, res) => {
    res.render('./police/refund');
});

module.exports = router;