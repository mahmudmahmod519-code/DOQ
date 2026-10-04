/**
 * User routes (mounted at /users).
 * Provides: profile page, chef dashboard/orders, admin user listing,
 * user CRUD (admin), profile updates, and profile image upload.
 */
const router = require("express").Router();
const roles = require('../middlware/roles');
const for_main = require('../middlware/for_main');
const allRows = require('../middlware/allRows');
const auth = require('../middlware/auth');
const upload = require("../middlware/upload");
const catchError = require('../utiles/catchError');

const { getChefOrders_controller } = require('../controller/orders');

const {
    deleteUser_controller,
    changePortfolio_controller,
    getSpcificUser_controller,
    getUnifiedChefDashboard,
    uploadImageProfile_controller,
    createUser_controller
} = require("../controller/user");

const {
    portfolio_render,
    dashboard_render,
    setting_render,
    users_render
} = require("../rendering/user");

router.use(auth);

// GET /users/profile - User profile page (with reviews via for_main middleware)
router.get('/profile', for_main('review', true, true), catchError(portfolio_render));

// GET /users/orders - Chef orders page (chef)
router.get('/orders', roles('chef'), (req, res) => res.render('./chef/orders', { ...require('../utiles/checkLogin')(req, res), pageTitle: 'طلبات المطبخ | دوق' }));

// GET /users/orders/api - Chef orders API (chef)
router.get('/orders/api', roles('chef'), catchError(getChefOrders_controller));

// GET /users/dashboard - Chef/admin dashboard page (chef, admin)
router.get('/dashboard', roles('chef', 'admin'), catchError(dashboard_render));

// GET /users - Admin users listing page (admin)
router.get('/', roles('admin'), catchError(users_render));

// GET /users/settings - User settings page
router.get('/settings', catchError(setting_render))

// POST /users/api/v1 - Create user (admin)
router.post('/api/v1', roles('admin'), catchError(createUser_controller));

// DELETE /users/api/v1/:id - Delete user (admin)
router.delete('/api/v1/:id', roles('admin'), catchError(deleteUser_controller));

// PUT /users/api/v1/ - Update own profile (any authenticated)
router.put('/api/v1/', catchError(changePortfolio_controller));

// PUT /users/api/v1/:id - Update user by admin (admin)
router.put('/api/v1/:id', roles('admin'), catchError(changePortfolio_controller));

// GET /users/api/v1/:id - Get specific user (admin)
router.get('/api/v1/:id', roles('admin'), catchError(getSpcificUser_controller));

// POST /users/api/v1/my/profile - Upload profile image (authenticated)
router.post("/api/v1/my/profile", upload.single('profile'), catchError(uploadImageProfile_controller));

module.exports = router;