/**
 * Platform controller: coupons, referrals, favorites, notifications, and chat.
 * All endpoints require authenticated user (roles: chef, customer, etc.).
 */
const crypto = require('crypto');
const pool = require('../database/pool');

/**
 * Standard error response helper.
 * @param {Object} res - Express response.
 * @param {number} status - HTTP status code.
 * @param {string} message - Error message.
 * @returns {Object} Response object.
 */
function respondError(res, status, message) {
    return res.status(status).json({ status: 'error', message });
}

/**
 * Parses an expiry string to a Date object.
 * @param {string|Date} value - Expiry value.
 * @returns {Date|null} Parsed Date or null if invalid.
 */
function parseExpiry(value) {
    const date = new Date(String(value || ''));
    return Number.isNaN(date.getTime()) ? null : date;
}

// ============================================
// Coupons
// ============================================

/**
 * Creates a coupon for a dish owned by the chef.
 * Generates a unique code (retries up to 5 times on collision).
 * @param {Object} req - req.user.id (chef); body: dish_id, discount_percent, expires_at.
 * @param {Object} res - Express response.
 * @returns {Promise<void>} 201 with coupon data, 400/403 on invalid input/ownership.
 */
async function createCoupon_controller(req, res) {
    const dishId = Number(req.body.dish_id);
    const discount = Number(req.body.discount_percent);
    const expiresAt = parseExpiry(req.body.expires_at);
    if (!Number.isInteger(dishId) || !Number.isFinite(discount) || discount < 1 || discount > 90 || !expiresAt || expiresAt <= new Date()) {
        return respondError(res, 400, 'بيانات الكوبون غير صحيحة');
    }
    const [[dish]] = await pool.query(
        'SELECT d.id,d.name,d.kitchen_id,k.user_id FROM dishes d JOIN kitchens k ON k.id=d.kitchen_id WHERE d.id=? AND k.user_id=? LIMIT 1',
        [dishId, req.user.id]
    );
    if (!dish) return respondError(res, 403, 'الطبق ليس ضمن مطبخك');

    for (let attempt = 0; attempt < 5; attempt += 1) {
        const code = 'DOQ-' + crypto.randomBytes(4).toString('hex').toUpperCase();
        try {
            await pool.query(
                'INSERT INTO dish_coupons (kitchen_id,dish_id,code,discount_percent,expires_at) VALUES (?,?,?,?,?)',
                [dish.kitchen_id, dishId, code, Number(discount.toFixed(2)), expiresAt]
            );
            return res.status(201).json({
                status: 'success',
                message: 'تم إنشاء الكوبون',
                data: { code, dish_id: dishId, dish_name: dish.name, discount_percent: Number(discount.toFixed(2)), expires_at: expiresAt.toISOString() }
            });
        } catch (error) {
            if (error.code !== 'ER_DUP_ENTRY' || attempt === 4) throw error;
        }
    }
}

/**
 * Lists coupons for a dish owned by the chef (non-deleted, latest 20).
 * @param {Object} req - req.user.id (chef); params.dishId.
 * @param {Object} res - Express response.
 * @returns {Promise<void>} 200 with coupons array, 404 if dish not found/owned.
 */
async function listMyDishCoupons_controller(req, res) {
    const dishId = Number(req.params.dishId);
    const [[dish]] = await pool.query(
        'SELECT d.id FROM dishes d JOIN kitchens k ON k.id=d.kitchen_id WHERE d.id=? AND k.user_id=? LIMIT 1',
        [dishId, req.user.id]
    );
    if (!dish) return respondError(res, 404, 'الطبق غير موجود');
    const [rows] = await pool.query(
        'SELECT code,discount_percent,expires_at,created_at FROM dish_coupons WHERE dish_id=? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 20',
        [dishId]
    );
    return res.json({ status: 'success', data: rows });
}

/**
 * Validates a coupon for a dish and returns discount info (customer).
 * Checks: valid code, not expired, not already redeemed by this customer.
 * @param {Object} req - req.user.id (customer); body: dish_id, quantity, code.
 * @param {Object} res - Express response.
 * @returns {Promise<void>} 200 with discount breakdown, 400/409 on invalid/used.
 */
async function validateCoupon_controller(req, res) {
    const dishId = Number(req.body.dish_id);
    const quantity = Number(req.body.quantity);
    const code = String(req.body.code || '').trim().toUpperCase();
    if (!Number.isInteger(dishId) || !Number.isInteger(quantity) || quantity < 1 || quantity > 50 || !code) {
        return respondError(res, 400, 'اكتب كود الكوبون والكمية بشكل صحيح');
    }
    const [[row]] = await pool.query(
        'SELECT c.id,c.discount_percent,d.price FROM dish_coupons c JOIN dishes d ON d.id=c.dish_id WHERE c.code=? AND c.dish_id=? AND c.expires_at>UTC_TIMESTAMP() AND c.deleted_at IS NULL LIMIT 1',
        [code, dishId]
    );
    if (!row) return respondError(res, 400, 'الكوبون غير صحيح أو انتهت صلاحيته');
    const [[used]] = await pool.query(
        'SELECT id FROM coupon_redemptions WHERE coupon_id=? AND customer_id=? LIMIT 1',
        [row.id, req.user.id]
    );
    if (used) return respondError(res, 409, 'استخدمت هذا الكوبون من قبل');
    const gross = Number((Number(row.price) * quantity).toFixed(2));
    const discount = Number((gross * Number(row.discount_percent) / 100).toFixed(2));
    return res.json({
        status: 'success',
        data: { code, discount_percent: Number(row.discount_percent), discount_amount: discount, total_price: Number((gross - discount).toFixed(2)) }
    });
}

// ============================================
// Referrals
// ============================================

/**
 * Creates a referral link for a dish (chef).
 * @param {Object} req - req.user.id (chef); body: dish_id.
 * @param {Object} res - Express response.
 * @returns {Promise<void>} 201 with token and share_url, 404 if dish not found.
 */
async function createReferral_controller(req, res) {
    const dishId = Number(req.body.dish_id);
    const [dish] = await pool.query('SELECT id FROM dishes WHERE id=? LIMIT 1', [dishId]);
    if (!dish.length) return respondError(res, 404, 'الطبق غير موجود');
    const token = crypto.randomUUID();
    await pool.query('INSERT INTO dish_referrals (dish_id,referrer_id,token) VALUES (?,?,?)', [dishId, req.user.id, token]);
    return res.status(201).json({ status: 'success', data: { token, share_url: '/share/dish/' + token } });
}

// ============================================
// Favorites
// ============================================

/**
 * Adds a dish to customer's favorites (idempotent via INSERT IGNORE).
 * @param {Object} req - req.user.id (customer); params.dishId.
 * @param {Object} res - Express response.
 * @returns {Promise<void>} 200 with success message.
 */
async function addFavourite_controller(req, res) {
    await pool.query('INSERT IGNORE INTO favourite_dishes (customer_id,dish_id) VALUES (?,?)', [req.user.id, Number(req.params.dishId)]);
    return res.json({ status: 'success', message: 'تمت إضافة الطبق للمفضلة' });
}

/**
 * Removes a dish from customer's favorites.
 * @param {Object} req - req.user.id (customer); params.dishId.
 * @param {Object} res - Express response.
 * @returns {Promise<void>} 200 with success message.
 */
async function removeFavourite_controller(req, res) {
    await pool.query('DELETE FROM favourite_dishes WHERE customer_id=? AND dish_id=?', [req.user.id, Number(req.params.dishId)]);
    return res.json({ status: 'success', message: 'تم حذف الطبق من المفضلة' });
}

/**
 * Lists customer's favorite dishes with kitchen info.
 * @param {Object} req - req.user.id (customer).
 * @param {Object} res - Express response.
 * @returns {Promise<void>} 200 with favorites array.
 */
async function listFavourites_controller(req, res) {
    const [rows] = await pool.query(
        'SELECT d.id,d.name,d.price,d.image_url,k.title AS kitchen_name FROM favourite_dishes f JOIN dishes d ON d.id=f.dish_id JOIN kitchens k ON k.id=d.kitchen_id WHERE f.customer_id=? ORDER BY f.created_at DESC',
        [req.user.id]
    );
    return res.json({ status: 'success', data: rows });
}

// ============================================
// Notifications
// ============================================

/**
 * Lists latest 100 notifications for the user.
 * @param {Object} req - req.user.id.
 * @param {Object} res - Express response.
 * @returns {Promise<void>} 200 with notifications array.
 */
async function listNotifications_controller(req, res) {
    const [rows] = await pool.query(
        'SELECT id,type,title,body,read_at,created_at FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 100',
        [req.user.id]
    );
    return res.json({ status: 'success', data: rows });
}

/**
 * Marks a notification as read (by ID and ownership).
 * @param {Object} req - req.user.id; params.id.
 * @param {Object} res - Express response.
 * @returns {Promise<void>} 200 on success.
 */
async function readNotification_controller(req, res) {
    await pool.query('UPDATE notifications SET read_at=NOW() WHERE id=? AND user_id=?', [Number(req.params.id), req.user.id]);
    return res.json({ status: 'success' });
}

// ============================================
// Chat
// ============================================

/**
 * Sanitizes chat message body: removes external links, phone numbers, contact info.
 * @param {string} value - Raw message body.
 * @returns {string|null} Sanitized body or null if rejected.
 */
function cleanChatBody(value) {
    const body = String(value || '').trim();
    const compact = body.replace(/[\s()._-]/g, '');
    const hasExternalChannel = /<[^>]+>|(?:https?:\/\/|www\.|t\.me|wa\.me|bit\.ly|tinyurl|telegram|whatsapp|facebook|instagram|واتساب|تليجرام|إنستاباي|انستا\s*باي|فودافون\s*كاش|اتصالات\s*كاش|اورنج\s*كاش|we\s*pay)|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|@[A-Za-z0-9._]{3,}/i.test(body);
    const hasPhoneOrContactRequest = /(?:\+?20|0)?1[0125]\d{8}/.test(compact) || /(?:اتصل|كلمني|كلميني|رقمي|رقمك|تواصل\s*معي|تواصل\s*معاك|ابعتلي|ابعتيلي|محفظة)/i.test(body);
    if (!body || body.length > 1000 || hasExternalChannel || hasPhoneOrContactRequest) return null;
    return body;
}

/**
 * Sends a chat message within an order (customer <-> chef).
 * Validates ownership, sanitizes body, inserts message.
 * @param {Object} req - req.user.id; params.publicId; body: message body.
 * @param {Object} res - Express response.
 * @returns {Promise<void>} 201 with message data, 400/403/404 on error.
 */
async function sendChatMessage_controller(req, res) {
    const body = cleanChatBody(req.body.body);
    if (!body) return respondError(res, 400, 'الرسالة فارغة أو تحتوي على رابط أو محتوى خارجي');
    const [orders] = await pool.query(
        'SELECT o.id,o.customer_id,k.user_id AS chef_id FROM orders o JOIN kitchens k ON k.id=o.kitchen_id WHERE o.public_id=? LIMIT 1',
        [req.params.publicId]
    );
    if (!orders.length) return respondError(res, 404, 'الطلب غير موجود');
    const order = orders[0];
    if (![order.customer_id, order.chef_id].includes(req.user.id)) return respondError(res, 403, 'المحادثة ليست ضمن صلاحياتك');
    const recipientId = req.user.id === order.customer_id ? order.chef_id : order.customer_id;
    const [result] = await pool.query(
        'INSERT INTO chat_messages (order_id,sender_id,recipient_id,body) VALUES (?,?,?,?)',
        [order.id, req.user.id, recipientId, body]
    );
    return res.status(201).json({ status: 'success', data: { id: result.insertId, body } });
}

/**
 * Lists chat messages for an order (latest 200, sanitized).
 * @param {Object} req - req.user.id; params.publicId.
 * @param {Object} res - Express response.
 * @returns {Promise<void>} 200 with messages array (blocked content replaced).
 */
async function listChatMessages_controller(req, res) {
    const [orders] = await pool.query(
        'SELECT o.id,o.customer_id,k.user_id AS chef_id FROM orders o JOIN kitchens k ON k.id=o.kitchen_id WHERE o.public_id=? LIMIT 1',
        [req.params.publicId]
    );
    if (!orders.length) return respondError(res, 404, 'الطلب غير موجود');
    const order = orders[0];
    if (![order.customer_id, order.chef_id].includes(req.user.id)) return respondError(res, 403, 'المحادثة ليست ضمن صلاحياتك');
    const [messages] = await pool.query(
        'SELECT id,sender_id,body,created_at FROM chat_messages WHERE order_id=? ORDER BY created_at ASC LIMIT 200',
        [order.id]
    );
    const blocked = '\u062a\u0645 \u062d\u062c\u0628 \u0645\u062d\u062a\u0648\u0649 \u062e\u0627\u0631\u062c\u064a';
    return res.json({
        status: 'success',
        data: messages.map(message => ({ ...message, body: cleanChatBody(message.body) || blocked }))
    });
}

module.exports = {
    createCoupon_controller,
    listMyDishCoupons_controller,
    validateCoupon_controller,
    createReferral_controller,
    addFavourite_controller,
    removeFavourite_controller,
    listFavourites_controller,
    listNotifications_controller,
    readNotification_controller,
    sendChatMessage_controller,
    listChatMessages_controller,
    cleanChatBody
};