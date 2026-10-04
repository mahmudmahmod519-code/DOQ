/**
 * Platform routes (mounted at /platform).
 * Provides: coupons, referrals, favorites, notifications, and chat APIs.
 * CSRF protection applied to state-changing endpoints.
 */
const router = require('express').Router();
const auth = require('../middlware/auth');
const roles = require('../middlware/roles');
const catchError = require('../utiles/catchError');
const { csrfProtection } = require('../middlware/security');
const c = require('../controller/platform');

// POST /platform/coupons - Create coupon (chef, CSRF protected)
router.post('/coupons', auth, roles('chef'), csrfProtection, catchError(c.createCoupon_controller));

// GET /platform/coupons/dish/:dishId - List coupons for a dish (chef)
router.get('/coupons/dish/:dishId', auth, roles('chef'), catchError(c.listMyDishCoupons_controller));

// POST /platform/coupons/validate - Validate coupon (customer, CSRF protected)
router.post('/coupons/validate', auth, roles('customer'), csrfProtection, catchError(c.validateCoupon_controller));

// POST /platform/referrals - Create referral link (customer, CSRF protected)
router.post('/referrals', auth, roles('customer'), csrfProtection, catchError(c.createReferral_controller));

// POST /platform/favourites/:dishId - Add to favorites (customer, CSRF protected)
router.post('/favourites/:dishId', auth, roles('customer'), csrfProtection, catchError(c.addFavourite_controller));

// DELETE /platform/favourites/:dishId - Remove from favorites (customer, CSRF protected)
router.delete('/favourites/:dishId', auth, roles('customer'), csrfProtection, catchError(c.removeFavourite_controller));

// GET /platform/favourites - List favorites (customer)
router.get('/favourites', auth, roles('customer'), catchError(c.listFavourites_controller));

// GET /platform/notifications - List notifications (all authenticated)
router.get('/notifications', auth, catchError(c.listNotifications_controller));

// PATCH /platform/notifications/:id/read - Mark notification read (all authenticated, CSRF)
router.patch('/notifications/:id/read', auth, csrfProtection, catchError(c.readNotification_controller));

// GET /platform/chat/:publicId - List chat messages for order (authenticated)
router.get('/chat/:publicId', auth, catchError(c.listChatMessages_controller));

// POST /platform/chat/:publicId - Send chat message (authenticated, CSRF)
router.post('/chat/:publicId', auth, csrfProtection, catchError(c.sendChatMessage_controller));

module.exports = router;