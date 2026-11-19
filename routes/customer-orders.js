/**
 * Customer orders routes (mounted at /my-orders).
 * Provides customer orders page and API.
 */
const router = require('express').Router();
const auth = require('../middlware/auth');
const roles = require('../middlware/roles');
const catchError = require('../utiles/catchError');
const checkLogin = require('../utiles/checkLogin');
const { getCustomerOrders_controller } = require('../controller/orders');

// GET /my-orders - Customer orders page
// Customer orders moved to the mobile app
router.get('/', (req, res) => res.redirect('/m/orders'));

// GET /my-orders/api/v1/my - Customer's orders API
router.get('/api/v1/my', auth, roles('customer'), catchError(getCustomerOrders_controller));

module.exports = router;