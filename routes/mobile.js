/**
 * Mobile customer app routes (mounted at /m).
 *
 * The customer experience is fully separated from the web site:
 *   - Web  (/admin, /users/dashboard, /delivery ...) => admin, kitchen, delivery.
 *   - Mobile (/m ...)                                 => customers who order food.
 * The Android APK (mobile/) opens /m directly. Pages are light EJS shells; data is loaded by
 * public/m/app.js from /m/api/v1/* using cursor pagination (infinite scroll).
 */
const router = require('express').Router();
const auth = require('../middlware/auth');
const catchError = require('../utiles/catchError');
const { dashboard } = require('../utiles/session');
const c = require('../controller/mobile');

router.use(auth.optional);

/**
 * Staff accounts (admin / chef / delivery) belong to the web dashboards.
 * Pages redirect them there; APIs refuse them.
 */
function customersOnly(req, res, next) {
    if (!req.user || req.user.roles === 'customer') return next();
    if (req.path.startsWith('/api/')) {
        return res.status(403).json({ status: 'error', message: 'التطبيق ده للعملاء بس. استخدم لوحة التحكم على الموقع' });
    }
    return res.redirect(dashboard(req.user.roles));
}
router.use(customersOnly);

/** Personal pages need a signed-in customer; guests go to the mobile login with ?next=. */
function requireCustomerPage(req, res, next) {
    if (req.user) return next();
    return res.redirect('/m/auth?next=' + encodeURIComponent(req.originalUrl));
}

/** Personal APIs need a signed-in, approved customer. */
function requireCustomerApi(req, res, next) {
    if (req.user && req.user.roles === 'customer' && req.user.account_status === 'approved') return next();
    return res.status(401).json({ status: 'error', message: 'سجل دخول الأول' });
}

/** Renders a mobile page shell. */
function page(view, title, extra) {
    return (req, res) => {
        res.set('Cache-Control', 'no-store');
        res.render(`mobile/${view}`, {
            pageTitle: title,
            page: view,
            params: { ...req.params, ...(extra ? extra(req) : {}) },
            user: req.user ? { first_name: req.user.first_name } : null,
            activeTab: view
        });
    };
}

// --- Pages ---
router.get('/', page('home', 'دوق | اطلب أكل بيتي'));
router.get('/auth', (req, res, next) => {
    if (req.user) return res.redirect(safeNext(req.query.next));
    return page('auth', 'تسجيل الدخول | دوق', r => ({ next: safeNext(r.query.next), mode: r.query.mode === 'signup' ? 'signup' : 'login' }))(req, res, next);
});
router.get('/kitchens', page('kitchens', 'المطابخ | دوق'));
router.get('/kitchens/:id', page('kitchen', 'المطبخ | دوق'));
router.get('/dishes/:id', page('dish', 'الطبق | دوق'));
router.get('/orders', requireCustomerPage, page('orders', 'طلباتي | دوق'));
router.get('/orders/:publicId', requireCustomerPage, page('order', 'تتبع الطلب | دوق'));
router.get('/favourites', requireCustomerPage, page('favourites', 'المفضلة | دوق'));
router.get('/notifications', requireCustomerPage, page('notifications', 'الإشعارات | دوق'));
router.get('/account', requireCustomerPage, page('account', 'حسابي | دوق'));

// --- Public APIs (guest or customer) ---
router.get('/api/v1/home', catchError(c.home_controller));
router.get('/api/v1/cities', catchError(c.listCities_controller));
router.get('/api/v1/dishes', catchError(c.listDishes_controller));
router.get('/api/v1/dishes/:id', catchError(c.getDish_controller));
router.get('/api/v1/dishes/:id/reviews', catchError(c.listDishReviews_controller));
router.get('/api/v1/kitchens', catchError(c.listKitchens_controller));
router.get('/api/v1/kitchens/:id', catchError(c.getKitchen_controller));

// --- Customer APIs ---
router.get('/api/v1/me', requireCustomerApi, catchError(c.me_controller));
router.get('/api/v1/orders', requireCustomerApi, catchError(c.listOrders_controller));
router.get('/api/v1/orders/:publicId', requireCustomerApi, catchError(c.getOrder_controller));
router.get('/api/v1/favourites', requireCustomerApi, catchError(c.listFavourites_controller));
router.get('/api/v1/notifications', requireCustomerApi, catchError(c.listNotifications_controller));
router.get('/api/v1/reviews/my', requireCustomerApi, catchError(c.listMyReviews_controller));

/** Only allow redirects back inside the mobile app (prevents open redirects). */
function safeNext(value) {
    const next = String(value || '');
    return /^\/m(\/[\w-]+)*\/?$/.test(next) ? next : '/m';
}

router.safeNext = safeNext;
module.exports = router;
