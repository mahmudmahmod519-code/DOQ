/**
 * Admin controller: dashboard stats, user/kitchen/dish/review/category management.
 * All endpoints require admin role (enforced by routes middleware).
 */
const pool = require("../database/pool");
const checker = require("../utiles/checker");
const {
    idParamSchema,
    userUpdateSchema,
    categorySchema
} = require("../utiles/validation");

// ============================================
// Fair Score Helper
// ============================================
/**
 * Calculates Bayesian fair score for review-based ranking.
 * Formula: (count * avg + C * m) / (count + C) where C=20, m=4.2
 * @param {number} count - Number of reviews.
 * @param {number} avg - Average rating.
 * @returns {string|null} Fair score as string with 2 decimals, or null if no reviews.
 */
function calcFairScore(count, avg) {
    const C = 20;
    const m = 4.2;
    if (!count || count === 0) return null;
    return Number(((count * avg) + (C * m)) / (count + C)).toFixed(2);
}

// =========================================================
// 1. DASHBOARD
// GET /api/v1/admin/dashboard
// =========================================================

/**
 * Admin dashboard overview: user/kitchen/dish/review stats, latest items, top performers, growth charts.
 * @param {Object} req - Express request (req.user is admin).
 * @param {Object} res - Express response.
 * @returns {Promise<void>} Sends JSON with stats, latestCarts, latestReviews, topCartsByFairScore, charts.
 */
async function getAdminDashboard_controller(req, res) {
    try {
        const [[usersStats]] = await pool.query(`
            SELECT 
                COUNT(*) AS total_users,
                SUM(roles = 'customer') AS total_customers,
                SUM(roles = 'chef') AS total_chefs,
                SUM(roles = 'admin') AS total_admins,
                SUM(created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)) AS new_users_this_month,
                SUM(created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)) AS new_users_this_week
            FROM users
        `);

        const [[cartsStats]] = await pool.query(`
            SELECT 
                COUNT(*) AS total_carts,
                SUM(created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)) AS new_carts_this_week,
                SUM(created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)) AS new_carts_this_month
            FROM kitchens
        `);

        const [[dishesStats]] = await pool.query(`
            SELECT 
                COUNT(*) AS total_dishes,
                SUM(created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)) AS new_dishes_this_month
            FROM dishes
        `);

        const [[reviewsStats]] = await pool.query(`
            SELECT 
                COUNT(*) AS total_reviews,
                ROUND(AVG(rating), 2) AS average_rating,
                SUM(rating = 5) AS star_5,
                SUM(rating = 4) AS star_4,
                SUM(rating = 3) AS star_3,
                SUM(rating = 2) AS star_2,
                SUM(rating = 1) AS star_1
            FROM reviews
        `);

        const [latestCarts] = await pool.query(`
            SELECT 
                k.id, k.title, k.city, k.image_url, k.portfolio_url, k.created_at,
                CONCAT(u.first_name, ' ', u.last_name) AS chef_name,
                COUNT(DISTINCT d.id) AS dishes_count,
                COUNT(r.id) AS reviews_count,
                ROUND(AVG(r.rating), 2) AS avg_rating
            FROM kitchens k
            JOIN users u ON u.id = k.user_id
            LEFT JOIN dishes d ON d.kitchen_id = k.id
            LEFT JOIN reviews r ON r.dish_id = d.id
            GROUP BY k.id
            ORDER BY k.created_at DESC
            LIMIT 8
        `);

        const latestCartsWithScore = latestCarts.map(cart => ({
            ...cart,
            fair_score: calcFairScore(cart.reviews_count, cart.avg_rating)
        }));

        const [latestReviews] = await pool.query(`
            SELECT 
                r.id, r.rating, r.comment, r.created_at,
                CONCAT(u.first_name, ' ', u.last_name) AS user_name,
                d.name AS dish_name,
                d.image_url AS dish_image,
                k.title AS kitchen_name
            FROM reviews r
            JOIN users u ON u.id = r.user_id
            JOIN dishes d ON d.id = r.dish_id
            JOIN kitchens k ON k.id = d.kitchen_id
            ORDER BY r.created_at DESC
            LIMIT 6
        `);

        const C = 20, m = 4.2;
        const [topCarts] = await pool.query(`
            SELECT 
                k.id, k.title, k.city, k.portfolio_url AS image,
                CONCAT(u.first_name, ' ', u.last_name) AS chef_name,
                COUNT(r.id) AS reviews_count,
                ROUND(AVG(r.rating), 2) AS avg_rating,
                ROUND((COUNT(r.id) * AVG(r.rating) + ? * ?) / (COUNT(r.id) + ?), 2) AS fair_score
            FROM kitchens k
            JOIN users u ON u.id = k.user_id
            JOIN dishes d ON d.kitchen_id = k.id
            LEFT JOIN reviews r ON r.dish_id = d.id
            GROUP BY k.id
            HAVING reviews_count >= 1
            ORDER BY fair_score DESC
            LIMIT 5
        `, [C, m, C]);

        const [cartsGrowth] = await pool.query(`
            SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, COUNT(*) AS count
            FROM kitchens
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
            GROUP BY DATE_FORMAT(created_at, '%Y-%m')
            ORDER BY month ASC
        `);

        return res.status(200).json({
            status: 'success',
            data: {
                stats: {
                    totalUsers: usersStats.total_users || 0,
                    totalCustomers: usersStats.total_customers || 0,
                    totalChefs: usersStats.total_chefs || 0,
                    totalAdmins: usersStats.total_admins || 0,
                    newUsersThisMonth: usersStats.new_users_this_month || 0,
                    newUsersThisWeek: usersStats.new_users_this_week || 0,
                    totalCarts: cartsStats.total_carts || 0,
                    newCartsThisWeek: cartsStats.new_carts_this_week || 0,
                    newCartsThisMonth: cartsStats.new_carts_this_month || 0,
                    totalDishes: dishesStats.total_dishes || 0,
                    newDishesThisMonth: dishesStats.new_dishes_this_month || 0,
                    totalReviews: reviewsStats.total_reviews || 0,
                    averageRating: reviewsStats.average_rating || 0,
                    ratingDistribution: {
                        5: reviewsStats.star_5 || 0,
                        4: reviewsStats.star_4 || 0,
                        3: reviewsStats.star_3 || 0,
                        2: reviewsStats.star_2 || 0,
                        1: reviewsStats.star_1 || 0
                    }
                },
                latestCarts: latestCartsWithScore,
                latestReviews,
                topCartsByFairScore: topCarts,
                charts: {
                    cartsGrowthLast6Months: cartsGrowth,
                    usersByRole: {
                        customer: usersStats.total_customers || 0,
                        chef: usersStats.total_chefs || 0,
                        admin: usersStats.total_admins || 0
                    }
                }
            }
        });
    } catch (error) {
        console.error('Admin Dashboard Error:', error && error.message);
        return res.status(500).json({ status: 'error', message: 'حدث خطأ أثناء جلب بيانات لوحة التحكم' });
    }
}

// =========================================================
// 2. USERS
// =========================================================

/**
 * List all users with pagination, search, and role filter.
 * @param {Object} req - Express request (query: page, limit, q, role).
 * @param {Object} res - Express response.
 * @returns {Promise<void>} Sends JSON: 200 { status, data: users[], pagination }.
 */
async function getAllUsers_controller(req, res) {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const offset = (page - 1) * limit;
    const q = req.query.q || '';
    const role = req.query.role || '';
    const accountStatus = req.query.account_status || req.query.status || '';

    let whereClauses = [];
    let params = [];

    if (q) {
        const keyword = `%${q}%`;
        whereClauses.push(`(first_name LIKE ? OR last_name LIKE ? OR email LIKE ? OR phone_number LIKE ? OR company_name LIKE ?)`);
        params.push(keyword, keyword, keyword, keyword, keyword);
    }
    if (role && ['customer', 'chef', 'delivery', 'admin'].includes(role)) {
        whereClauses.push(`roles = ?`);
        params.push(role);
    }
    if (accountStatus && ['approved', 'pending', 'suspended', 'rejected'].includes(accountStatus)) {
        whereClauses.push(`account_status = ?`);
        params.push(accountStatus);
    }

    const whereSQL = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const [users] = await pool.query(`
        SELECT id, first_name, last_name, email, phone_number, roles, company_name, account_status, suspended_at, suspend_reason, created_at
        FROM users
        ${whereSQL}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    const [countResult] = await pool.query(`SELECT COUNT(*) AS total FROM users ${whereSQL}`, params);
    const total = countResult[0]?.total || 0;

    return res.status(200).json({
        status: 'success',
        data: users,
        pagination: { page, limit, total, total_pages: Math.ceil(total / limit) || 1 }
    });
}

/**
 * Get a single user by ID (includes kitchen info if chef).
 * @param {Object} req - Express request (params.id).
 * @param {Object} res - Express response.
 * @returns {Promise<void>} Sends JSON: 200 { status, data: { user, kitchen? } }, 404 if not found.
 */
async function getUserById_controller(req, res) {
    const { id } = checker(idParamSchema, req.params, res);
    if (!id) return;

    const [users] = await pool.query(`
        SELECT id, first_name, last_name, email, phone_number, roles, company_name, account_status, suspended_at, suspend_reason, created_at
        FROM users WHERE id = ?
    `, [id]);

    if (users.length === 0) {
        return res.status(404).json({ status: 'error', message: 'المستخدم غير موجود' });
    }

    let kitchen = null;
    if (users[0].roles === 'chef') {
        const [kitchens] = await pool.query(`
            SELECT id, title, city, phone_number, created_at FROM kitchens WHERE user_id = ?
        `, [id]);
        kitchen = kitchens[0] || null;
    }

    return res.status(200).json({
        status: 'success',
        data: { ...users[0], kitchen }
    });
}

/**
 * Update a user by admin (name, phone, role).
 * Prevents admin from removing their own admin role.
 * @param {Object} req - Express request (params.id, body: first_name, last_name, phone_number, roles).
 * @param {Object} res - Express response.
 * @returns {Promise<void>} Sends JSON: 200 success, 400/404/409 on validation/not found/conflict.
 */
async function updateUserByAdmin_controller(req, res) {
    const { id } = checker(idParamSchema, req.params, res);
    if (!id) return;

    const validated = checker(userUpdateSchema, req.body, res);
    if (!validated) return;

    const [existing] = await pool.query(`SELECT id, roles FROM users WHERE id = ?`, [id]);
    if (existing.length === 0) {
        return res.status(404).json({ status: 'error', message: 'المستخدم غير موجود' });
    }

    if (parseInt(id) === req.user.id && validated.roles && validated.roles !== 'admin') {
        return res.status(400).json({ status: 'error', message: 'لا يمكنك إزالة صلاحية الأدمن من حسابك' });
    }

    const updates = [];
    const params = [];

    if (validated.first_name !== undefined) { updates.push('first_name = ?'); params.push(validated.first_name); }
    if (validated.last_name !== undefined) { updates.push('last_name = ?'); params.push(validated.last_name); }
    if (validated.phone_number !== undefined) {
        const [phoneCheck] = await pool.query(`SELECT id FROM users WHERE phone_number = ? AND id != ?`, [validated.phone_number, id]);
        if (phoneCheck.length > 0) {
            return res.status(409).json({ status: 'error', message: 'رقم الهاتف مستخدم بالفعل' });
        }
        updates.push('phone_number = ?');
        params.push(validated.phone_number);
    }
    if (validated.roles !== undefined) { updates.push('roles = ?'); params.push(validated.roles); }

    if (updates.length === 0) {
        return res.status(400).json({ status: 'error', message: 'لا توجد بيانات للتحديث' });
    }

    params.push(id);
    await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);

    return res.status(200).json({ status: 'success', message: 'تم تحديث بيانات المستخدم بنجاح' });
}

/**
 * Delete a user by admin.
 * Prevents self-deletion and deletion of users who own a kitchen.
 * @param {Object} req - Express request (params.id).
 * @param {Object} res - Express response.
 * @returns {Promise<void>} Sends JSON: 200 success, 400/404/409 on validation/not found/conflict.
 */
async function deleteUserByAdmin_controller(req, res) {
    const { id } = checker(idParamSchema, req.params, res);
    if (!id) return;

    try {
        if (parseInt(id) === req.user.id) {
            return res.status(400).json({ status: 'error', message: 'لا يمكنك حذف حسابك الحالي' });
        }

        const [existing] = await pool.query(`SELECT id FROM users WHERE id = ?`, [id]);
        if (existing.length === 0) {
            return res.status(404).json({ status: 'error', message: 'المستخدم غير موجود' });
        }

        const [hasKitchen] = await pool.query(`SELECT id FROM kitchens WHERE user_id = ? LIMIT 1`, [id]);
        if (hasKitchen.length > 0) {
            return res.status(409).json({
                status: 'error',
                message: 'لا يمكن حذف هذا المستخدم لأنه يمتلك عربية. احذف العربية أولاً'
            });
        }

        await pool.query(`DELETE FROM users WHERE id = ?`, [id]);
        return res.status(200).json({ status: 'success', message: 'تم حذف المستخدم بنجاح' });
    } catch (error) {
        console.error('Delete User Error:', error && error.message);
        return res.status(500).json({ status: 'error', message: 'حدث خطأ أثناء حذف المستخدم' });
    }
}

// =========================================================
// 3. KITCHENS
// =========================================================

/**
 * List all kitchens with pagination, search, and city filter.
 * Includes chef name, dish count, review count, average rating, and fair score.
 * @param {Object} req - Express request (query: page, limit, q, city).
 * @param {Object} res - Express response.
 * @returns {Promise<void>} Sends JSON: 200 { status, data: kitchens[], pagination }.
 */
async function getAllKitchensAdmin_controller(req, res) {
    try {
        const page = Math.max(parseInt(req.query.page) || 1, 1);
        const limit = Math.min(parseInt(req.query.limit) || 20, 50);
        const offset = (page - 1) * limit;
        const q = req.query.q || '';
        const city = req.query.city || '';
        const status = req.query.status || '';

        let whereClauses = [];
        let params = [];

        if (q) {
            const keyword = `%${q}%`;
            whereClauses.push(`(k.title LIKE ? OR k.description LIKE ? OR CONCAT(u.first_name,' ',u.last_name) LIKE ?)`);
            params.push(keyword, keyword, keyword);
        }
        if (city) {
            whereClauses.push(`k.city = ?`);
            params.push(city);
        }
        if (status) {
            whereClauses.push(`k.status = ?`);
            params.push(status);
        }

        const whereSQL = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

        const [kitchens] = await pool.query(`
            SELECT 
                k.id, k.title, k.city, k.address, k.phone_number, k.image_url, k.portfolio_url, k.status, k.created_at,
                CONCAT(u.first_name, ' ', u.last_name) AS chef_name,
                u.id AS chef_id,
                u.account_status AS chef_status,
                COUNT(DISTINCT d.id) AS dishes_count,
                COUNT(r.id) AS reviews_count,
                ROUND(AVG(r.rating), 2) AS avg_rating
            FROM kitchens k
            JOIN users u ON u.id = k.user_id
            LEFT JOIN dishes d ON d.kitchen_id = k.id
            LEFT JOIN reviews r ON r.dish_id = d.id
            ${whereSQL}
            GROUP BY k.id
            ORDER BY k.created_at DESC
            LIMIT ? OFFSET ?
        `, [...params, limit, offset]);

        const kitchensWithScore = kitchens.map(k => ({
            ...k,
            fair_score: calcFairScore(k.reviews_count, k.avg_rating)
        }));

        const [countResult] = await pool.query(`
            SELECT COUNT(DISTINCT k.id) AS total
            FROM kitchens k
            JOIN users u ON u.id = k.user_id
            ${whereSQL}
        `, params);

        const total = countResult[0]?.total || 0;

        return res.status(200).json({
            status: 'success',
            data: kitchensWithScore,
            pagination: { page, limit, total, total_pages: Math.ceil(total / limit) || 1 }
        });
    } catch (error) {
        console.error('Get All Kitchens Admin Error:', error && error.message);
        return res.status(500).json({ status: 'error', message: 'حدث خطأ أثناء جلب العربيات' });
    }
}

/**
 * Get a single kitchen by ID with stats (dish count, reviews, fair score).
 * @param {Object} req - Express request (params.id).
 * @param {Object} res - Express response.
 * @returns {Promise<void>} Sends JSON: 200 { status, data: kitchen }, 404 if not found.
 */
async function getKitchenByIdAdmin_controller(req, res) {
    const { id } = checker(idParamSchema, req.params, res);
    if (!id) return;

    try {
        const [kitchens] = await pool.query(`
            SELECT k.*, CONCAT(u.first_name,' ',u.last_name) AS chef_name, u.email AS chef_email, u.phone_number AS chef_phone
            FROM kitchens k
            JOIN users u ON u.id = k.user_id
            WHERE k.id = ?
        `, [id]);

        if (kitchens.length === 0) {
            return res.status(404).json({ status: 'error', message: 'العربية غير موجودة' });
        }

        const [dishesCount] = await pool.query(`SELECT COUNT(*) AS count FROM dishes WHERE kitchen_id = ?`, [id]);
        const [reviewsStats] = await pool.query(`
            SELECT COUNT(r.id) AS reviews_count, ROUND(AVG(r.rating), 2) AS avg_rating
            FROM reviews r
            JOIN dishes d ON d.id = r.dish_id
            WHERE d.kitchen_id = ?
        `, [id]);

        const kitchen = {
            ...kitchens[0],
            dishes_count: dishesCount[0].count,
            reviews_count: reviewsStats[0].reviews_count || 0,
            avg_rating: reviewsStats[0].avg_rating || null,
            fair_score: calcFairScore(reviewsStats[0].reviews_count, reviewsStats[0].avg_rating)
        };

        return res.status(200).json({ status: 'success', data: kitchen });
    } catch (error) {
        console.error('Get Kitchen Admin Error:', error && error.message);
        return res.status(500).json({ status: 'error', message: 'حدث خطأ أثناء جلب العربية' });
    }
}

/**
 * Update a kitchen by admin (title, description, city, address, phone).
 * @param {Object} req - Express request (params.id, body).
 * @param {Object} res - Express response.
 * @returns {Promise<void>} Sends JSON: 200 success, 400/404 on validation/not found.
 */
async function updateKitchenByAdmin_controller(req, res) {
    const { id } = checker(idParamSchema, req.params, res);
    if (!id) return;

    try {
        const [existing] = await pool.query(`SELECT id FROM kitchens WHERE id = ?`, [id]);
        if (existing.length === 0) {
            return res.status(404).json({ status: 'error', message: 'العربية غير موجودة' });
        }

        const { title, description, city, address, phone_number } = req.body;
        const updates = [];
        const params = [];

        if (title !== undefined) { updates.push('title = ?'); params.push(title); }
        if (description !== undefined) { updates.push('description = ?'); params.push(description); }
        if (city !== undefined) { updates.push('city = ?'); params.push(city); }
        if (address !== undefined) { updates.push('address = ?'); params.push(address); }
        if (phone_number !== undefined) { updates.push('phone_number = ?'); params.push(phone_number); }

        if (updates.length === 0) {
            return res.status(400).json({ status: 'error', message: 'لا توجد بيانات للتحديث' });
        }

        params.push(id);
        await pool.query(`UPDATE kitchens SET ${updates.join(', ')} WHERE id = ?`, params);

        return res.status(200).json({ status: 'success', message: 'تم تحديث العربية بنجاح' });
    } catch (error) {
        console.error('Update Kitchen Admin Error:', error && error.message);
        return res.status(500).json({ status: 'error', message: 'حدث خطأ أثناء تحديث العربية' });
    }
}

/**
 * Delete a kitchen by admin (cascades to dishes and reviews).
 * @param {Object} req - Express request (params.id).
 * @param {Object} res - Express response.
 * @returns {Promise<void>} Sends JSON: 200 success, 404 if not found.
 */
async function deleteKitchenByAdmin_controller(req, res) {
    const { id } = checker(idParamSchema, req.params, res);
    if (!id) return;

    try {
        const [existing] = await pool.query(`SELECT id FROM kitchens WHERE id = ?`, [id]);
        if (existing.length === 0) {
            return res.status(404).json({ status: 'error', message: 'العربية غير موجودة' });
        }

        await pool.query(`
            DELETE r FROM reviews r
            JOIN dishes d ON d.id = r.dish_id
            WHERE d.kitchen_id = ?
        `, [id]);

        await pool.query(`DELETE FROM dishes WHERE kitchen_id = ?`, [id]);
        await pool.query(`DELETE FROM kitchens WHERE id = ?`, [id]);

        return res.status(200).json({ status: 'success', message: 'تم حذف العربية وكل ما يتعلق بها بنجاح' });
    } catch (error) {
        console.error('Delete Kitchen Admin Error:', error && error.message);
        return res.status(500).json({ status: 'error', message: 'حدث خطأ أثناء حذف العربية' });
    }
}

// =========================================================
// 4. DISHES
// =========================================================

/**
 * List all dishes with pagination, search, category filter, and kitchen filter.
 * Includes category name, kitchen title, review count, average rating, and fair score.
 * @param {Object} req - Express request (query: page, limit, q, category, kitchen).
 * @param {Object} res - Express response.
 * @returns {Promise<void>} Sends JSON: 200 { status, data: dishes[], pagination }.
 */
async function getAllDishesAdmin_controller(req, res) {
    try {
        const page = Math.max(parseInt(req.query.page) || 1, 1);
        const limit = Math.min(parseInt(req.query.limit) || 20, 50);
        const offset = (page - 1) * limit;
        const q = req.query.q || '';
        const category = req.query.category || '';
        const kitchen = req.query.kitchen || '';

        let whereClauses = [];
        let params = [];

        if (q) {
            const keyword = `%${q}%`;
            whereClauses.push(`(d.name LIKE ? OR d.description LIKE ?)`);
            params.push(keyword, keyword);
        }
        if (category) {
            whereClauses.push(`c.name = ?`);
            params.push(category);
        }
        if (kitchen) {
            whereClauses.push(`k.title = ?`);
            params.push(kitchen);
        }

        const whereSQL = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

        const [dishes] = await pool.query(`
            SELECT 
                d.id, d.name, d.description, d.price, d.image_url, d.ingredients, d.created_at,
                c.name AS category_name,
                k.title AS kitchen_title,
                k.id AS kitchen_id,
                COUNT(r.id) AS reviews_count,
                ROUND(AVG(r.rating), 2) AS avg_rating
            FROM dishes d
            JOIN categories c ON c.id = d.category_id
            JOIN kitchens k ON k.id = d.kitchen_id
            LEFT JOIN reviews r ON r.dish_id = d.id
            ${whereSQL}
            GROUP BY d.id
            ORDER BY d.created_at DESC
            LIMIT ? OFFSET ?
        `, [...params, limit, offset]);

        const dishesWithScore = dishes.map(d => ({
            ...d,
            fair_score: calcFairScore(d.reviews_count, d.avg_rating)
        }));

        const [countResult] = await pool.query(`
            SELECT COUNT(DISTINCT d.id) AS total
            FROM dishes d
            JOIN categories c ON c.id = d.category_id
            JOIN kitchens k ON k.id = d.kitchen_id
            ${whereSQL}
        `, params);

        const total = countResult[0]?.total || 0;

        return res.status(200).json({
            status: 'success',
            data: dishesWithScore,
            pagination: { page, limit, total, total_pages: Math.ceil(total / limit) || 1 }
        });
    } catch (error) {
        console.error('Get All Dishes Admin Error:', error && error.message);
        return res.status(500).json({ status: 'error', message: 'حدث خطأ أثناء جلب الأطباق' });
    }
}

/**
 * Delete a dish by admin (cascades to reviews).
 * @param {Object} req - Express request (params.id).
 * @param {Object} res - Express response.
 * @returns {Promise<void>} Sends JSON: 200 success, 404 if not found.
 */
async function deleteDishByAdmin_controller(req, res) {
    const { id } = checker(idParamSchema, req.params, res);
    if (!id) return;

    try {
        const [existing] = await pool.query(`SELECT id FROM dishes WHERE id = ?`, [id]);
        if (existing.length === 0) {
            return res.status(404).json({ status: 'error', message: 'الطبق غير موجود' });
        }

        await pool.query(`DELETE FROM reviews WHERE dish_id = ?`, [id]);
        await pool.query(`DELETE FROM dishes WHERE id = ?`, [id]);

        return res.status(200).json({ status: 'success', message: 'تم حذف الطبق وكل تقييماته بنجاح' });
    } catch (error) {
        console.error('Delete Dish Admin Error:', error && error.message);
        return res.status(500).json({ status: 'error', message: 'حدث خطأ أثناء حذف الطبق' });
    }
}

// =========================================================
// 5. REVIEWS
// =========================================================

/**
 * List all reviews with pagination, rating filter, and text search (comment/dish/kitchen).
 * @param {Object} req - Express request (query: page, limit, rating, q).
 * @param {Object} res - Express response.
 * @returns {Promise<void>} Sends JSON: 200 { status, data: reviews[], pagination }.
 */
async function getAllReviewsAdmin_controller(req, res) {
    try {
        const page = Math.max(parseInt(req.query.page) || 1, 1);
        const limit = Math.min(parseInt(req.query.limit) || 20, 50);
        const offset = (page - 1) * limit;
        const rating = req.query.rating ? parseInt(req.query.rating) : null;
        const q = req.query.q || '';

        let whereClauses = [];
        let params = [];

        if (rating && rating >= 1 && rating <= 5) {
            whereClauses.push(`r.rating = ?`);
            params.push(rating);
        }
        if (q) {
            whereClauses.push(`(r.comment LIKE ? OR d.name LIKE ? OR k.title LIKE ?)`);
            const keyword = `%${q}%`;
            params.push(keyword, keyword, keyword);
        }

        const whereSQL = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

        const [reviews] = await pool.query(`
            SELECT 
                r.id, r.rating, r.comment, r.created_at,
                CONCAT(u.first_name, ' ', u.last_name) AS user_name,
                u.id AS user_id,
                d.name AS dish_name,
                d.id AS dish_id,
                k.title AS kitchen_name,
                k.id AS kitchen_id
            FROM reviews r
            JOIN users u ON u.id = r.user_id
            JOIN dishes d ON d.id = r.dish_id
            JOIN kitchens k ON k.id = d.kitchen_id
            ${whereSQL}
            ORDER BY r.created_at DESC
            LIMIT ? OFFSET ?
        `, [...params, limit, offset]);

        const [countResult] = await pool.query(`
            SELECT COUNT(*) AS total
            FROM reviews r
            JOIN dishes d ON d.id = r.dish_id
            JOIN kitchens k ON k.id = d.kitchen_id
            ${whereSQL}
        `, params);

        const total = countResult[0]?.total || 0;

        return res.status(200).json({
            status: 'success',
            data: reviews,
            pagination: { page, limit, total, total_pages: Math.ceil(total / limit) || 1 }
        });
    } catch (error) {
        console.error('Get All Reviews Admin Error:', error && error.message);
        return res.status(500).json({ status: 'error', message: 'حدث خطأ أثناء جلب التقييمات' });
    }
}

/**
 * Delete a review by admin.
 * @param {Object} req - Express request (params.id).
 * @param {Object} res - Express response.
 * @returns {Promise<void>} Sends JSON: 200 success, 404 if not found.
 */
async function deleteReviewByAdmin_controller(req, res) {
    const { id } = checker(idParamSchema, req.params, res);
    if (!id) return;

    try {
        const [existing] = await pool.query(`SELECT id FROM reviews WHERE id = ?`, [id]);
        if (existing.length === 0) {
            return res.status(404).json({ status: 'error', message: 'التقييم غير موجود' });
        }

        await pool.query(`DELETE FROM reviews WHERE id = ?`, [id]);
        return res.status(200).json({ status: 'success', message: 'تم حذف التقييم بنجاح' });
    } catch (error) {
        console.error('Delete Review Admin Error:', error && error.message);
        return res.status(500).json({ status: 'error', message: 'حدث خطأ أثناء حذف التقييم' });
    }
}

// =========================================================
// 6. CATEGORIES
// =========================================================

/**
 * List all categories with dish counts.
 * @param {Object} req - Express request.
 * @param {Object} res - Express response.
 * @returns {Promise<void>} Sends JSON: 200 { status, data: categories[] }.
 */
async function getAllCategoriesAdmin_controller(req, res) {
    try {
        const [categories] = await pool.query(`
            SELECT 
                c.id, c.name, c.description, c.created_at,
                COUNT(d.id) AS dishes_count
            FROM categories c
            LEFT JOIN dishes d ON d.category_id = c.id
            GROUP BY c.id
            ORDER BY c.name ASC
        `);

        return res.status(200).json({ status: 'success', data: categories });
    } catch (error) {
        console.error('Get Categories Admin Error:', error && error.message);
        return res.status(500).json({ status: 'error', message: 'حدث خطأ أثناء جلب التصنيفات' });
    }
}

/**
 * Create a new category.
 * @param {Object} req - Express request (body: name, description).
 * @param {Object} res - Express response.
 * @returns {Promise<void>} Sends JSON: 201 created, 409 if duplicate name.
 */
async function createCategoryAdmin_controller(req, res) {
    const validated = checker(categorySchema, req.body, res);
    if (!validated) return;

    const { name, description } = validated;

    try {
        const [existing] = await pool.query(`SELECT id FROM categories WHERE name = ?`, [name]);
        if (existing.length > 0) {
            return res.status(409).json({ status: 'error', message: 'هذا التصنيف موجود بالفعل' });
        }

        const [result] = await pool.query(
            `INSERT INTO categories (name, description) VALUES (?, ?)`,
            [name, description || null]
        );

        return res.status(201).json({
            status: 'success',
            message: 'تم إضافة التصنيف بنجاح',
            data: { id: result.insertId, name, description: description || null }
        });
    } catch (error) {
        console.error('Create Category Admin Error:', error && error.message);
        return res.status(500).json({ status: 'error', message: 'حدث خطأ أثناء إضافة التصنيف' });
    }
}

/**
 * Update a category by admin.
 * @param {Object} req - Express request (params.id, body: name, description).
 * @param {Object} res - Express response.
 * @returns {Promise<void>} Sends JSON: 200 success, 404/409 on not found/duplicate.
 */
async function updateCategoryAdmin_controller(req, res) {
    const { id } = checker(idParamSchema, req.params, res);
    if (!id) return;

    const validated = checker(categorySchema, req.body, res);
    if (!validated) return;

    const { name, description } = validated;

    try {
        const [existing] = await pool.query(`SELECT id FROM categories WHERE id = ?`, [id]);
        if (existing.length === 0) {
            return res.status(404).json({ status: 'error', message: 'التصنيف غير موجود' });
        }

        const [duplicate] = await pool.query(`SELECT id FROM categories WHERE name = ? AND id != ?`, [name, id]);
        if (duplicate.length > 0) {
            return res.status(409).json({ status: 'error', message: 'يوجد تصنيف آخر بنفس الاسم' });
        }

        await pool.query(`UPDATE categories SET name = ?, description = ? WHERE id = ?`, [name, description || null, id]);

        return res.status(200).json({ status: 'success', message: 'تم تحديث التصنيف بنجاح' });
    } catch (error) {
        console.error('Update Category Admin Error:', error && error.message);
        return res.status(500).json({ status: 'error', message: 'حدث خطأ أثناء تحديث التصنيف' });
    }
}

/**
 * Delete a category by admin.
 * Blocks deletion if dishes reference the category.
 * @param {Object} req - Express request (params.id).
 * @param {Object} res - Express response.
 * @returns {Promise<void>} Sends JSON: 200 success, 404/409 on not found/has dishes.
 */
async function deleteCategoryAdmin_controller(req, res) {
    const { id } = checker(idParamSchema, req.params, res);
    if (!id) return;

    try {
        const [existing] = await pool.query(`SELECT id FROM categories WHERE id = ?`, [id]);
        if (existing.length === 0) {
            return res.status(404).json({ status: 'error', message: 'التصنيف غير موجود' });
        }

        const [dishes] = await pool.query(`SELECT id FROM dishes WHERE category_id = ? LIMIT 1`, [id]);
        if (dishes.length > 0) {
            return res.status(409).json({
                status: 'error',
                message: 'لا يمكن حذف هذا التصنيف لأنه يحتوي على أطباق مرتبطة به'
            });
        }

        await pool.query(`DELETE FROM categories WHERE id = ?`, [id]);
        return res.status(200).json({ status: 'success', message: 'تم حذف التصنيف بنجاح' });
    } catch (error) {
        console.error('Delete Category Admin Error:', error && error.message);
        return res.status(500).json({ status: 'error', message: 'حدث خطأ أثناء حذف التصنيف' });
    }
}

// =========================================================
// 7. USER & KITCHEN SUSPENSION / BAN MANAGEMENT
// =========================================================

/**
 * Suspend (ban) a user account.
 * Also suspends associated kitchen if user is a chef.
 * Increments session_version so all active user sessions are invalidated.
 */
async function suspendUser_controller(req, res) {
    const { id } = checker(idParamSchema, req.params, res);
    if (!id) return;

    if (parseInt(id) === req.user.id) {
        return res.status(400).json({ status: 'error', message: 'لا يمكنك إيقاف حسابك الحالي' });
    }

    try {
        const [existing] = await pool.query('SELECT id, roles, account_status FROM users WHERE id = ?', [id]);
        if (existing.length === 0) {
            return res.status(404).json({ status: 'error', message: 'المستخدم غير موجود' });
        }

        if (existing[0].roles === 'admin') {
            return res.status(400).json({ status: 'error', message: 'لا يمكن إيقاف حساب مدير' });
        }

        const reason = req.body.reason ? String(req.body.reason).trim().slice(0, 500) : null;

        await pool.query(
            `UPDATE users 
             SET account_status = 'suspended', 
                 suspended_at = UTC_TIMESTAMP(), 
                 suspended_by = ?, 
                 suspend_reason = ?,
                 session_version = session_version + 1
             WHERE id = ?`,
            [req.user.id, reason, id]
        );

        if (existing[0].roles === 'chef') {
            await pool.query("UPDATE kitchens SET status = 'SUSPENDED' WHERE user_id = ?", [id]);
        }

        return res.status(200).json({ status: 'success', message: 'تم إيقاف الحساب بنجاح' });
    } catch (error) {
        console.error('Suspend User Error:', error && error.message);
        return res.status(500).json({ status: 'error', message: 'حدث خطأ أثناء إيقاف الحساب' });
    }
}

/**
 * Unsuspend (activate) a suspended user account.
 * Also reactivates kitchen if chef.
 */
async function unsuspendUser_controller(req, res) {
    const { id } = checker(idParamSchema, req.params, res);
    if (!id) return;

    try {
        const [existing] = await pool.query('SELECT id, roles, account_status FROM users WHERE id = ?', [id]);
        if (existing.length === 0) {
            return res.status(404).json({ status: 'error', message: 'المستخدم غير موجود' });
        }

        await pool.query(
            `UPDATE users 
             SET account_status = 'approved', 
                 suspended_at = NULL, 
                 suspended_by = NULL, 
                 suspend_reason = NULL,
                 session_version = session_version + 1
             WHERE id = ?`,
            [id]
        );

        if (existing[0].roles === 'chef') {
            await pool.query("UPDATE kitchens SET status = 'ACTIVE' WHERE user_id = ?", [id]);
        }

        return res.status(200).json({ status: 'success', message: 'تم تفعيل الحساب وإلغاء الإيقاف بنجاح' });
    } catch (error) {
        console.error('Unsuspend User Error:', error && error.message);
        return res.status(500).json({ status: 'error', message: 'حدث خطأ أثناء تفعيل الحساب' });
    }
}

/**
 * Suspend a kitchen directly by kitchen ID.
 * Also suspends the owning chef.
 */
async function suspendKitchen_controller(req, res) {
    const { id } = checker(idParamSchema, req.params, res);
    if (!id) return;

    try {
        const [kitchens] = await pool.query('SELECT id, user_id FROM kitchens WHERE id = ?', [id]);
        if (kitchens.length === 0) {
            return res.status(404).json({ status: 'error', message: 'المطبخ غير موجود' });
        }

        const reason = req.body.reason ? String(req.body.reason).trim().slice(0, 500) : null;
        const chefId = kitchens[0].user_id;

        await pool.query("UPDATE kitchens SET status = 'SUSPENDED' WHERE id = ?", [id]);
        await pool.query(
            `UPDATE users 
             SET account_status = 'suspended', 
                 suspended_at = UTC_TIMESTAMP(), 
                 suspended_by = ?, 
                 suspend_reason = ?,
                 session_version = session_version + 1
             WHERE id = ?`,
            [req.user.id, reason, chefId]
        );

        return res.status(200).json({ status: 'success', message: 'تم إيقاف المطبخ وحساب الشيف بنجاح' });
    } catch (error) {
        console.error('Suspend Kitchen Error:', error && error.message);
        return res.status(500).json({ status: 'error', message: 'حدث خطأ أثناء إيقاف المطبخ' });
    }
}

/**
 * Unsuspend a kitchen directly by kitchen ID.
 * Also reactivates the owning chef.
 */
async function unsuspendKitchen_controller(req, res) {
    const { id } = checker(idParamSchema, req.params, res);
    if (!id) return;

    try {
        const [kitchens] = await pool.query('SELECT id, user_id FROM kitchens WHERE id = ?', [id]);
        if (kitchens.length === 0) {
            return res.status(404).json({ status: 'error', message: 'المطبخ غير موجود' });
        }

        const chefId = kitchens[0].user_id;
        await pool.query("UPDATE kitchens SET status = 'ACTIVE' WHERE id = ?", [id]);
        await pool.query(
            `UPDATE users 
             SET account_status = 'approved', 
                 suspended_at = NULL, 
                 suspended_by = NULL, 
                 suspend_reason = NULL,
                 session_version = session_version + 1
             WHERE id = ?`,
            [chefId]
        );

        return res.status(200).json({ status: 'success', message: 'تم تفعيل المطبخ وحساب الشيف بنجاح' });
    } catch (error) {
        console.error('Unsuspend Kitchen Error:', error && error.message);
        return res.status(500).json({ status: 'error', message: 'حدث خطأ أثناء تفعيل المطبخ' });
    }
}

// =========================================================
// 8. KITCHEN ORDERS & FINANCIAL SETTLEMENT REPORTS
// =========================================================

/**
 * Aggregated report of all kitchens with order counts, sales, and platform commissions.
 * Query params: month (YYYY-MM), from_date, to_date, q, kitchen_id.
 */
async function getKitchensReport_controller(req, res) {
    try {
        const month = req.query.month ? String(req.query.month).trim() : null;
        const fromDate = req.query.from_date ? String(req.query.from_date).trim() : null;
        const toDate = req.query.to_date ? String(req.query.to_date).trim() : null;
        const q = req.query.q ? String(req.query.q).trim() : '';
        const kitchenId = req.query.kitchen_id ? Number(req.query.kitchen_id) : null;

        let orderDateConditions = [];
        let orderDateParams = [];

        if (month && /^\d{4}-\d{2}$/.test(month)) {
            orderDateConditions.push("DATE_FORMAT(o.created_at, '%Y-%m') = ?");
            orderDateParams.push(month);
        } else {
            if (fromDate) {
                orderDateConditions.push("o.created_at >= ?");
                orderDateParams.push(fromDate + ' 00:00:00');
            }
            if (toDate) {
                orderDateConditions.push("o.created_at <= ?");
                orderDateParams.push(toDate + ' 23:59:59');
            }
        }

        const orderJoinOn = orderDateConditions.length
            ? `AND ${orderDateConditions.join(' AND ')}`
            : '';

        let kitchenWhere = [];
        let kitchenParams = [];

        if (kitchenId) {
            kitchenWhere.push('k.id = ?');
            kitchenParams.push(kitchenId);
        }
        if (q) {
            kitchenWhere.push('(k.title LIKE ? OR CONCAT(u.first_name, " ", u.last_name) LIKE ? OR k.phone_number LIKE ?)');
            const kw = `%${q}%`;
            kitchenParams.push(kw, kw, kw);
        }

        const whereSQL = kitchenWhere.length ? `WHERE ${kitchenWhere.join(' AND ')}` : '';

        const commissionRate = Number(process.env.CHEF_COMMISSION_PERCENT || 7);

        const sql = `
            SELECT 
                k.id AS kitchen_id,
                k.title AS kitchen_name,
                k.city AS kitchen_city,
                k.address AS kitchen_address,
                k.phone_number AS kitchen_phone,
                k.status AS kitchen_status,
                u.id AS chef_id,
                CONCAT_WS(' ', u.first_name, u.last_name) AS chef_name,
                u.email AS chef_email,
                u.phone_number AS chef_phone,
                u.account_status AS chef_status,
                COUNT(o.id) AS total_orders,
                SUM(CASE WHEN o.status = 'completed' THEN 1 ELSE 0 END) AS completed_orders,
                SUM(CASE WHEN o.status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled_orders,
                SUM(CASE WHEN o.status NOT IN ('completed', 'cancelled') THEN 1 ELSE 0 END) AS active_orders,
                COALESCE(SUM(CASE WHEN o.status = 'completed' THEN o.total_price ELSE 0 END), 0) AS completed_sales,
                COALESCE(SUM(CASE WHEN o.status != 'cancelled' THEN o.total_price ELSE 0 END), 0) AS non_cancelled_sales,
                COALESCE(SUM(o.total_price), 0) AS total_orders_value
            FROM kitchens k
            JOIN users u ON u.id = k.user_id
            LEFT JOIN orders o ON o.kitchen_id = k.id ${orderJoinOn}
            ${whereSQL}
            GROUP BY k.id, u.id
            ORDER BY completed_sales DESC, total_orders DESC
        `;

        const [rows] = await pool.query(sql, [...orderDateParams, ...kitchenParams]);

        let overallTotalOrders = 0;
        let overallCompletedOrders = 0;
        let overallCancelledOrders = 0;
        let overallActiveOrders = 0;
        let overallCompletedSales = 0;
        let overallCommissionDue = 0;
        let overallNetPayout = 0;

        const data = rows.map(r => {
            const completedSales = Number(Number(r.completed_sales).toFixed(2));
            const commission = Number((completedSales * (commissionRate / 100)).toFixed(2));
            const netPayout = Number((completedSales - commission).toFixed(2));

            overallTotalOrders += Number(r.total_orders);
            overallCompletedOrders += Number(r.completed_orders);
            overallCancelledOrders += Number(r.cancelled_orders);
            overallActiveOrders += Number(r.active_orders);
            overallCompletedSales += completedSales;
            overallCommissionDue += commission;
            overallNetPayout += netPayout;

            return {
                ...r,
                total_orders: Number(r.total_orders),
                completed_orders: Number(r.completed_orders),
                cancelled_orders: Number(r.cancelled_orders),
                active_orders: Number(r.active_orders),
                completed_sales: completedSales,
                non_cancelled_sales: Number(Number(r.non_cancelled_sales).toFixed(2)),
                total_orders_value: Number(Number(r.total_orders_value).toFixed(2)),
                commission_rate: commissionRate,
                platform_commission: commission,
                net_kitchen_payout: netPayout
            };
        });

        return res.status(200).json({
            status: 'success',
            period: { month, from_date: fromDate, to_date: toDate },
            summary: {
                total_kitchens: data.length,
                overall_total_orders: overallTotalOrders,
                overall_completed_orders: overallCompletedOrders,
                overall_cancelled_orders: overallCancelledOrders,
                overall_active_orders: overallActiveOrders,
                overall_completed_sales: Number(overallCompletedSales.toFixed(2)),
                overall_commission_due: Number(overallCommissionDue.toFixed(2)),
                overall_net_payout: Number(overallNetPayout.toFixed(2)),
                commission_rate: commissionRate
            },
            data
        });
    } catch (error) {
        console.error('Kitchens Report Error:', error && error.message);
        return res.status(500).json({ status: 'error', message: 'حدث خطأ أثناء جلب تقرير المطابخ' });
    }
}

/**
 * Detailed list of orders for a specific kitchen.
 */
async function getKitchenOrdersReport_controller(req, res) {
    const { id } = checker(idParamSchema, req.params, res);
    if (!id) return;

    try {
        const month = req.query.month ? String(req.query.month).trim() : null;
        const status = req.query.status ? String(req.query.status).trim() : null;

        let whereClauses = ['o.kitchen_id = ?'];
        let params = [id];

        if (status) {
            whereClauses.push('o.status = ?');
            params.push(status);
        }
        if (month && /^\d{4}-\d{2}$/.test(month)) {
            whereClauses.push("DATE_FORMAT(o.created_at, '%Y-%m') = ?");
            params.push(month);
        }

        const [kitchens] = await pool.query(
            'SELECT k.id, k.title, k.city, k.phone_number, k.status, CONCAT_WS(" ", u.first_name, u.last_name) AS chef_name FROM kitchens k JOIN users u ON u.id = k.user_id WHERE k.id = ?',
            [id]
        );

        if (kitchens.length === 0) {
            return res.status(404).json({ status: 'error', message: 'المطبخ غير موجود' });
        }

        const [orders] = await pool.query(
            `SELECT o.id, o.public_id, o.order_name, o.dish_name, o.quantity, o.unit_price, o.discount_amount,
                    o.total_price, o.delivery_fee_amount, o.status, o.customer_name, o.customer_phone, o.customer_address,
                    o.created_at, o.completed_at, o.delivery_id,
                    CONCAT_WS(' ', d.first_name, d.last_name) AS delivery_name,
                    d.phone_number AS delivery_phone,
                    d.company_name AS delivery_company
             FROM orders o
             LEFT JOIN users d ON d.id = o.delivery_id
             WHERE ${whereClauses.join(' AND ')}
             ORDER BY o.created_at DESC`,
            params
        );

        const ordersWithCode = orders.map(o => ({
            ...o,
            order_code: String(o.public_id).slice(0, 8).toUpperCase()
        }));

        const commissionRate = Number(process.env.CHEF_COMMISSION_PERCENT || 7);
        const completedSales = orders
            .filter(o => o.status === 'completed')
            .reduce((sum, o) => sum + Number(o.total_price), 0);
        const commission = Number((completedSales * (commissionRate / 100)).toFixed(2));
        const netPayout = Number((completedSales - commission).toFixed(2));

        return res.status(200).json({
            status: 'success',
            kitchen: kitchens[0],
            financials: {
                total_orders: orders.length,
                completed_orders: orders.filter(o => o.status === 'completed').length,
                completed_sales: Number(completedSales.toFixed(2)),
                commission_rate: commissionRate,
                commission_amount: commission,
                net_payout: netPayout
            },
            data: ordersWithCode
        });
    } catch (error) {
        console.error('Kitchen Orders Report Error:', error && error.message);
        return res.status(500).json({ status: 'error', message: 'حدث خطأ أثناء جلب تفاصيل طلبات المطبخ' });
    }
}

// =========================================================
// 9. DELIVERY COMPANIES ORDERS & FINANCIAL SETTLEMENT REPORTS
// =========================================================

/**
 * Aggregated report of all delivery companies with orders count, fees, and commissions.
 * Query params: month (YYYY-MM), from_date, to_date, q, delivery_id.
 */
async function getDeliveryReport_controller(req, res) {
    try {
        const month = req.query.month ? String(req.query.month).trim() : null;
        const fromDate = req.query.from_date ? String(req.query.from_date).trim() : null;
        const toDate = req.query.to_date ? String(req.query.to_date).trim() : null;
        const q = req.query.q ? String(req.query.q).trim() : '';
        const deliveryId = req.query.delivery_id ? Number(req.query.delivery_id) : null;

        let orderDateConditions = [];
        let orderDateParams = [];

        if (month && /^\d{4}-\d{2}$/.test(month)) {
            orderDateConditions.push("DATE_FORMAT(o.created_at, '%Y-%m') = ?");
            orderDateParams.push(month);
        } else {
            if (fromDate) {
                orderDateConditions.push("o.created_at >= ?");
                orderDateParams.push(fromDate + ' 00:00:00');
            }
            if (toDate) {
                orderDateConditions.push("o.created_at <= ?");
                orderDateParams.push(toDate + ' 23:59:59');
            }
        }

        const orderJoinOn = orderDateConditions.length
            ? `AND ${orderDateConditions.join(' AND ')}`
            : '';

        let deliveryWhere = ["u.roles = 'delivery'"];
        let deliveryParams = [];

        if (deliveryId) {
            deliveryWhere.push('u.id = ?');
            deliveryParams.push(deliveryId);
        }
        if (q) {
            deliveryWhere.push('(u.company_name LIKE ? OR CONCAT(u.first_name, " ", u.last_name) LIKE ? OR u.phone_number LIKE ?)');
            const kw = `%${q}%`;
            deliveryParams.push(kw, kw, kw);
        }

        const commissionRate = Number(process.env.DELIVERY_COMMISSION_PERCENT || 7);
        const commissionBasis = process.env.DELIVERY_COMMISSION_BASIS || 'order_total';

        const sql = `
            SELECT 
                u.id AS delivery_id,
                COALESCE(u.company_name, CONCAT_WS(' ', u.first_name, u.last_name)) AS company_name,
                CONCAT_WS(' ', u.first_name, u.last_name) AS contact_name,
                u.email,
                u.phone_number,
                u.city,
                u.account_status,
                u.created_at,
                COUNT(o.id) AS total_assigned_orders,
                SUM(CASE WHEN o.status = 'completed' THEN 1 ELSE 0 END) AS completed_orders,
                SUM(CASE WHEN o.status IN ('accepted', 'out_for_delivery') THEN 1 ELSE 0 END) AS active_orders,
                COALESCE(SUM(CASE WHEN o.status = 'completed' THEN o.total_price ELSE 0 END), 0) AS completed_order_value,
                COALESCE(SUM(CASE WHEN o.status = 'completed' THEN o.delivery_fee_amount ELSE 0 END), 0) AS total_delivery_fees
            FROM users u
            LEFT JOIN orders o ON o.delivery_id = u.id ${orderJoinOn}
            WHERE ${deliveryWhere.join(' AND ')}
            GROUP BY u.id
            ORDER BY completed_orders DESC, total_delivery_fees DESC
        `;

        const [rows] = await pool.query(sql, [...orderDateParams, ...deliveryParams]);

        let overallAssignedOrders = 0;
        let overallCompletedOrders = 0;
        let overallActiveOrders = 0;
        let overallOrderValue = 0;
        let overallDeliveryFees = 0;
        let overallCommissionDue = 0;
        let overallNetPayout = 0;

        const data = rows.map(r => {
            const completedValue = Number(Number(r.completed_order_value).toFixed(2));
            const deliveryFees = Number(Number(r.total_delivery_fees).toFixed(2));

            const baseAmount = commissionBasis === 'delivery_fee' ? deliveryFees : completedValue;
            const commission = Number((baseAmount * (commissionRate / 100)).toFixed(2));
            const netPayout = Number((deliveryFees - commission).toFixed(2));

            overallAssignedOrders += Number(r.total_assigned_orders);
            overallCompletedOrders += Number(r.completed_orders);
            overallActiveOrders += Number(r.active_orders);
            overallOrderValue += completedValue;
            overallDeliveryFees += deliveryFees;
            overallCommissionDue += commission;
            overallNetPayout += netPayout;

            return {
                ...r,
                total_assigned_orders: Number(r.total_assigned_orders),
                completed_orders: Number(r.completed_orders),
                active_orders: Number(r.active_orders),
                completed_order_value: completedValue,
                total_delivery_fees: deliveryFees,
                commission_rate: commissionRate,
                commission_basis: commissionBasis,
                platform_commission: commission,
                net_delivery_payout: netPayout
            };
        });

        return res.status(200).json({
            status: 'success',
            period: { month, from_date: fromDate, to_date: toDate },
            summary: {
                total_delivery_companies: data.length,
                overall_assigned_orders: overallAssignedOrders,
                overall_completed_orders: overallCompletedOrders,
                overall_active_orders: overallActiveOrders,
                overall_order_value: Number(overallOrderValue.toFixed(2)),
                overall_delivery_fees: Number(overallDeliveryFees.toFixed(2)),
                overall_commission_due: Number(overallCommissionDue.toFixed(2)),
                overall_net_payout: Number(overallNetPayout.toFixed(2)),
                commission_rate: commissionRate,
                commission_basis: commissionBasis
            },
            data
        });
    } catch (error) {
        console.error('Delivery Report Error:', error && error.message);
        return res.status(500).json({ status: 'error', message: 'حدث خطأ أثناء جلب تقرير شركات الدليفري' });
    }
}

/**
 * Detailed list of orders handled by a specific delivery company.
 */
async function getDeliveryOrdersReport_controller(req, res) {
    const { id } = checker(idParamSchema, req.params, res);
    if (!id) return;

    try {
        const month = req.query.month ? String(req.query.month).trim() : null;
        const status = req.query.status ? String(req.query.status).trim() : null;

        let whereClauses = ['o.delivery_id = ?'];
        let params = [id];

        if (status) {
            whereClauses.push('o.status = ?');
            params.push(status);
        }
        if (month && /^\d{4}-\d{2}$/.test(month)) {
            whereClauses.push("DATE_FORMAT(o.created_at, '%Y-%m') = ?");
            params.push(month);
        }

        const [users] = await pool.query(
            'SELECT id, company_name, first_name, last_name, email, phone_number, city, account_status FROM users WHERE id = ? AND roles = "delivery"',
            [id]
        );

        if (users.length === 0) {
            return res.status(404).json({ status: 'error', message: 'شركة الدليفري غير موجودة' });
        }

        const [orders] = await pool.query(
            `SELECT o.id, o.public_id, o.order_name, o.dish_name, o.kitchen_name, o.kitchen_phone, o.kitchen_address,
                    o.customer_name, o.customer_phone, o.customer_address, o.quantity, o.unit_price,
                    o.total_price, o.delivery_fee_amount, o.status, o.created_at, o.accepted_at, o.completed_at
             FROM orders o
             WHERE ${whereClauses.join(' AND ')}
             ORDER BY o.created_at DESC`,
            params
        );

        const ordersWithCode = orders.map(o => ({
            ...o,
            order_code: String(o.public_id).slice(0, 8).toUpperCase()
        }));

        const commissionRate = Number(process.env.DELIVERY_COMMISSION_PERCENT || 7);
        const commissionBasis = process.env.DELIVERY_COMMISSION_BASIS || 'order_total';

        const completedOrders = orders.filter(o => o.status === 'completed');
        const completedValue = completedOrders.reduce((sum, o) => sum + Number(o.total_price), 0);
        const deliveryFees = completedOrders.reduce((sum, o) => sum + Number(o.delivery_fee_amount), 0);

        const baseAmount = commissionBasis === 'delivery_fee' ? deliveryFees : completedValue;
        const commission = Number((baseAmount * (commissionRate / 100)).toFixed(2));
        const netPayout = Number((deliveryFees - commission).toFixed(2));

        return res.status(200).json({
            status: 'success',
            delivery_user: users[0],
            financials: {
                total_orders: orders.length,
                completed_orders: completedOrders.length,
                total_order_value: Number(completedValue.toFixed(2)),
                total_delivery_fees: Number(deliveryFees.toFixed(2)),
                commission_rate: commissionRate,
                commission_basis: commissionBasis,
                commission_amount: commission,
                net_payout: netPayout
            },
            data: ordersWithCode
        });
    } catch (error) {
        console.error('Delivery Orders Report Error:', error && error.message);
        return res.status(500).json({ status: 'error', message: 'حدث خطأ أثناء جلب تفاصيل طلبات شركة الدليفري' });
    }
}

// =========================================================
// EXPORTS
// =========================================================
module.exports = {
    // Dashboard
    getAdminDashboard_controller,

    // Users
    getAllUsers_controller,
    getUserById_controller,
    updateUserByAdmin_controller,
    deleteUserByAdmin_controller,
    suspendUser_controller,
    unsuspendUser_controller,

    // Kitchens
    getAllKitchensAdmin_controller,
    getKitchenByIdAdmin_controller,
    updateKitchenByAdmin_controller,
    deleteKitchenByAdmin_controller,
    suspendKitchen_controller,
    unsuspendKitchen_controller,

    // Dishes
    getAllDishesAdmin_controller,
    deleteDishByAdmin_controller,

    // Reviews
    getAllReviewsAdmin_controller,
    deleteReviewByAdmin_controller,

    // Categories
    getAllCategoriesAdmin_controller,
    createCategoryAdmin_controller,
    updateCategoryAdmin_controller,
    deleteCategoryAdmin_controller,

    // Financial Reports & Settlements
    getKitchensReport_controller,
    getKitchenOrdersReport_controller,
    getDeliveryReport_controller,
    getDeliveryOrdersReport_controller
};