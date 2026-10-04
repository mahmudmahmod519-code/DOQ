/**
 * Notifications routes (mounted at /notifications).
 * Provides notifications page and API for all authenticated roles.
 */
const router = require('express').Router();
const auth = require('../middlware/auth');
const roles = require('../middlware/roles');
const catchError = require('../utiles/catchError');
const c = require('../controller/platform');

// GET /notifications - Notifications page (all authenticated roles)
router.get('/', auth, roles('admin', 'chef', 'customer', 'delivery'), (req, res) => res.render('notifications', { currentUser: req.user, pageTitle: 'الإشعارات | دوق' }));

// GET /notifications/api - List notifications (all authenticated roles)
router.get('/api', auth, roles('admin', 'chef', 'customer', 'delivery'), catchError(c.listNotifications_controller));

// PATCH /notifications/api/:id/read - Mark notification as read (all authenticated roles)
router.patch('/api/:id/read', auth, roles('admin', 'chef', 'customer', 'delivery'), catchError(c.readNotification_controller));

module.exports = router;