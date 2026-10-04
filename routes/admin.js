/**
 * Admin routes (mounted at /admin).
 * All routes require admin role. Provides dashboard, operations page,
 * and full CRUD for users, kitchens, dishes, reviews, and categories.
 */
const express = require('express');
const router = express.Router();

const {
    // Dashboard
    getAdminDashboard_controller,

    // Users
    getAllUsers_controller,
    getUserById_controller,
    updateUserByAdmin_controller,
    deleteUserByAdmin_controller,

    // Kitchens
    getAllKitchensAdmin_controller,
    getKitchenByIdAdmin_controller,
    updateKitchenByAdmin_controller,
    deleteKitchenByAdmin_controller,

    // Dishes
    getAllDishesAdmin_controller,
    deleteDishByAdmin_controller,

    // Reviews
    getAllReviewsAdmin_controller,
    deleteReviewByAdmin_controller,

    // Categories
    getAllCategoriesAdmin_controller,
    createCategoryAdmin_controller,
    updateCategoryAdmin_controller,
    deleteCategoryAdmin_controller
} = require('../controller/admin');

const { Dashboard_render } = require("../rendering/admin.js");
const {
    approveUser_controller,
    rejectUser_controller,
    listPendingUsers_controller,
    assignDelivery_controller,
    listOrdersAdmin_controller,
    listDeliveryUsers_controller
} = require('../controller/orders');

const auth = require('../middlware/auth');
const roles = require('../middlware/roles');
const catchError = require('../utiles/catchError');
const for_main = require('../middlware/for_main');

// All routes require admin authentication
router.use(auth, roles('admin'));

// --- Page Routes ---

// GET /admin - Admin dashboard page
router.get('/', catchError(Dashboard_render));

// GET /admin/operations - Admin operations page (pending accounts, etc.)
router.get('/operations', (req, res) => res.render('./admin/operations', { currentUser: req.user, pageTitle: 'DOQ operations' }));

// --- API Routes ---

// GET /admin/api/v1/pending-accounts - List pending chef/delivery accounts
router.get('/api/v1/pending-accounts', catchError(listPendingUsers_controller));

// PATCH /admin/api/v1/pending-accounts/:id/approve - Approve pending account
router.patch('/api/v1/pending-accounts/:id/approve', catchError(approveUser_controller));

// PATCH /admin/api/v1/pending-accounts/:id/reject - Reject pending account
router.patch('/api/v1/pending-accounts/:id/reject', catchError(rejectUser_controller));

// PATCH /admin/api/v1/orders/:publicId/assign-delivery - Assign order to delivery company
router.patch('/api/v1/orders/:publicId/assign-delivery', catchError(assignDelivery_controller));

// GET /admin/api/v1/orders - List all orders with filters
router.get('/api/v1/orders', catchError(listOrdersAdmin_controller));

// GET /admin/api/v1/delivery-users - List delivery users for assignment
router.get('/api/v1/delivery-users', catchError(listDeliveryUsers_controller));

// =========================================================
// DASHBOARD
// =========================================================
router.get('/api/v1/dashboard', catchError(getAdminDashboard_controller));

// =========================================================
// USERS
// =========================================================
router.get('/api/v1/users', catchError(getAllUsers_controller));
router.get('/api/v1/users/:id', catchError(getUserById_controller));
router.put('/api/v1/users/:id', catchError(updateUserByAdmin_controller));
router.delete('/api/v1/users/:id', catchError(deleteUserByAdmin_controller));

// =========================================================
// KITCHENS
// =========================================================
router.get('/api/v1/kitchens', catchError(getAllKitchensAdmin_controller));
router.get('/api/v1/kitchens/:id', catchError(getKitchenByIdAdmin_controller));
router.put('/api/v1/kitchens/:id', catchError(updateKitchenByAdmin_controller));
router.delete('/api/v1/kitchens/:id', catchError(deleteKitchenByAdmin_controller));

// =========================================================
// DISHES
// =========================================================
router.get('/api/v1/dishes', catchError(getAllDishesAdmin_controller));
router.delete('/api/v1/dishes/:id', catchError(deleteDishByAdmin_controller));

// =========================================================
// REVIEWS
// =========================================================
router.get('/api/v1/reviews', catchError(getAllReviewsAdmin_controller));
router.delete('/api/v1/reviews/:id', catchError(deleteReviewByAdmin_controller));

// =========================================================
// CATEGORIES
// =========================================================
router.get('/api/v1/categories', catchError(getAllCategoriesAdmin_controller));
router.post('/api/v1/categories', catchError(createCategoryAdmin_controller));
router.put('/api/v1/categories/:id', catchError(updateCategoryAdmin_controller));
router.delete('/api/v1/categories/:id', catchError(deleteCategoryAdmin_controller));

module.exports = router;