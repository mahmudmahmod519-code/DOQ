const router = require('express').Router();
const auth = require('../middlware/auth');
const roles = require('../middlware/roles');
const catchError = require('../utiles/catchError');
const { csrfProtection } = require('../middlware/security');
const {
  createOrder_controller, getCustomerOrders_controller, getDeliveryOrders_controller,
  getChefOrders_controller, updateOrderStatus_controller, acceptOrder_controller,
  listDeliveryVehicles_controller, createDeliveryVehicle_controller
} = require('../controller/orders');

router.use(auth);
router.post('/api/v1', roles('customer'), csrfProtection, catchError(createOrder_controller));
router.get('/api/v1/my', roles('customer'), catchError(getCustomerOrders_controller));
router.get('/api/v1/chef', roles('chef'), catchError(getChefOrders_controller));
router.get('/api/v1/delivery', roles('delivery'), catchError(getDeliveryOrders_controller));
router.get('/api/v1/delivery/vehicles', roles('delivery'), catchError(listDeliveryVehicles_controller));
router.post('/api/v1/delivery/vehicles', roles('delivery'), csrfProtection, catchError(createDeliveryVehicle_controller));
router.patch('/api/v1/delivery/:publicId/accept', roles('delivery'), csrfProtection, catchError(acceptOrder_controller));
router.patch('/api/v1/:publicId/status', roles('admin', 'delivery', 'chef', 'customer'), csrfProtection, catchError(updateOrderStatus_controller));
module.exports = router;
