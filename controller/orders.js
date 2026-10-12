/**
 * Orders controller: customer orders, delivery orders, chef orders, admin listings,
 * order creation with idempotency, coupons, delivery assignment/acceptance,
 * status transitions, vehicle management, and pending user approvals.
 */
const crypto = require('crypto');
const pool = require('../database/pool');
const transaction = require('../utiles/transaction');
const { notify, admins } = require('../utiles/notifications');

const VALID_STATUSES = new Set(['pending', 'chef_accepted', 'out_for_delivery', 'accepted', 'completed', 'cancelled']);
const STATUS_LABEL = { pending: 'قيد التنفيذ', chef_accepted: 'مقبول من المطبخ', out_for_delivery: 'مع الدليفري', accepted: 'قيد التوصيل', completed: 'اتسلم', cancelled: 'اتلغى' };

/**
 * Parses and validates quantity (1-50 integer).
 * @param {any} value - Input value.
 * @returns {number|null} Validated quantity or null.
 */
function parseQuantity(value) {
    const quantity = Number(value);
    return Number.isInteger(quantity) && quantity >= 1 && quantity <= 50 ? quantity : null;
}

/**
 * Generates a short order code from public_id (first 8 chars uppercase).
 * @param {string} publicId - UUID public_id.
 * @returns {string} Short order code.
 */
const orderCode = publicId => String(publicId).slice(0, 8).toUpperCase();

/**
 * Adds order_code to each row in an array.
 * @param {Array} rows - Order rows with public_id.
 * @returns {Array} Rows with order_code added.
 */
const withCode = rows => rows.map(row => ({ ...row, order_code: orderCode(row.public_id) }));

// ============================================
// 1. Create Order (customer)
// ============================================

/**
 * Creates a new order with idempotency, coupon support, delivery fee, and notifications.
 * Uses transaction for atomicity. Notifies chef, all delivery users, and admins.
 * @param {Object} req - Authenticated customer; body: quantity, dish_id, coupon_code, order_name; header: Idempotency-Key.
 * @param {Object} res - Express response.
 * @returns {Promise<void>} 201 with order details, 200 if duplicate, 400/404/409 on validation/ownership/coupon errors.
 */
async function createOrder_controller(req, res) {
    const quantity = parseQuantity(req.body.quantity);
    const dishId = Number(req.body.dish_id);
    const couponCode = String(req.body.coupon_code || '').trim().toUpperCase();
    const orderName = String(req.body.order_name || '').replace(/\s+/g, ' ').trim();

    if (!Number.isInteger(dishId) || !quantity) {
        return res.status(400).json({ status: 'error', message: 'الكمية لازم تكون رقم من 1 لـ 50' });
    }
    if (orderName.length < 2 || orderName.length > 60) {
        return res.status(400).json({ status: 'error', message: 'اكتب اسم للطلب من 2 لـ 60 حرف' });
    }

    const idem = String(req.get('Idempotency-Key') || '').trim().slice(0, 100) || null;
    if (!idem) {
        return res.status(400).json({ status: 'error', message: 'مفتاح الطلب مطلوب' });
    }

    const [rows] = await pool.query(
        `SELECT d.id AS dish_id,d.name AS dish_name,d.price,k.id AS kitchen_id,k.title AS kitchen_name,
                k.phone_number AS kitchen_phone,k.address AS kitchen_address,k.delivery_fee AS delivery_fee_amount,
                k.user_id AS chef_id
         FROM dishes d
         JOIN kitchens k ON k.id=d.kitchen_id
         JOIN users chef ON chef.id=k.user_id
         WHERE d.id=? AND k.status='ACTIVE' AND chef.account_status='approved' LIMIT 1`,
        [dishId]
    );

    if (!rows.length) {
        return res.status(404).json({ status: 'error', message: 'الطبق ده مش متاح للطلب دلوقتي' });
    }

    const dish = rows[0];
    const gross = Number((Number(dish.price) * quantity).toFixed(2));
    const publicId = crypto.randomUUID();

    const result = await transaction(async db => {
        // Idempotency check
        const [old] = await db.query(
            'SELECT public_id,dish_name,quantity,discount_amount,total_price,status FROM orders WHERE customer_id=? AND idempotency_key=? LIMIT 1',
            [req.user.id, idem]
        );
        if (old.length) return { duplicate: old[0] };

        let couponId = null, discountPercent = 0;

        // Coupon validation
        if (couponCode) {
            const [[coupon]] = await db.query(
                `SELECT id,discount_percent FROM dish_coupons WHERE code=? AND dish_id=? AND expires_at>UTC_TIMESTAMP() AND deleted_at IS NULL LIMIT 1 FOR UPDATE`,
                [couponCode, dish.dish_id]
            );
            if (!coupon) return { error: 400, message: 'الكوبون غلط أو انتهت صلاحيته' };
            const [[used]] = await db.query(
                'SELECT id FROM coupon_redemptions WHERE coupon_id=? AND customer_id=? LIMIT 1 FOR UPDATE',
                [coupon.id, req.user.id]
            );
            if (used) return { error: 409, message: 'استخدمت الكوبون ده من قبل' };
            couponId = coupon.id;
            discountPercent = Number(coupon.discount_percent);
        }

        const discount = Number((gross * discountPercent / 100).toFixed(2));
        const total = Number((gross - discount).toFixed(2));
        const customerAddress = [req.user.city, req.user.address].filter(Boolean).join(' - ') || null;

        const [created] = await db.query(
            `INSERT INTO orders
            (public_id,idempotency_key,customer_id,dish_id,kitchen_id,customer_name,customer_phone,customer_address,order_name,dish_name,kitchen_name,kitchen_phone,kitchen_address,quantity,unit_price,discount_amount,total_price,delivery_fee_amount,coupon_id,expires_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 30 DAY))`,
            [publicId, idem, req.user.id, dish.dish_id, dish.kitchen_id,
             [req.user.first_name, req.user.last_name].filter(Boolean).join(' '),
             req.user.phone_number, customerAddress, orderName,
             dish.dish_name, dish.kitchen_name, dish.kitchen_phone, dish.kitchen_address,
             quantity, dish.price, discount, total, dish.delivery_fee_amount, couponId]
        );

        if (couponId) {
            await db.query('INSERT INTO coupon_redemptions (coupon_id,customer_id,order_id) VALUES (?,?,?)', [couponId, req.user.id, created.insertId]);
        }

        const code = orderCode(publicId);
        await notify(db, dish.chef_id, 'new_order', 'طلب جديد', `طلب ${code}: ${dish.dish_name} بعدد ${quantity}`, 'order', created.insertId, `order:${created.insertId}:new`);

        await admins(db, 'new_order', 'طلب جديد', `طلب ${code} من ${dish.kitchen_name} في انتظار قبول المطبخ`, 'order', created.insertId);

        // Notify the customer who placed the order
        await notify(db, req.user.id, 'order_created', 'تم إنشاء طلبك', `تم إنشاء طلبك ${code}: ${dish.dish_name} بنجاح`, 'order', created.insertId, `order:${created.insertId}:customer`);

        return { createdId: created.insertId, discount, total };
    });

    if (result.error) return res.status(result.error).json({ status: 'error', message: result.message });
    if (result.duplicate) return res.status(200).json({ status: 'success', message: 'الطلب ده اتسجل قبل كده', data: result.duplicate });

    return res.status(201).json({
        status: 'success',
        message: 'تم إرسال الطلب للمطبخ بنجاح. في انتظار قبول المطبخ',
        data: {
            public_id: publicId,
            order_code: orderCode(publicId),
            order_name: orderName,
            dish_name: dish.dish_name,
            quantity,
            discount_amount: result.discount,
            total_price: result.total,
            coupon_code: couponCode || null,
            status: 'pending'
        }
    });
}

// ============================================
// 1.5. Chef Accepts Order (NEW)
// ============================================

/**
 * Chef accepts a pending order for their kitchen.
 * Changes status from 'pending' to 'chef_accepted'.
 * Notifies ALL delivery users with full order details (customer + kitchen info).
 * @param {Object} req - Authenticated chef; params.publicId.
 * @param {Object} res - Express response.
 * @returns {Promise<void>} 200 on success, 403/404/409 on permission/state errors.
 */
async function chefAcceptOrder_controller(req, res) {
    const result = await transaction(async db => {
        // 1. Verify order belongs to chef's kitchen and is pending
        const [[order]] = await db.query(
            `SELECT o.id, o.public_id, o.customer_id, o.dish_name, o.kitchen_name, o.kitchen_phone, o.kitchen_address, o.customer_name, o.customer_phone, o.customer_address, o.order_name, o.quantity, o.total_price, k.user_id AS chef_id
             FROM orders o
             JOIN kitchens k ON k.id=o.kitchen_id
             WHERE o.public_id=? AND o.status='pending' AND k.user_id=? FOR UPDATE`,
            [req.params.publicId, req.user.id]
        );
        
        if (!order) {
            return { error: 409, message: 'الطلب غير موجود، ليس لمطبخك، أو تم قبوله مسبقاً' };
        }
        
        // 2. Update status to chef_accepted
        const [updated] = await db.query(
            "UPDATE orders SET status='chef_accepted', chef_accepted_at=UTC_TIMESTAMP() WHERE id=? AND status='pending'",
            [order.id]
        );
        
        if (!updated.affectedRows) {
            return { error: 409, message: 'الطلب تم قبوله من قبل' };
        }
        
        const code = orderCode(order.public_id);
        
        // 3. Notify ALL approved delivery users with FULL order details
        const [deliveries] = await db.query("SELECT id FROM users WHERE roles='delivery' AND account_status='approved'");
        for (const delivery of deliveries) {
            await notify(db, delivery.id, 'delivery_offer', 'طلب توصيل جديد', 
                `طلب ${code}: ${order.dish_name} × ${order.quantity} - ${order.total_price} ج.م\n` +
                `المطبخ: ${order.kitchen_name}\n` +
                `العنوان: ${order.kitchen_address}\n` +
                `الهاتف: ${order.kitchen_phone}\n` +
                `العميل: ${order.customer_name}\n` +
                `هاتف العميل: ${order.customer_phone}\n` +
                `عنوان العميل: ${order.customer_address || 'غير محدد'}\n` +
                `اسم الطلب: ${order.order_name}`,
                'order', order.id, `order:${order.id}:offer:${delivery.id}`);
        }
        
        // 4. Notify chef
        await notify(db, order.chef_id, 'order_chef_accepted', 'تم قبول طلبك', 
            `لقد قبِلت طلب ${code}: ${order.dish_name}`, 'order', order.id, `order:${order.id}:chef_accepted:${req.user.id}`);
        
        // 5. Notify customer
        await notify(db, order.customer_id, 'order_chef_accepted', 'تم قبول طلبك من المطبخ', 
            `المطبخ قبل طلبك ${code}: ${order.dish_name}. جاري البحث عن مندوب توصيل.`, 'order', order.id, `order:${order.id}:customer_chef_accepted`);
        
        // 6. Notify admins
        await admins(db, 'order_chef_accepted', 'طلب تم قبوله من المطبخ', 
            `طلب ${code} من ${order.kitchen_name} تم قبوله. في انتظار مندوب توصيل.`, 'order', order.id);
        
        return { ok: true };
    });
    
    if (result.error) {
        return res.status(result.error).json({ status: 'error', message: result.message });
    }
    
    return res.json({ status: 'success', message: 'تم قبول الطلب. تم إشعارات شركات التوصيل.' });
}

// ============================================
// 1.6. Chef Hands Order to Delivery (NEW)
// ============================================

/**
 * Chef marks order as handed to delivery (chef_accepted → out_for_delivery).
 * Notifies delivery user and customer.
 * @param {Object} req - Authenticated chef; params.publicId.
 * @param {Object} res - Express response.
 * @returns {Promise<void>} 200 on success.
 */
async function chefHandoffOrder_controller(req, res) {
    const result = await transaction(async db => {
        // 1. Verify order belongs to chef's kitchen and is chef_accepted
        const [[order]] = await db.query(
            `SELECT o.id, o.public_id, o.customer_id, o.dish_name, o.kitchen_name, o.kitchen_phone, o.kitchen_address, o.customer_name, o.customer_phone, o.customer_address, o.order_name, o.quantity, o.total_price, o.delivery_id, k.user_id AS chef_id
             FROM orders o
             JOIN kitchens k ON k.id=o.kitchen_id
             WHERE o.public_id=? AND o.status='chef_accepted' AND k.user_id=? FOR UPDATE`,
            [req.params.publicId, req.user.id]
        );
        
        if (!order) {
            return { error: 409, message: 'الطلب غير موجود، ليس لمطبخك، أو ليس في حالة مقبول من المطبخ' };
        }
        
        if (!order.delivery_id) {
            return { error: 400, message: 'لا يوجد مندوب توصيل مخصص لهذا الطلب بعد' };
        }
        
        // 2. Update status to out_for_delivery
        const [updated] = await db.query(
            "UPDATE orders SET status='out_for_delivery', out_for_delivery_at=UTC_TIMESTAMP() WHERE id=? AND status='chef_accepted'",
            [order.id]
        );
        
        if (!updated.affectedRows) {
            return { error: 409, message: 'الطلب تم تحديثه من قبل' };
        }
        
        const code = orderCode(order.publicId || order.public_id);
        
        // 3. Notify the delivery user
        await notify(db, order.delivery_id, 'order_out_for_delivery', 'الطلب معك الآن', 
            `طلب ${code}: ${order.dish_name} × ${order.quantity} - ${order.total_price} ج.م\n` +
            `المطبخ: ${order.kitchen_name}\n` +
            `العنوان: ${order.kitchen_address}\n` +
            `الهاتف: ${order.kitchen_phone}\n` +
            `العميل: ${order.customer_name}\n` +
            `هاتف العميل: ${order.customer_phone}\n` +
            `عنوان العميل: ${order.customer_address || 'غير محدد'}\n` +
            `اسم الطلب: ${order.order_name}`,
            'order', order.id, `order:${order.id}:out_for_delivery:${order.delivery_id}`);
        
        // 4. Notify customer
        await notify(db, order.customer_id, 'order_out_for_delivery', 'طلبك مع مندوب التوصيل', 
            `مطبخ ${order.kitchen_name} سلم طلبك ${code}: ${order.dish_name} للمندوب. جارٍ التوصيل إليك.`, 'order', order.id, `order:${order.id}:customer_out_for_delivery`);
        
        // 5. Notify chef
        await notify(db, order.chef_id, 'order_handoff', 'تم تسليم الطلب للمندوب', 
            `لقد سلمت طلب ${code}: ${order.dish_name} للمندوب.`, 'order', order.id, `order:${order.id}:chef_handoff:${req.user.id}`);
        
        // 6. Notify admins
        await admins(db, 'order_handoff', 'طلب تم تسليمه للمندوب', 
            `طلب ${code} من ${order.kitchen_name} تم تسليمه للمندوب للتوصيل.`, 'order', order.id);
        
        return { ok: true };
    });
    
    if (result.error) {
        return res.status(result.error).json({ status: 'error', message: result.message });
    }
    
    return res.json({ status: 'success', message: 'تم تسليم الطلب للمندوب. تم إشعار المندوب والعميل.' });
}

// ============================================
// 2. Customer Orders List
// ============================================

/**
 * Returns the authenticated customer's last 100 orders with short codes.
 * @param {Object} req - Authenticated customer.
 * @param {Object} res - Express response.
 * @returns {Promise<void>} 200 with orders array.
 */
async function getCustomerOrders_controller(req, res) {
    const [orders] = await pool.query(
        `SELECT public_id,order_name,dish_name,kitchen_name,quantity,unit_price,discount_amount,total_price,status,delivery_id IS NOT NULL AS has_delivery,created_at,completed_at
         FROM orders WHERE customer_id=? ORDER BY created_at DESC LIMIT 100`,
        [req.user.id]
    );
    return res.json({ status: 'success', data: withCode(orders) });
}

// ============================================
// 3. Delivery Orders List
// ============================================

/**
 * Returns orders for a delivery user: chef_accepted unassigned + their own assigned/accepted.
 * Includes customer details only for assigned orders (privacy).
 * Supports filtering by kitchen_id.
 * @param {Object} req - Authenticated delivery user; query: kitchen_id (optional).
 * @param {Object} res - Express response.
 * @returns {Promise<void>} 200 with orders array.
 */
async function getDeliveryOrders_controller(req, res) {
    const kitchenId = req.query.kitchen_id ? Number(req.query.kitchen_id) : null;
    
    let whereClause = `(o.status='chef_accepted' AND o.delivery_id IS NULL) OR o.delivery_id=?`;
    let params = [req.user.id, req.user.id, req.user.id, req.user.id];
    
    if (kitchenId) {
        whereClause += ` AND k.id = ?`;
        params.push(kitchenId);
    }
    
    const [orders] = await pool.query(
        `SELECT o.public_id,o.order_name,
                CASE WHEN o.delivery_id=? THEN o.customer_name ELSE NULL END AS customer_name,
                CASE WHEN o.delivery_id=? THEN o.customer_phone ELSE NULL END AS customer_phone,
                CASE WHEN o.delivery_id=? THEN o.customer_address ELSE NULL END AS customer_address,
                o.dish_name,o.unit_price,o.kitchen_name,o.kitchen_phone,o.kitchen_address,
                o.quantity,o.total_price,o.status,o.created_at,o.completed_at,
                o.delivery_id,v.id AS vehicle_id,v.label AS vehicle_label
         FROM orders o
         LEFT JOIN delivery_vehicles v ON v.id=o.vehicle_id
         JOIN kitchens k ON k.id=o.kitchen_id
         WHERE ${whereClause}
         ORDER BY CASE WHEN o.status='chef_accepted' AND o.delivery_id IS NULL THEN 0 WHEN o.status='accepted' THEN 1 WHEN o.status='out_for_delivery' THEN 2 ELSE 3 END,o.created_at DESC LIMIT 200`,
        params
    );
    return res.json({ status: 'success', data: withCode(orders) });
}

// ============================================
// 4. Chef Orders List
// ============================================

/**
 * Returns orders for the chef's kitchens with pagination, pending first.
 * @param {Object} req - Authenticated chef; query: page, limit, status.
 * @param {Object} res - Express response.
 * @returns {Promise<void>} 200 with orders array and pagination info.
 */
async function getChefOrders_controller(req, res) {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const status = req.query.status;

    const VALID_STATUSES = new Set(['pending', 'accepted', 'completed', 'cancelled']);
    const statusFilter = VALID_STATUSES.has(status) ? `AND o.status = ?` : '';
    const statusParam = statusFilter ? [status] : [];

    const [orders] = await pool.query(
        `SELECT o.public_id,o.dish_name,o.quantity,o.unit_price,o.total_price,o.status,o.created_at,o.delivery_id,o.kitchen_name
         FROM orders o
         JOIN kitchens k ON k.id=o.kitchen_id
         WHERE k.user_id=? ${statusFilter}
         ORDER BY o.status='pending' DESC,o.created_at DESC LIMIT ? OFFSET ?`,
        [req.user.id, ...statusParam, limit, offset]
    );

    // Total count for pagination
    const [[{ total }]] = await pool.query(
        `SELECT COUNT(1) AS total FROM orders o JOIN kitchens k ON k.id=o.kitchen_id WHERE k.user_id=? ${statusFilter}`,
        [req.user.id, ...statusParam]
    );

    return res.json({
        status: 'success',
        data: withCode(orders),
        pagination: {
            page,
            limit,
            total,
            total_pages: Math.ceil(total / limit) || 1
        }
    });
}

// ============================================
// 5. Admin Orders List
// ============================================

/**
 * Admin listing of all orders with optional status filter.
 * Includes delivery name for assigned orders.
 * @param {Object} req - Admin; query: status (optional).
 * @param {Object} res - Express response.
 * @returns {Promise<void>} 200 with orders array.
 */
async function listOrdersAdmin_controller(req, res) {
    const status = VALID_STATUSES.has(req.query.status) ? req.query.status : null;
    const [orders] = await pool.query(
        `SELECT o.public_id,o.order_name,o.dish_name,o.kitchen_name,o.quantity,o.total_price,o.status,o.created_at,o.delivery_id,
                CONCAT_WS(' ',d.first_name,d.last_name) AS delivery_name
         FROM orders o
         LEFT JOIN users d ON d.id=o.delivery_id
         WHERE (? IS NULL OR o.status=?)
         ORDER BY CASE WHEN o.status='pending' THEN 0 WHEN o.status='accepted' THEN 1 ELSE 2 END,o.created_at DESC LIMIT 200`,
        [status, status]
    );
    return res.json({ status: 'success', data: withCode(orders) });
}

// ============================================
// 6. Delivery Users List (admin)
// ============================================

/**
 * Lists all approved delivery users with active order counts (for admin assignment).
 * @param {Object} req - Admin.
 * @param {Object} res - Express response.
 * @returns {Promise<void>} 200 with delivery users array.
 */
async function listDeliveryUsers_controller(req, res) {
    const [users] = await pool.query(
        `SELECT u.id,CONCAT_WS(' ',u.first_name,u.last_name) AS name,u.company_name,u.phone_number,u.city,
                (SELECT COUNT(*) FROM orders o WHERE o.delivery_id=u.id AND o.status='accepted') AS active_orders
         FROM users u WHERE u.roles='delivery' AND u.account_status='approved'
         ORDER BY active_orders ASC,u.id ASC`
    );
    return res.json({ status: 'success', data: users });
}

// ============================================
// 7. Delivery Vehicles
// ============================================

/**
 * Lists vehicles for the authenticated delivery user.
 * @param {Object} req - Authenticated delivery.
 * @param {Object} res - Express response.
 * @returns {Promise<void>} 200 with vehicles array.
 */
async function listDeliveryVehicles_controller(req, res) {
    const [vehicles] = await pool.query(
        'SELECT id,label,active,created_at FROM delivery_vehicles WHERE delivery_user_id=? ORDER BY active DESC,id ASC',
        [req.user.id]
    );
    return res.json({ status: 'success', data: vehicles });
}

/**
 * Lists delivery vehicles associated with the chef's kitchen.
 * Returns vehicles of delivery users who have handled orders from this chef's kitchen(s).
 * @param {Object} req - Authenticated chef.
 * @param {Object} res - Express response.
 * @returns {Promise<void>} 200 with vehicles array.
 */
async function listChefDeliveryVehicles_controller(req, res) {
    // Get chef's kitchen IDs
    const [kitchens] = await pool.query(
        'SELECT id FROM kitchens WHERE user_id = ?',
        [req.user.id]
    );
    
    if (kitchens.length === 0) {
        return res.json({ status: 'success', data: [] });
    }
    
    const kitchenIds = kitchens.map(k => k.id);
    const placeholders = kitchenIds.map(() => '?').join(',');
    
    // Get delivery users who have accepted orders from this chef's kitchens
    // and their vehicles
    const [vehicles] = await pool.query(
        `SELECT DISTINCT v.id, v.label, v.active, v.created_at, dv.first_name +" "+dv.last_name as delivery_name
         FROM delivery_vehicles v
         JOIN users dv ON dv.id = v.delivery_user_id
         JOIN orders o ON o.delivery_id = dv.id
         WHERE o.kitchen_id IN (${placeholders}) AND v.active = 1
         ORDER BY v.active DESC, v.id ASC`,
        kitchenIds
    );
    
    return res.json({ status: 'success', data: vehicles });
}

/**
 * Creates a new vehicle for the authenticated delivery user.
 * @param {Object} req - Authenticated delivery; body: label (2-80 chars).
 * @param {Object} res - Express response.
 * @returns {Promise<void>} 201 with vehicle data, 400 on invalid label.
 */
async function createDeliveryVehicle_controller(req, res) {
    const label = String(req.body.label || '').replace(/\s+/g, ' ').trim();
    if (label.length < 2 || label.length > 80) {
        return res.status(400).json({ status: 'error', message: 'اكتب اسم أو رقم العربية من 2 لـ 80 حرف' });
    }
    const [result] = await pool.query(
        'INSERT INTO delivery_vehicles (delivery_user_id,label) VALUES (?,?)',
        [req.user.id, label]
    );
    return res.status(201).json({ status: 'success', data: { id: result.insertId, label, active: 1 } });
}

// ============================================
// 8. Accept Order (delivery)
// ============================================

/**
 * Delivery user accepts a chef-accepted order (atomic with FOR UPDATE to prevent race conditions).
 * Notifies customer and chef. Order is assigned directly to delivery user.
 * @param {Object} req - Authenticated delivery; params.publicId.
 * @param {Object} res - Express response.
 * @returns {Promise<void>} 200 on success, 409 on race condition.
 */
async function acceptOrder_controller(req, res) {
  const result = await transaction(async db => {
    // 1. Lock row (FOR UPDATE) to prevent race conditions - only chef_accepted orders with no delivery
    const [[order]] = await db.query(
      "SELECT o.id, o.public_id, o.customer_id, k.user_id AS chef_id FROM orders o JOIN kitchens k ON k.id=o.kitchen_id WHERE o.public_id=? AND o.status='chef_accepted' AND o.delivery_id IS NULL FOR UPDATE",
      [req.params.publicId]
    );
    
    if (!order) {
      return { error: 409, message: 'الطلب اتاخد من دليفري تاني أو اتقفل' };
    }
    
    // 2. Assign order to this delivery user
    const [updated] = await db.query(
      "UPDATE orders SET delivery_id=?, accepted_at=UTC_TIMESTAMP(), status='accepted', vehicle_id=NULL WHERE id=? AND status='chef_accepted' AND delivery_id IS NULL",
      [req.user.id, order.id]
    );
    
    if (!updated.affectedRows) {
      return { error: 409, message: 'الطلب اتاخد من دليفري تاني' };
    }
    
    const code = orderCode(order.public_id);
    
    // 3. Send notifications
    await notify(db, order.customer_id, 'delivery_accepted', 'تم قبول طلبك', `المندوب قبل طلب ${code} وهيوصله ليك`, 'order', order.id, `order:${order.id}:accepted:${req.user.id}`);
    await notify(db, order.chef_id, 'delivery_accepted', 'الدليفري قبل الطلب', `طلب ${code} اتقبل من مندوب توصيل. المندوب في الطريق للمطبخ.`, 'order', order.id, `order:${order.id}:chef-delivery-accepted`);
    
    return { ok: true };
  });

  if (result.error) {
    return res.status(result.error).json({ status: 'error', message: result.message });
  }
  
  return res.json({ status: 'success', message: 'تم قبول الطلب. بيانات العميل ظهرت عندك دلوقتي' });
}

// ============================================
// 9. Update Order Status (multi-role)
// ============================================

/**
 * Updates order status with role-based permissions and notifications.
 * - delivery: can complete accepted orders
 * - customer: can cancel pending (before delivery assigned)
 * - chef: can cancel pending (before delivery assigned)
 * - admin: any transition
 * On completion: creates financial event record.
 * @param {Object} req - Authenticated; params.publicId; body: status.
 * @param {Object} res - Express response.
 * @returns {Promise<void>} 200 on success, 400/403/404/409 on permission/state errors.
 */
async function updateOrderStatus_controller(req, res) {
    const status = String(req.body.status || '').toLowerCase();
    if (!VALID_STATUSES.has(status) || status === 'accepted') {
        return res.status(400).json({ status: 'error', message: 'استخدم زر قبول الطلب للطلبات المفتوحة' });
    }

    const result = await transaction(async db => {
        const [[order]] = await db.query(
            'SELECT o.*,k.user_id AS chef_id FROM orders o JOIN kitchens k ON k.id=o.kitchen_id WHERE o.public_id=? FOR UPDATE',
            [req.params.publicId]
        );
        if (!order) return { error: 404, message: 'الطلب مش موجود' };

        // Permission checks per role
        if (req.user.roles === 'delivery') {
            if (order.delivery_id !== req.user.id || status !== 'completed' || order.status !== 'accepted') {
                return { error: 403, message: 'الدليفري يقدر يأكد التسليم بعد قبول الطلب فقط' };
            }
        } else if (req.user.roles === 'customer') {
            if (order.customer_id !== req.user.id || status !== 'cancelled' || order.status !== 'pending' || order.delivery_id) {
                return { error: 403, message: 'مش مسموح بإلغاء الطلب بعد قبوله' };
            }
        } else if (req.user.roles === 'chef') {
            if (order.chef_id !== req.user.id || status !== 'cancelled' || order.status !== 'pending' || order.delivery_id) {
                return { error: 403, message: 'المطبخ يقدر يعتذر عن الطلب قبل قبول الدليفري فقط' };
            }
        } else if (req.user.roles !== 'admin') {
            return { error: 403, message: 'مش مسموح لك تغير حالة الطلب ده' };
        }

        if (order.status !== 'pending' && order.status !== 'accepted') {
            return { error: 409, message: 'الطلب اتقفل قبل كده' };
        }

        await db.query(
            "UPDATE orders SET status=?,completed_at=CASE WHEN ?='completed' THEN UTC_TIMESTAMP() ELSE NULL END WHERE id=? AND status IN ('pending','accepted')",
            [status, status, order.id]
        );

        if (status === 'completed') {
            await db.query(
                'INSERT INTO order_financial_events (order_public_id,kitchen_id,delivery_id,vehicle_id,gross_amount,delivery_fee_amount,completed_at) VALUES (?,?,?,?,?,?,UTC_TIMESTAMP())',
                [order.public_id, order.kitchen_id, order.delivery_id, order.vehicle_id || null, order.total_price, order.delivery_fee_amount]
            );
        }

        const code = orderCode(order.public_id);
        const by = req.user.roles === 'delivery' ? 'مندوب التوصيل' : req.user.roles === 'customer' ? 'العميل' : 'الإدارة';
        const key = `order:${order.id}:status:${status}`;

        // Always notify the customer about their order status changes
        await notify(db, order.customer_id, 'order_status', 'تحديث طلبك', `طلب ${order.dish_name} (${code}) ${STATUS_LABEL[status]}`, 'order', order.id, key);
        if (req.user.id !== order.chef_id) {
            await notify(db, order.chef_id, 'order_status', 'تحديث طلب', `طلب ${code} ${STATUS_LABEL[status]} من ${by}`, 'order', order.id, key);
        }
        if (order.delivery_id && req.user.id !== order.delivery_id) {
            await notify(db, order.delivery_id, 'order_status', 'تحديث طلب توصيل', `طلب ${code} ${STATUS_LABEL[status]} من ${by}`, 'order', order.id, key);
        }
        if (status === 'cancelled') {
            await admins(db, 'order_cancelled', 'طلب اتلغى', `طلب ${code} اتلغى من ${by}`, 'order', order.id);
        }
        return { ok: true };
    });

    if (result.error) return res.status(result.error).json({ status: 'error', message: result.message });
    return res.json({ status: 'success', message: `تم تحديث حالة الطلب: ${STATUS_LABEL[status]}`, data: { public_id: req.params.publicId, status } });
}

// ============================================
// 10. Assign Delivery (admin)
// ============================================

/**
 * Admin assigns a pending order to a specific delivery company.
 * @param {Object} req - Admin; params.publicId; body: delivery_id.
 * @param {Object} res - Express response.
 * @returns {Promise<void>} 200 on success, 400/404 on invalid delivery/order.
 */
async function assignDelivery_controller(req, res) {
    const deliveryId = Number(req.body.delivery_id);
    if (!Number.isInteger(deliveryId)) {
        return res.status(400).json({ status: 'error', message: 'اختار شركة دليفري' });
    }

    const result = await transaction(async db => {
        const [[delivery]] = await db.query(
            "SELECT id FROM users WHERE id=? AND roles='delivery' AND account_status='approved' FOR UPDATE",
            [deliveryId]
        );
        if (!delivery) return { error: 404, message: 'شركة الدليفري مش موجودة أو حسابها مش مفعل' };

        const [[order]] = await db.query(
            "SELECT id,customer_id,dish_name FROM orders WHERE public_id=? AND status='pending' AND delivery_id IS NULL FOR UPDATE",
            [req.params.publicId]
        );
        if (!order) return { error: 404, message: 'الطلب مش موجود أو اتقفل' };

        await db.query("UPDATE orders SET delivery_id=?,accepted_at=UTC_TIMESTAMP(),status='accepted' WHERE id=?", [deliveryId, order.id]);
        await notify(db, deliveryId, 'order_assigned', 'طلب توصيل جديد', `تم قبول طلب ${order.dish_name} لك من الإدارة`, 'order', order.id, `order:${order.id}:delivery:${deliveryId}`);
        await notify(db, order.customer_id, 'order_assigned', 'طلبك مع مندوب التوصيل', `طلب ${order.dish_name} اتسلم لشركة دليفري`, 'order', order.id, `order:${order.id}:assigned:${deliveryId}`);
        return { ok: true };
    });

    if (result.error) return res.status(result.error).json({ status: 'error', message: result.message });
    return res.json({ status: 'success', message: 'تم قبول الطلب لشركة الدليفري' });
}

// ============================================
// 11. Approve Pending User (admin)
// ============================================

/**
 * Approves a pending chef/delivery account.
 * @param {Object} req - Admin; params.id.
 * @param {Object} res - Express response.
 * @returns {Promise<void>} 200 on success, 400/404 on invalid user.
 */
async function approveUser_controller(req, res) {
    const userId = Number(req.params.id);
    if (!Number.isInteger(userId)) {
        return res.status(400).json({ status: 'error', message: 'رقم الحساب مش صحيح' });
    }

    const result = await transaction(async db => {
        const [rows] = await db.query(
            "UPDATE users SET account_status='approved',approved_at=UTC_TIMESTAMP(),approved_by=? WHERE id=? AND roles IN ('chef','delivery') AND account_status='pending'",
            [req.user.id, userId]
        );
        if (!rows.affectedRows) return { error: 404 };
        await notify(db, userId, 'account_approved', 'تم قبول الحساب', 'تم قبول حسابك ويمكنك تسجيل الدخول', 'user', userId, `user:${userId}:approved`);
        return { ok: true };
    });

    if (result.error) return res.status(404).json({ status: 'error', message: 'الحساب مش موجود أو اتراجع قبل كده' });
    return res.json({ status: 'success', message: 'تم قبول الحساب' });
}

// ============================================
// 12. Reject Pending User (admin)
// ============================================

/**
 * Rejects a pending chef/delivery account.
 * @param {Object} req - Admin; params.id.
 * @param {Object} res - Express response.
 * @returns {Promise<void>} 200 on success, 400/404 on invalid user.
 */
async function rejectUser_controller(req, res) {
    const userId = Number(req.params.id);
    if (!Number.isInteger(userId)) {
        return res.status(400).json({ status: 'error', message: 'رقم الحساب مش صحيح' });
    }

    const result = await transaction(async db => {
        const [rows] = await db.query(
            "UPDATE users SET account_status='rejected',approved_at=NULL,approved_by=? WHERE id=? AND roles IN ('chef','delivery') AND account_status='pending'",
            [req.user.id, userId]
        );
        if (!rows.affectedRows) return { error: 404 };
        await notify(db, userId, 'account_rejected', 'لم تتم الموافقة', 'لم تتم الموافقة على حسابك حالياً', 'user', userId, `user:${userId}:rejected`);
        return { ok: true };
    });

    if (result.error) return res.status(404).json({ status: 'error', message: 'الحساب مش موجود أو اتراجع قبل كده' });
    return res.json({ status: 'success', message: 'تم رفض الحساب' });
}

// ============================================
// 13. List Pending Users (admin)
// ============================================

/**
 * Lists all pending chef/delivery accounts for admin review.
 * @param {Object} req - Admin.
 * @param {Object} res - Express response.
 * @returns {Promise<void>} 200 with pending users array.
 */
async function listPendingUsers_controller(req, res) {
    const [users] = await pool.query(
        "SELECT id,first_name,last_name,email,phone_number,company_name,roles,created_at FROM users WHERE roles IN ('chef','delivery') AND account_status='pending' ORDER BY created_at ASC"
    );
    return res.json({ status: 'success', data: users });
}

module.exports = {
    createOrder_controller,
    chefAcceptOrder_controller,
    chefHandoffOrder_controller,
    getCustomerOrders_controller,
    getDeliveryOrders_controller,
    getChefOrders_controller,
    updateOrderStatus_controller,
    acceptOrder_controller,
    listDeliveryVehicles_controller,
    listChefDeliveryVehicles_controller,
    createDeliveryVehicle_controller,
    approveUser_controller,
    listPendingUsers_controller,
    assignDelivery_controller,
    rejectUser_controller,
    listOrdersAdmin_controller,
    listDeliveryUsers_controller
};