/**
 * Payment routes (mounted at /payment).
 * Provides payment page for chefs, payment initiation, and Paymob webhook.
 */
const router = require("express").Router();
const auth = require("../middlware/auth");
const { initiateSubscription, paymobWebhook } = require("../controller/payment");
const catchError = require("../utiles/catchError");
const roles = require("../middlware/roles");
const { payment_render } = require("../rendering/payment");

// GET /payment - Payment page (chef only)
router.get('/', auth, roles('chef'), catchError(payment_render));

// POST /payment/initiate - Initiate Paymob payment (chef, requires auth)
router.post("/initiate", auth, initiateSubscription);

// POST /payment/webhook - Paymob webhook (no auth, external callback)
// Note: Ensure CSRF is disabled for this endpoint in security middleware
router.post("/webhook", paymobWebhook);

module.exports = router;