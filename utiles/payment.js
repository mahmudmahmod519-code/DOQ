/**
 * Paymob payment integration helpers.
 * Provides: auth token retrieval, order registration, payment key generation,
 * and webhook HMAC verification (constant-time).
 */
const axios = require('axios');
const crypto = require('crypto');

const PAYMOB_API_KEY = process.env.PAYMOB_API_KEY;
const INTEGRATION_ID = process.env.PAYMOB_INTEGRATION_ID;
const IFRAME_ID = process.env.PAYMOB_IFRAME_ID;
const PRICE_IN_CENTS = process.env.SUBSCRIPTION_PRICE; // e.g., 10000 for 100 EGP

/**
 * Obtains a Paymob authentication token.
 * @returns {Promise<string>} Auth token for subsequent API calls.
 * @throws {Error} On network or API error.
 */
async function getPaymobAuthToken() {
    const response = await axios.post('https://accept.paymob.com/api/auth/tokens', {
        api_key: PAYMOB_API_KEY
    });
    return response.data.token;
}

/**
 * Registers an e-commerce order in Paymob.
 * @param {string} authToken - Token from getPaymobAuthToken().
 * @param {number} userId - Internal user ID.
 * @param {string} userName - User's full name.
 * @param {string} userEmail - User's email.
 * @param {string} userPhone - User's phone number.
 * @returns {Promise<number>} Paymob order ID.
 * @throws {Error} On network or API error.
 */
async function registerOrder(authToken, userId, userName, userEmail, userPhone) {
    const response = await axios.post('https://accept.paymob.com/api/ecommerce/orders', {
        auth_token: authToken,
        delivery_needed: "false",
        amount_cents: PRICE_IN_CENTS,
        currency: "EGP",
        items: [],
        merchant_order_id: `SUB_${userId}_${Date.now()}`, // unique merchant order ID
        customer: {
            first_name: userName.split(' ')[0],
            last_name: userName.split(' ').slice(1).join(' ') || '',
            email: userEmail,
            phone_number: userPhone,
        }
    });
    return response.data.id;
}

/**
 * Requests a payment key for the Paymob iframe/checkout.
 * @param {string} authToken - Auth token.
 * @param {number} orderId - Paymob order ID from registerOrder().
 * @param {string} userEmail - User's email.
 * @param {string} userPhone - User's phone.
 * @param {string} userName - User's full name.
 * @returns {Promise<string>} Payment key token.
 * @throws {Error} On network or API error.
 */
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

/**
 * Verifies a Paymob webhook HMAC signature (constant-time comparison).
 * Expects payload with nested `order` and `source_data` objects.
 * @param {Object} payload - Raw webhook JSON body.
 * @returns {boolean} true if HMAC matches, false otherwise.
 */
function verifyPaymobHmac(payload) {
    const secret = String(process.env.PAYMOB_HMAC_SECRET || '');
    const order = payload && payload.order && typeof payload.order === 'object' ? payload.order : {};
    const source = payload && payload.source_data && typeof payload.source_data === 'object' ? payload.source_data : {};
    if (!secret || !payload || !/^[a-f0-9]{128}$/i.test(String(payload.hmac || ''))) return false;

    // Field order must match Paymob's documented HMAC construction
    const values = [
        payload.amount_cents, payload.created_at, payload.currency, payload.error_occured,
        payload.has_parent_transaction, payload.id, payload.integration_id, payload.is_3d_secure,
        payload.is_auth, payload.is_capture, payload.is_refunded, payload.is_standalone_payment,
        payload.is_voided, order.id, payload.owner, payload.pending, source.pan, source.sub_type,
        source.type, payload.success
    ];

    const expected = crypto.createHmac('sha512', secret)
        .update(values.map(value => String(value ?? '')).join(''))
        .digest('hex');

    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(String(payload.hmac), 'hex'));
}

module.exports = {
    getPaymobAuthToken,
    registerOrder,
    getPaymentKey,
    verifyPaymobHmac
};