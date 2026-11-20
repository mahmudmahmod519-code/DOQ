/**
 * Mobile customer app API (mounted under /m/api/v1).
 *
 * Everything the customer can see or do lives here, separated from the web dashboards
 * (admin / kitchen / delivery). Every list uses cursor (keyset) pagination — see utiles/cursor.js —
 * so infinite scroll on the phone stays fast and never shows duplicated or skipped rows.
 *
 * Visibility rules (same as the web):
 * - Only dishes/kitchens of ACTIVE kitchens whose chef account is approved are public.
 * - Kitchen / chef phone numbers are never returned to customers.
 * - Personal endpoints require an approved customer session (suspended users get nothing).
 */
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const pool = require('../database/pool');
const transaction = require('../utiles/transaction');
const { decodeCursor, parseLimit, buildPage } = require('../utiles/cursor');

const PUBLIC_KITCHEN = "k.status='ACTIVE' AND chef.account_status='approved'";
const ORDER_GROUPS = {
    active: ['pending', 'chef_accepted', 'accepted', 'out_for_delivery'],
    done: ['completed', 'cancelled']
};

const toId = value => {
    const n = Number(value);
    return Number.isSafeInteger(n) && n > 0 ? n : null;
};
const cleanText = (value, max = 80) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const customerId = req => (req.user && req.user.roles === 'customer' && req.user.account_status === 'approved' ? req.user.id : 0);
const notFound = (res, message) => res.status(404).json({ status: 'error', message });
const num = value => (value === null || value === undefined ? null : Number(value));

/** Shared SELECT for dish cards (rating + favourite flag computed only for the returned rows). */
function dishSelect() {
    return `SELECT d.id, d.name, d.description, d.price, d.image_url, d.kitchen_id, d.category_id,
                   k.title AS kitchen_name, k.city AS kitchen_city, k.portfolio_url AS kitchen_image,
                   c.name AS category_name,
                   (SELECT ROUND(AVG(r.rating),1) FROM reviews r WHERE r.dish_id=d.id) AS avg_rating,
                   (SELECT COUNT(*) FROM reviews r WHERE r.dish_id=d.id) AS reviews_count,
                   EXISTS(SELECT 1 FROM favourite_dishes f WHERE f.dish_id=d.id AND f.customer_id=?) AS is_favourite
            FROM dishes d
            JOIN kitchens k ON k.id=d.kitchen_id
            JOIN users chef ON chef.id=k.user_id
            JOIN categories c ON c.id=d.category_id`;
}

function shapeDish(row) {
    return {
        id: row.id,
        name: row.name,
        description: row.description,
        price: Number(row.price),
        image_url: row.image_url,
        kitchen_id: row.kitchen_id,
        kitchen_name: row.kitchen_name,
        kitchen_city: row.kitchen_city,
        kitchen_image: row.kitchen_image,
        category_id: row.category_id,
        category_name: row.category_name,
        avg_rating: num(row.avg_rating),
        reviews_count: Number(row.reviews_count || 0),
        is_favourite: Boolean(Number(row.is_favourite))
    };
}

function kitchenSelect() {
    return `SELECT k.id, k.title, k.description, k.city, k.address, k.image_url, k.portfolio_url, k.delivery_fee, k.created_at,
                   chef.first_name AS chef_first_name,
                   (SELECT COUNT(*) FROM dishes d WHERE d.kitchen_id=k.id) AS dishes_count,
                   (SELECT ROUND(AVG(r.rating),1) FROM reviews r JOIN dishes d ON d.id=r.dish_id WHERE d.kitchen_id=k.id) AS avg_rating,
                   (SELECT COUNT(*) FROM reviews r JOIN dishes d ON d.id=r.dish_id WHERE d.kitchen_id=k.id) AS reviews_count
            FROM kitchens k
            JOIN users chef ON chef.id=k.user_id`;
}

function shapeKitchen(row) {
    return {
        id: row.id,
        title: row.title,
        description: row.description,
        city: row.city,
        address: row.address,
        image_url: row.image_url,
        portfolio_url: row.portfolio_url,
        delivery_fee: Number(row.delivery_fee || 0),
        chef_first_name: row.chef_first_name,
        dishes_count: Number(row.dishes_count || 0),
        avg_rating: num(row.avg_rating),
        reviews_count: Number(row.reviews_count || 0)
    };
}

// ============================================
// Home
// ============================================

/**
 * GET /m/api/v1/home - Categories with visible dish counts + newest kitchens (first screen).
 * Dishes are loaded separately through the cursor endpoint.
 */
async function home_controller(req, res) {
    const [categories] = await pool.query(
        `SELECT c.id, c.name, COUNT(d.id) AS dishes_count
         FROM categories c
         JOIN dishes d ON d.category_id=c.id
         JOIN kitchens k ON k.id=d.kitchen_id
         JOIN users chef ON chef.id=k.user_id
         WHERE ${PUBLIC_KITCHEN}
         GROUP BY c.id, c.name
         ORDER BY dishes_count DESC, c.name ASC
         LIMIT 20`
    );
    const [kitchens] = await pool.query(
        `${kitchenSelect()} WHERE ${PUBLIC_KITCHEN} ORDER BY k.id DESC LIMIT 8`
    );
    return res.json({
        status: 'success',
        data: {
            categories: categories.map(c => ({ id: c.id, name: c.name, dishes_count: Number(c.dishes_count) })),
            kitchens: kitchens.map(shapeKitchen)
        }
    });
}

// ============================================
// Dishes
// ============================================

/**
 * GET /m/api/v1/dishes?cursor=&limit=&q=&category_id=&kitchen_id=&city=
 * Newest first, keyset on d.id.
 */
async function listDishes_controller(req, res) {
    const limit = parseLimit(req.query.limit);
    const cursor = decodeCursor(req.query.cursor);
    const where = [PUBLIC_KITCHEN];
    const params = [customerId(req)];

    const q = cleanText(req.query.q, 60);
    const categoryId = toId(req.query.category_id);
    const kitchenId = toId(req.query.kitchen_id);
    const city = cleanText(req.query.city, 100);

    if (q) {
        where.push('(d.name LIKE ? OR d.description LIKE ? OR k.title LIKE ? OR c.name LIKE ?)');
        params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
    }
    if (categoryId) { where.push('d.category_id=?'); params.push(categoryId); }
    if (kitchenId) { where.push('d.kitchen_id=?'); params.push(kitchenId); }
    if (city) { where.push('k.city=?'); params.push(city); }
    if (cursor?.id) { where.push('d.id<?'); params.push(Number(cursor.id)); }

    const [rows] = await pool.query(
        `${dishSelect()} WHERE ${where.join(' AND ')} ORDER BY d.id DESC LIMIT ?`,
        [...params, limit + 1]
    );
    const page = buildPage(rows, limit, row => ({ id: row.id }));
    return res.json({ status: 'success', data: { ...page, items: page.items.map(shapeDish) } });
}

/**
 * GET /m/api/v1/dishes/:id - Dish details + kitchen card + the customer's own review (if any).
 */
async function getDish_controller(req, res) {
    const id = toId(req.params.id);
    if (!id) return notFound(res, 'الطبق مش موجود');
    const uid = customerId(req);

    const [[row]] = await pool.query(
        `SELECT d.id, d.name, d.description, d.ingredients, d.price, d.image_url, d.kitchen_id, d.category_id,
                k.title AS kitchen_name, k.city AS kitchen_city, k.portfolio_url AS kitchen_image, k.delivery_fee,
                c.name AS category_name,
                (SELECT ROUND(AVG(r.rating),1) FROM reviews r WHERE r.dish_id=d.id) AS avg_rating,
                (SELECT COUNT(*) FROM reviews r WHERE r.dish_id=d.id) AS reviews_count,
                EXISTS(SELECT 1 FROM favourite_dishes f WHERE f.dish_id=d.id AND f.customer_id=?) AS is_favourite
         FROM dishes d
         JOIN kitchens k ON k.id=d.kitchen_id
         JOIN users chef ON chef.id=k.user_id
         JOIN categories c ON c.id=d.category_id
         WHERE d.id=? AND ${PUBLIC_KITCHEN} LIMIT 1`,
        [uid, id]
    );
    if (!row) return notFound(res, 'الطبق ده مش متاح دلوقتي');

    let myReview = null;
    if (uid) {
        const [[review]] = await pool.query('SELECT id, rating, comment, created_at FROM reviews WHERE dish_id=? AND user_id=? LIMIT 1', [id, uid]);
        myReview = review || null;
    }

    const ingredients = String(row.ingredients || '')
        .split(/[,،，\n]/).map(s => s.trim()).filter(Boolean);

    return res.json({
        status: 'success',
        data: {
            ...shapeDish(row),
            ingredients,
            delivery_fee: Number(row.delivery_fee || 0),
            my_review: myReview
        }
    });
}

/**
 * GET /m/api/v1/dishes/:id/reviews?cursor= - Reviews of one dish, newest first (keyset on r.id).
 */
async function listDishReviews_controller(req, res) {
    const id = toId(req.params.id);
    if (!id) return notFound(res, 'الطبق مش موجود');
    const limit = parseLimit(req.query.limit);
    const cursor = decodeCursor(req.query.cursor);
    const params = [id];
    let cursorSql = '';
    if (cursor?.id) { cursorSql = ' AND r.id<?'; params.push(Number(cursor.id)); }

    const [rows] = await pool.query(
        `SELECT r.id, r.rating, r.comment, r.created_at, u.first_name, LEFT(u.last_name,1) AS last_initial
         FROM reviews r JOIN users u ON u.id=r.user_id
         WHERE r.dish_id=?${cursorSql}
         ORDER BY r.id DESC LIMIT ?`,
        [...params, limit + 1]
    );
    const page = buildPage(rows, limit, row => ({ id: row.id }));
    return res.json({
        status: 'success',
        data: {
            ...page,
            items: page.items.map(r => ({
                id: r.id,
                rating: r.rating,
                comment: r.comment,
                created_at: r.created_at,
                author: [r.first_name, r.last_initial ? r.last_initial + '.' : ''].filter(Boolean).join(' ')
            }))
        }
    });
}

// ============================================
// Kitchens
// ============================================

/**
 * GET /m/api/v1/kitchens?cursor=&q=&city= - Public kitchens, newest first (keyset on k.id).
 */
async function listKitchens_controller(req, res) {
    const limit = parseLimit(req.query.limit);
    const cursor = decodeCursor(req.query.cursor);
    const where = [PUBLIC_KITCHEN];
    const params = [];
    const q = cleanText(req.query.q, 60);
    const city = cleanText(req.query.city, 100);

    if (q) { where.push('(k.title LIKE ? OR k.description LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }
    if (city) { where.push('k.city=?'); params.push(city); }
    if (cursor?.id) { where.push('k.id<?'); params.push(Number(cursor.id)); }

    const [rows] = await pool.query(
        `${kitchenSelect()} WHERE ${where.join(' AND ')} ORDER BY k.id DESC LIMIT ?`,
        [...params, limit + 1]
    );
    const page = buildPage(rows, limit, row => ({ id: row.id }));
    return res.json({ status: 'success', data: { ...page, items: page.items.map(shapeKitchen) } });
}

/**
 * GET /m/api/v1/kitchens/:id - One public kitchen (dishes come from /dishes?kitchen_id=).
 */
async function getKitchen_controller(req, res) {
    const id = toId(req.params.id);
    if (!id) return notFound(res, 'المطبخ مش موجود');
    const [[row]] = await pool.query(`${kitchenSelect()} WHERE k.id=? AND ${PUBLIC_KITCHEN} LIMIT 1`, [id]);
    if (!row) return notFound(res, 'المطبخ ده مش متاح دلوقتي');
    return res.json({ status: 'success', data: shapeKitchen(row) });
}

/**
 * GET /m/api/v1/cities - Distinct cities of public kitchens (filter chips).
 */
async function listCities_controller(req, res) {
    const [rows] = await pool.query(
        `SELECT DISTINCT k.city FROM kitchens k JOIN users chef ON chef.id=k.user_id
         WHERE ${PUBLIC_KITCHEN} AND k.city IS NOT NULL AND k.city<>'' ORDER BY k.city ASC LIMIT 50`
    );
    return res.json({ status: 'success', data: rows.map(r => r.city) });
}

// ============================================
// Orders (customer)
// ============================================

function shapeOrder(o) {
    return {
        public_id: o.public_id,
        order_code: String(o.public_id).slice(0, 8).toUpperCase(),
        order_name: o.order_name,
        dish_id: o.dish_id,
        dish_name: o.dish_name,
        dish_image: o.dish_image,
        kitchen_id: o.kitchen_id,
        kitchen_name: o.kitchen_name,
        quantity: o.quantity,
        unit_price: Number(o.unit_price),
        discount_amount: Number(o.discount_amount || 0),
        delivery_fee_amount: Number(o.delivery_fee_amount || 0),
        total_price: Number(o.total_price),
        status: o.status,
        can_cancel: o.status === 'pending',
        created_at: o.created_at,
        chef_accepted_at: o.chef_accepted_at,
        accepted_at: o.accepted_at,
        out_for_delivery_at: o.out_for_delivery_at,
        completed_at: o.completed_at
    };
}

const ORDER_FIELDS = `o.id, o.public_id, o.order_name, o.dish_id, o.dish_name, o.kitchen_id, o.kitchen_name, o.quantity,
    o.unit_price, o.discount_amount, o.delivery_fee_amount, o.total_price, o.status, o.created_at,
    o.chef_accepted_at, o.accepted_at, o.out_for_delivery_at, o.completed_at, d.image_url AS dish_image`;

/**
 * GET /m/api/v1/orders?cursor=&status=active|done - Customer orders, newest first (keyset on o.id).
 */
async function listOrders_controller(req, res) {
    const limit = parseLimit(req.query.limit);
    const cursor = decodeCursor(req.query.cursor);
    const where = ['o.customer_id=?'];
    const params = [req.user.id];
    const group = ORDER_GROUPS[req.query.status];
    if (group) { where.push(`o.status IN (${group.map(() => '?').join(',')})`); params.push(...group); }
    if (cursor?.id) { where.push('o.id<?'); params.push(Number(cursor.id)); }

    const [rows] = await pool.query(
        `SELECT ${ORDER_FIELDS} FROM orders o LEFT JOIN dishes d ON d.id=o.dish_id
         WHERE ${where.join(' AND ')} ORDER BY o.id DESC LIMIT ?`,
        [...params, limit + 1]
    );
    const page = buildPage(rows, limit, row => ({ id: row.id }));
    return res.json({ status: 'success', data: { ...page, items: page.items.map(shapeOrder) } });
}

/**
 * GET /m/api/v1/orders/:publicId - One order of the signed-in customer (tracking screen).
 */
async function getOrder_controller(req, res) {
    const publicId = String(req.params.publicId || '');
    if (!/^[0-9a-f-]{36}$/i.test(publicId)) return notFound(res, 'الطلب مش موجود');
    const [[row]] = await pool.query(
        `SELECT ${ORDER_FIELDS}, o.customer_address,
                EXISTS(SELECT 1 FROM reviews r WHERE r.dish_id=o.dish_id AND r.user_id=o.customer_id) AS has_review
         FROM orders o LEFT JOIN dishes d ON d.id=o.dish_id
         WHERE o.public_id=? AND o.customer_id=? LIMIT 1`,
        [publicId, req.user.id]
    );
    if (!row) return notFound(res, 'الطلب مش موجود');
    return res.json({
        status: 'success',
        data: { ...shapeOrder(row), customer_address: row.customer_address, has_review: Boolean(Number(row.has_review)) }
    });
}

// ============================================
// Favourites / notifications / reviews / profile
// ============================================

/**
 * GET /m/api/v1/favourites?cursor= - Favourite dishes, most recently added first.
 * Composite keyset on (created_at, dish_id) because favourite_dishes has no surrogate id.
 */
async function listFavourites_controller(req, res) {
    const limit = parseLimit(req.query.limit);
    const cursor = decodeCursor(req.query.cursor);
    const params = [req.user.id, req.user.id];
    let cursorSql = '';
    if (cursor?.t && cursor?.id) {
        const t = new Date(cursor.t);
        cursorSql = ' AND (f.created_at<? OR (f.created_at=? AND f.dish_id<?))';
        params.push(t, t, Number(cursor.id));
    }
    const [rows] = await pool.query(
        `SELECT d.id, d.name, d.description, d.price, d.image_url, d.kitchen_id, d.category_id,
                k.title AS kitchen_name, k.city AS kitchen_city, k.portfolio_url AS kitchen_image, c.name AS category_name,
                (SELECT ROUND(AVG(r.rating),1) FROM reviews r WHERE r.dish_id=d.id) AS avg_rating,
                (SELECT COUNT(*) FROM reviews r WHERE r.dish_id=d.id) AS reviews_count,
                ? > 0 AS is_favourite, f.created_at AS favourited_at,
                (${PUBLIC_KITCHEN}) AS available
         FROM favourite_dishes f
         JOIN dishes d ON d.id=f.dish_id
         JOIN kitchens k ON k.id=d.kitchen_id
         JOIN users chef ON chef.id=k.user_id
         JOIN categories c ON c.id=d.category_id
         WHERE f.customer_id=?${cursorSql}
         ORDER BY f.created_at DESC, f.dish_id DESC LIMIT ?`,
        [...params, limit + 1]
    );
    const page = buildPage(rows, limit, row => ({ t: new Date(row.favourited_at).toISOString(), id: row.id }));
    return res.json({
        status: 'success',
        data: { ...page, items: page.items.map(r => ({ ...shapeDish(r), available: Boolean(Number(r.available)) })) }
    });
}

/**
 * GET /m/api/v1/notifications?cursor= - Customer notifications, newest first (keyset on n.id).
 */
async function listNotifications_controller(req, res) {
    const limit = parseLimit(req.query.limit);
    const cursor = decodeCursor(req.query.cursor);
    const params = [req.user.id];
    let cursorSql = '';
    if (cursor?.id) { cursorSql = ' AND n.id<?'; params.push(Number(cursor.id)); }
    const [rows] = await pool.query(
        `SELECT n.id, n.type, n.title, n.body, n.entity_type, n.entity_id, n.read_at, n.created_at,
                CASE WHEN n.entity_type='order' THEN (SELECT o.public_id FROM orders o WHERE o.id=n.entity_id AND o.customer_id=n.user_id) END AS order_public_id
         FROM notifications n WHERE n.user_id=?${cursorSql} ORDER BY n.id DESC LIMIT ?`,
        [...params, limit + 1]
    );
    const page = buildPage(rows, limit, row => ({ id: row.id }));
    return res.json({ status: 'success', data: page });
}

/**
 * GET /m/api/v1/reviews/my?cursor= - Reviews written by the customer (keyset on r.id).
 */
async function listMyReviews_controller(req, res) {
    const limit = parseLimit(req.query.limit);
    const cursor = decodeCursor(req.query.cursor);
    const params = [req.user.id];
    let cursorSql = '';
    if (cursor?.id) { cursorSql = ' AND r.id<?'; params.push(Number(cursor.id)); }
    const [rows] = await pool.query(
        `SELECT r.id, r.rating, r.comment, r.created_at, d.id AS dish_id, d.name AS dish_name, d.image_url AS dish_image, k.title AS kitchen_name
         FROM reviews r JOIN dishes d ON d.id=r.dish_id JOIN kitchens k ON k.id=d.kitchen_id
         WHERE r.user_id=?${cursorSql} ORDER BY r.id DESC LIMIT ?`,
        [...params, limit + 1]
    );
    const page = buildPage(rows, limit, row => ({ id: row.id }));
    return res.json({ status: 'success', data: page });
}

/**
 * GET /m/api/v1/me - Profile + small counters for the account screen.
 */
async function me_controller(req, res) {
    const u = req.user;
    const [[stats]] = await pool.query(
        `SELECT (SELECT COUNT(*) FROM orders WHERE customer_id=?) AS orders_count,
                (SELECT COUNT(*) FROM orders WHERE customer_id=? AND status IN ('pending','chef_accepted','accepted','out_for_delivery')) AS active_orders,
                (SELECT COUNT(*) FROM favourite_dishes WHERE customer_id=?) AS favourites_count,
                (SELECT COUNT(*) FROM reviews WHERE user_id=?) AS reviews_count`,
        [u.id, u.id, u.id, u.id]
    );
    return res.json({
        status: 'success',
        data: {
            first_name: u.first_name,
            last_name: u.last_name,
            email: u.email,
            phone_number: u.phone_number,
            city: u.city,
            address: u.address,
            two_factor_enabled: Boolean(Number(u.two_factor_enabled)),
            created_at: u.created_at,
            stats: {
                orders_count: Number(stats.orders_count),
                active_orders: Number(stats.active_orders),
                favourites_count: Number(stats.favourites_count),
                reviews_count: Number(stats.reviews_count)
            }
        }
    });
}


/**
 * DELETE /m/api/v1/me - Customer deletes their own account (Google Play account-deletion policy).
 * Body: { password, confirm: "DELETE" }.
 * Personal data is erased/anonymised; order rows are kept (financial records of kitchens and
 * delivery companies) but their customer name/phone/address snapshots are wiped.
 * Refused while the customer still has an order in progress.
 */
async function deleteAccount_controller(req, res) {
    const password = String(req.body?.password || '');
    if (String(req.body?.confirm || '') !== 'DELETE' || !password) {
        return res.status(400).json({ status: 'error', message: 'اكتب كلمة المرور وأكد حذف الحساب' });
    }
    const [[user]] = await pool.query('SELECT id,password_hash FROM users WHERE id=? AND roles=\'customer\' LIMIT 1', [req.user.id]);
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
        return res.status(401).json({ status: 'error', message: 'كلمة المرور غلط' });
    }
    const [[active]] = await pool.query(
        "SELECT COUNT(*) AS n FROM orders WHERE customer_id=? AND status IN ('pending','chef_accepted','accepted','out_for_delivery')",
        [user.id]
    );
    if (Number(active.n) > 0) {
        return res.status(409).json({ status: 'error', message: 'عندك طلب لسه شغال. استنى لما يتسلم أو الغيه الأول' });
    }

    await transaction(async db => {
        const randomHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
        await db.query(
            `UPDATE users SET first_name='مستخدم', last_name='محذوف', email=?, phone_number=?, password_hash=?,
                    city=NULL, address=NULL, image_url=NULL, portfolio_url=NULL,
                    two_factor_secret=NULL, two_factor_enabled=0, two_factor_required=0,
                    account_status='deleted', session_version=session_version+1
             WHERE id=?`,
            [`deleted-${user.id}@deleted.invalid`, `D${String(user.id).padStart(10, '0')}`.slice(0, 15), randomHash, user.id]
        );
        await db.query("UPDATE orders SET customer_name='عميل محذوف', customer_phone='-', customer_address=NULL WHERE customer_id=?", [user.id]);
        await db.query('DELETE FROM favourite_dishes WHERE customer_id=?', [user.id]);
        await db.query('DELETE FROM notifications WHERE user_id=?', [user.id]);
    });

    res.clearCookie('session_token', { path: '/' });
    return res.json({ status: 'success', message: 'تم حذف حسابك وبياناتك الشخصية' });
}

module.exports = {
    home_controller,
    deleteAccount_controller,
    listDishes_controller,
    getDish_controller,
    listDishReviews_controller,
    listKitchens_controller,
    getKitchen_controller,
    listCities_controller,
    listOrders_controller,
    getOrder_controller,
    listFavourites_controller,
    listNotifications_controller,
    listMyReviews_controller,
    me_controller,
    ORDER_GROUPS
};
