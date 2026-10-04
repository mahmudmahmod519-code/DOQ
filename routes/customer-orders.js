const router = require('express').Router();
const auth = require('../middlware/auth');
const roles = require('../middlware/roles');
const catchError = require('../utiles/catchError');
const checkLogin = require('../utiles/checkLogin');
const { getCustomerOrders_controller } = require('../controller/orders');
router.get('/', auth, roles('customer'), (req, res) => res.render('./customer/orders', { ...checkLogin(req, res), pageTitle: 'طلباتي | دوق' }));
router.get('/api/v1/my', auth, roles('customer'), catchError(getCustomerOrders_controller));
module.exports = router;
