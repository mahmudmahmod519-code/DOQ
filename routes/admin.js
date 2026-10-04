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

const {Dashboard_render}=require("../rendering/admin.js");
const { approveUser_controller, rejectUser_controller, listPendingUsers_controller, assignDelivery_controller, listOrdersAdmin_controller, listDeliveryUsers_controller } = require('../controller/orders');

const auth = require('../middlware/auth');
const roles = require('../middlware/roles');
const catchError = require('../utiles/catchError');
const for_main = require('../middlware/for_main');

// كل الـ routes محمية: لازم يكون Admin
router.use(auth,roles('admin'));

router.get('/', catchError(Dashboard_render));
router.get('/operations', (req,res)=>res.render('./admin/operations', { currentUser:req.user, pageTitle:'DOQ operations' }));
router.get('/api/v1/pending-accounts', catchError(listPendingUsers_controller));
router.patch('/api/v1/pending-accounts/:id/approve', catchError(approveUser_controller));
router.patch('/api/v1/pending-accounts/:id/reject', catchError(rejectUser_controller));
router.patch('/api/v1/orders/:publicId/assign-delivery', catchError(assignDelivery_controller));
router.get('/api/v1/orders', catchError(listOrdersAdmin_controller));
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
// KITCHENS (العربيات)
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
