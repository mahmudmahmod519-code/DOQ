const pool = require("../database/pool");
const { getPaymobAuthToken, registerOrder, getPaymentKey, verifyPaymobHmac } = require("../utiles/payment");

function paymentsEnabled() {
    return String(process.env.PAYMENTS_ENABLED || 'false').trim().toLowerCase() === 'true';
}

function paymentsDisabled(res) {
    return res.status(410).json({
        status: 'disabled',
        code: 'PAYMENTS_DISABLED',
        message: 'الدفع الإلكتروني متوقف حالياً والدفع يتم عبر إنستاباي بعد التواصل مع الإدارة'
    });
}

// 1. بدء عملية الدفع (يتم استدعاؤها من الـ Frontend)
async function initiateSubscription(req, res) {
    if (!paymentsEnabled()) return paymentsDisabled(res);
    try {
        const userId = req.user.id;
        const userName = `${req.user.first_name} ${req.user.last_name}`;
        const userEmail = req.user.email;
        const userPhone = req.user.phone_number;

        // 1. Get Auth Token
        const authToken = await getPaymobAuthToken();
        
        // 2. Register Order
        const orderId = await registerOrder(authToken, userId, userName, userEmail, userPhone);
        
        // 3. Get Payment Key
        const paymentToken = await getPaymentKey(authToken, orderId, userEmail, userPhone, userName);

        // 4. Return Iframe URL to Frontend
        const iframeUrl = `https://accept.paymob.com/api/acceptance/iframes/${process.env.PAYMOB_IFRAME_ID}?payment_token=${paymentToken}`;
        
        res.status(200).json({
            status: 'success',
            data: { iframe_url: iframeUrl, order_id: orderId }
        });
    } catch (error) {
        console.error("Paymob Initiation Error:", error && error.message);
        res.status(500).json({ status: 'error', message: 'فشل في بدء عملية الدفع' });
    }
}

// 2. Webhook لاستقبال إشعار الدفع الناجح من Paymob
async function paymobWebhook(req, res) {
    if (!paymentsEnabled()) return paymentsDisabled(res);
    try {
        const payload = req.body;
        
        // التحقق من صحة الـ HMAC
        const isValid = verifyPaymobHmac(payload);
        if (!isValid) {
            return res.status(400).json({ status: 'error', message: 'Invalid HMAC' });
        }

        const eventId = String(payload.id || '').trim();
        const merchantOrderId = String(payload.order?.merchant_order_id || '');
        const match = /^SUB_(\d+)_\d+$/.exec(merchantOrderId);
        if (!eventId || !match || (process.env.PAYMOB_INTEGRATION_ID && String(payload.integration_id) !== String(process.env.PAYMOB_INTEGRATION_ID))) {
            return res.status(400).json({ status: 'error', message: 'Invalid payment reference' });
        }
        const [event] = await pool.query('INSERT IGNORE INTO payment_webhook_events (event_id) VALUES (?)', [eventId]);
        if (!event.affectedRows) return res.status(200).json({ status: 'success' });

        // التحقق من أن العملية ناجحة وهي عملية دفع وليست Refund
        if ((payload.success === true || payload.success === 'true') && payload.is_refunded !== true && payload.is_refunded !== 'true') {
            const userId = Number(match[1]);

            // حساب تاريخ الانتهاء (شهر من الآن)
            const now = new Date();
            const endDate = new Date(now.setMonth(now.getMonth() + 1));

            // تحديث حالة المستخدم في قاعدة البيانات
            await pool.query(
                `UPDATE users SET subscription_status = 'active', subscription_ends_at = ? WHERE id = ? AND roles = 'chef'`,
                [endDate, userId]
            );
        }

        // يجب الرد على Paymob بـ 200 OK فوراً
        res.status(200).json({ status: 'success' });
    } catch (error) {
        console.error("Paymob Webhook Error:", error && error.message);
        res.status(500).json({ status: 'error' });
    }
}

// 3. التحقق من حالة الاشتراك (Middleware)
async function checkSubscription(req, res, next) {
    // تعطيل الدفع يوقف بوابة باي موب فقط ولا يقفل أي مسار للمطبخ
    if (!paymentsEnabled()) return next();
    try {
        const userId = req.user.id;
        const [users] = await pool.query(
            `SELECT subscription_status, subscription_ends_at FROM users WHERE id = ?`,
            [userId]
        );

        if (users.length === 0) {
            return res.status(404).json({ status: 'error', message: 'المستخدم غير موجود' });
        }

        const user = users[0];
        const now = new Date();
        const endDate = user.subscription_ends_at ? new Date(user.subscription_ends_at) : null;

        if (user.subscription_status !== 'active' || (endDate && endDate < now)) {
            return res.status(403).json({ 
                status: 'error', 
                message: 'اشتراكك غير فعال أو منتهي الصلاحية. يرجى تجديد الاشتراك.',
                code: 'SUBSCRIPTION_EXPIRED'
            });
        }

        next();
    } catch (error) {
        console.error("Subscription Check Error:", error && error.message);
        res.status(500).json({ status: 'error', message: 'خطأ في الخادم' });
    }
}

module.exports = {
    initiateSubscription,
    paymobWebhook,
    checkSubscription,
    paymentsEnabled
};
