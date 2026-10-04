const axios = require('axios');
const crypto = require('crypto');

const PAYMOB_API_KEY = process.env.PAYMOB_API_KEY;
const INTEGRATION_ID = process.env.PAYMOB_INTEGRATION_ID;
const IFRAME_ID = process.env.PAYMOB_IFRAME_ID;
const PRICE_IN_CENTS = process.env.SUBSCRIPTION_PRICE; // مثلاً 10000 لـ 100 جنيه

// 1. الحصول على توكن المصادقة
async function getPaymobAuthToken() {
    const response = await axios.post('https://accept.paymob.com/api/auth/tokens', {
        api_key: PAYMOB_API_KEY
    });
    return response.data.token;
}

// 2. تسجيل الطلب في Paymob
async function registerOrder(authToken, userId, userName, userEmail, userPhone) {
    const response = await axios.post('https://accept.paymob.com/api/ecommerce/orders', {
        auth_token: authToken,
        delivery_needed: "false",
        amount_cents: PRICE_IN_CENTS,
        currency: "EGP",
        items: [],
        merchant_order_id: `SUB_${userId}_${Date.now()}`, // رقم طلب فريد
        customer: {
            first_name: userName.split(' ')[0],
            last_name: userName.split(' ').slice(1).join(' ') || '',
            email: userEmail,
            phone_number: userPhone,
        }
    });
    return response.data.id;
}

// 3. الحصول على مفتاح الدفع (Payment Key)
async function getPaymentKey(authToken, orderId, userEmail, userPhone, userName) {
    const response = await axios.post('https://accept.paymob.com/api/acceptance/payment_keys', {
        auth_token: authToken,
        amount_cents: PRICE_IN_CENTS,
        expiration: 3600,
        order_id: orderId,
        billing_data: {
            apartment: "NA",
            email: userEmail,
            floor: "NA",
            first_name: userName.split(' ')[0],
            street: "NA",
            building: "NA",
            phone_number: userPhone,
            shipping_method: "NA",
            postal_code: "NA",
            city: "Cairo",
            country: "EG",
            last_name: userName.split(' ').slice(1).join(' ') || '',
            state: "NA"
        },
        currency: "EGP",
        integration_id: INTEGRATION_ID
    });
    return response.data.token;
}

// 4. التحقق من صحة الـ Webhook (HMAC)
function verifyPaymobHmac(payload) {
    const secret = String(process.env.PAYMOB_HMAC_SECRET || '');
    const order = payload && payload.order && typeof payload.order === 'object' ? payload.order : {};
    const source = payload && payload.source_data && typeof payload.source_data === 'object' ? payload.source_data : {};
    if (!secret || !payload || !/^[a-f0-9]{128}$/i.test(String(payload.hmac || ''))) return false;
    const values = [payload.amount_cents, payload.created_at, payload.currency, payload.error_occured,
        payload.has_parent_transaction, payload.id, payload.integration_id, payload.is_3d_secure,
        payload.is_auth, payload.is_capture, payload.is_refunded, payload.is_standalone_payment,
        payload.is_voided, order.id, payload.owner, payload.pending, source.pan, source.sub_type,
        source.type, payload.success];
    const expected = crypto.createHmac('sha512', secret).update(values.map(value => String(value ?? '')).join('')).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(String(payload.hmac), 'hex'));
}

module.exports = {
    getPaymobAuthToken,
    registerOrder,
    getPaymentKey,
    verifyPaymobHmac
};
