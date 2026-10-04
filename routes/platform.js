const router = require('express').Router();
const auth = require('../middlware/auth');
const roles = require('../middlware/roles');
const catchError = require('../utiles/catchError');
const { csrfProtection } = require('../middlware/security');
const c = require('../controller/platform');

router.post('/coupons', auth, roles('chef'), csrfProtection, catchError(c.createCoupon_controller));
router.get('/coupons/dish/:dishId', auth, roles('chef'), catchError(c.listMyDishCoupons_controller));
router.post('/coupons/validate', auth, roles('customer'), csrfProtection, catchError(c.validateCoupon_controller));
router.post('/referrals', auth, roles('customer'), csrfProtection, catchError(c.createReferral_controller));
router.post('/favourites/:dishId', auth, roles('customer'), csrfProtection, catchError(c.addFavourite_controller));
router.delete('/favourites/:dishId', auth, roles('customer'), csrfProtection, catchError(c.removeFavourite_controller));
router.get('/favourites', auth, roles('customer'), catchError(c.listFavourites_controller));
router.get('/notifications', auth, catchError(c.listNotifications_controller));
router.patch('/notifications/:id/read', auth, csrfProtection, catchError(c.readNotification_controller));
router.get('/chat/:publicId', auth, catchError(c.listChatMessages_controller));
router.post('/chat/:publicId', auth, csrfProtection, catchError(c.sendChatMessage_controller));
module.exports = router;
