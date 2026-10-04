/**
 * Order routes (mounted at /orders).
 * Provides: customer order creation, order listing per role (customer/chef/delivery),
 * delivery vehicle management, order acceptance, and status updates.
 */
const router = require('express').Router();
const auth = require('../middlware/auth');
const roles = require('../middlware/roles');
const catchError = require('../utiles/catchError');
const { csrfProtection } = require('../middlware/security');

const {
    createOrder_controller,
    getCustomerOrders_controller,
    getDeliveryOrders_controller,
    getChefOrders_controller,
    updateOrderStatus_controller,
    acceptOrder_controller,
    listDeliveryVehicles_controller,
    createDeliveryVehicle_controller
} = require('../controller/orders');

router.use(auth);

// POST /orders/api/v1 - Create order (customer, CSRF protected)
router.post('/api/v1', roles('customer'), csrfProtection, catchError(createOrder_controller));

// GET /orders/api/v1/my - Customer's orders (customer)
router.get('/api/v1/my', roles('customer'), catchError(getCustomerOrders_controller));

// GET /orders/api/v1/chef - Chef's orders (chef)
router.get('/api/v1/chef', roles('chef'), catchError(getChefOrders_controller));

// GET /orders/api/v1/delivery - Delivery user's orders (delivery)
router.get('/api/v1/delivery', roles('delivery'), catchError(getDeliveryOrders_controller));

// GET /orders/api/v1/delivery/vehicles - Delivery user's vehicles (delivery)
router.get('/api/v1/delivery/vehicles', roles('delivery'), catchError(listDeliveryVehicles_controller));

// POST /orders/api/v1/delivery/vehicles - Create vehicle (delivery, CSRF protected)
router.post('/api/v1/delivery/vehicles', roles('delivery'), csrfProtection, catchError(createDeliveryVehicle_controller));

// PATCH /orders/api/v1/delivery/:publicId/accept - Accept order (delivery, CSRF protected)
router.patch('/api/v1/delivery/:publicId/accept', roles('delivery'), csrfProtection, catchError(acceptOrder_controller));

// PATCH /orders/api/v1/:publicId/status - Update order status (all roles, CSRF protected)
router.patch('/api/v1/:publicId/status', roles('admin', 'delivery', 'chef', 'customer'), csrfProtection, catchError(updateOrderStatus_controller));

module.exports = router;