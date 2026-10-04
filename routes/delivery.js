/**
 * Delivery routes (mounted at /delivery).
 * Provides delivery dashboard page (requires delivery role).
 */
const router = require('express').Router();
const auth = require('../middlware/auth');
const roles = require('../middlware/roles');
const catchError = require('../utiles/catchError');
const { delivery_dashboard_render } = require('../rendering/delivery');

router.get('/', auth, roles('delivery'), catchError(delivery_dashboard_render));

module.exports = router;