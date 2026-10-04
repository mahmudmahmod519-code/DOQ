const router = require("express").Router();
const auth = require("../middlware/auth");
const { initiateSubscription, paymobWebhook } = require("../controller/payment");
const catchError = require("../utiles/catchError");
const roles = require("../middlware/roles");
const { payment_render } = require("../rendering/payment");



router.get('/',auth,roles('chef'),catchError(payment_render));

// مسار يبدأ عملية الدفع (يحتاج تسجيل دخول)
router.post("/initiate", auth, initiateSubscription);

// مسار الـ Webhook الذي يستدعيه Paymob (لا يحتاج auth لأنه يأتي من Paymob)
// ملاحظة: تأكد من تعطيل csrf أو أي middleware يمنع الـ POST الخارجي على هذا المسار
router.post("/webhook", paymobWebhook);

module.exports = router;