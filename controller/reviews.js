/**
 * Reviews controller: handlers for listing, creating, updating, and deleting reviews,
 * plus aggregated summaries (average rating, distribution, Bayesian fair score)
 * for dishes, kitchens, chefs, and admin.
 */
const pool = require("../database/pool");
const checker = require("../utiles/checker");
const {
    searchQuerySchema,
    idParamSchema,
    reviewSchema,
    reviewUpdateSchema,
    reviewsListQuerySchema
} = require('../utiles/validation');
const allRows = require('../middlware/allRows');

// ======================
// 1. Reviews for a specific dish
// ======================

/**
 * Get all reviews for a specific dish with a summary (counts per star, average, fair score).
 * @param {Object} req - Express request.
 * @param {string} req.params.id - Dish ID.
 * @param {Object} [req.query] - Pagination/filter options validated by reviewsListQuerySchema (page, limit, q, rating, sort_order).
 * @param {Object} [req.user] - Optional logged-in user; when present their review is sorted first.
 * @param {Object} res - Express response.
 * @returns {Promise<void>} Sends JSON: 200 { status, data: { reviews, summary } }, 400 on invalid query, 404 if dish not found.
 */
async function getAllReviewsForDish_controller(req, res) {
    const { id } = req.params;
    const userId = req.user?.id; // إذا كان المستخدم مسجل الدخول

    const { error, value } = reviewsListQuerySchema.validate(req.query, {
        abortEarly: false,
        convert: true
    });

    if (error) {
        return res.status(400).json({
            status: 'error',
            message: error.details.map(d => d.message).join(' | ')
        });
    }

    const {
        page, limit, q, rating, sort_order
    } = value;


    // التحقق إن الطبق موجود
    const [dish] = await pool.query(`SELECT id, name FROM dishes WHERE id = ? LIMIT 1`, [id]);
    if (dish.length === 0) {
        return res.status(404).json({ status: 'error', message: 'الطبق غير موجود' });
    }

    // جلب التقييمات مع ترتيب: تقييم المستخدم أولاً (إن وجد)
    let query = `
        SELECT r.*, u.first_name, u.last_name
        FROM reviews r
        JOIN users u ON r.user_id = u.id
        WHERE r.dish_id = ?
    `;

    let params = [id, limit];

    // إذا كان المستخدم مسجل، جلب تقييمه أولاً
    if (userId) {
        query = `
            SELECT r.*, u.first_name, u.last_name,
                   CASE WHEN r.user_id = ? THEN 0 ELSE 1 END AS is_other
            FROM reviews r
            JOIN users u ON r.user_id = u.id
            WHERE r.dish_id = ?
            ORDER BY is_other ASC, r.created_at DESC
            LIMIT ?
        `;
        params = [userId, id, limit];
    } else {
        query += ` ORDER BY r.created_at DESC LIMIT ?`;
    }

    const [reviews] = await pool.query(query, params);

    // Summary + Fair Score (Bayesian average: C=20, m=4.2)
    const C = 20;
    const m = 4.2;

    const [summaryResult] = await pool.query(`
        SELECT 
            COUNT(r.id) AS total_reviews,
            ROUND(AVG(r.rating), 2) AS average_rating,
            SUM(CASE WHEN r.rating = 5 THEN 1 ELSE 0 END) AS star_5,
            SUM(CASE WHEN r.rating = 4 THEN 1 ELSE 0 END) AS star_4,
            SUM(CASE WHEN r.rating = 3 THEN 1 ELSE 0 END) AS star_3,
            SUM(CASE WHEN r.rating = 2 THEN 1 ELSE 0 END) AS star_2,
            SUM(CASE WHEN r.rating = 1 THEN 1 ELSE 0 END) AS star_1,
            ROUND(
                (COUNT(r.id) * COALESCE(AVG(r.rating), 0) + ? * ?) / 
                NULLIF(COUNT(r.id) + ?, 0)
            , 3) AS fair_score
        FROM reviews r
        WHERE r.dish_id = ?
    `, [C, m, C, id]);

    const summary = {
        total_reviews: summaryResult[0]?.total_reviews || 0,
        average_rating: summaryResult[0]?.average_rating || 0,
        fair_score: summaryResult[0]?.fair_score || 0,
        rating_distribution: {
            5: summaryResult[0]?.star_5 || 0,
            4: summaryResult[0]?.star_4 || 0,
            3: summaryResult[0]?.star_3 || 0,
            2: summaryResult[0]?.star_2 || 0,
            1: summaryResult[0]?.star_1 || 0
        }
    };

    return res.status(200).json({
        status: 'success',
        data: {
            reviews,
            summary
        }
    });
}

/**
 * List reviews across dishes/kitchens with filters, pagination, and an aggregate summary
 * that is intentionally NOT affected by the comment/rating filters (only by type/id/city/category).
 * @param {Object} req - Express request.
 * @param {Object} req.query - Validated by reviewsListQuerySchema: type ('dish'|'kitchen'), id, page, limit, q, rating, sort_order, city, category.
 * @param {Object} res - Express response.
 * @returns {Promise<void>} Sends JSON: 200 { status, data: { type, id, entity_name, reviews, summary }, pagination }, 400 on invalid query, 404 if referenced dish/kitchen not found.
 */
async function getReviewsList_controller(req, res) {
    // 1. التحقق من صحة المعاملات
    const { error, value } = reviewsListQuerySchema.validate(req.query, {
        abortEarly: false,
        convert: true
    });
    if (error) {
        return res.status(400).json({
            status: 'error',
            message: error.details.map(d => d.message).join(' | ')
        });
    }

    const {
        type, id, page, limit, q, rating, sort_order,
        city, category
    } = value;

    const pageNum = page;
    const pageLimit = limit;
    const offset = (pageNum - 1) * pageLimit;
    const safeSortOrder = String(sort_order).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    let entityName = null;
    const whereClauses = [];
    const queryParams = [];

    // 2. فلتر type / id (إذا وُجدوا)
    if (type && id !== undefined) {
        if (type === 'dish') {
            const [rows] = await pool.query('SELECT id, name FROM dishes WHERE id = ?', [id]);
            if (rows.length === 0) {
                return res.status(404).json({ status: 'error', message: 'الطبق غير موجود' });
            }
            entityName = rows[0].name;
            whereClauses.push('reviews.dish_id = ?');
            queryParams.push(id);
        } else if (type === 'kitchen') {
            const [rows] = await pool.query('SELECT id, title FROM kitchens WHERE id = ?', [id]);
            if (rows.length === 0) {
                return res.status(404).json({ status: 'error', message: 'المطبخ غير موجود' });
            }
            entityName = rows[0].title;
            whereClauses.push('dishes.kitchen_id = ?');
            queryParams.push(id);
        }
    }

    // 3. فلاتر إضافية
    if (q) {
        whereClauses.push('reviews.comment LIKE ?');
        queryParams.push(`%${q}%`);
    }
    if (rating !== undefined && rating !== null) {
        whereClauses.push('reviews.rating = ?');
        queryParams.push(rating);
    }
    if (city) {
        whereClauses.push('kitchens.city LIKE ?');
        queryParams.push(`%${city}%`);
    }
    if (category) {
        whereClauses.push('categories.name LIKE ?');
        queryParams.push(`%${category}%`);
    }

    const whereSQL = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // 4. JOIN categories (دائماً LEFT JOIN لعرض الفئة إن وجدت)
    const categoryJoin = `LEFT JOIN categories ON categories.id = dishes.category_id`;

    // 5. استعلام جلب التقييمات
    const dataQuery = `
        SELECT
            reviews.id, reviews.rating, reviews.comment,
            reviews.created_at, reviews.user_id, reviews.dish_id,
            users.first_name, users.last_name,
            dishes.name AS dish_name,
            dishes.image_url AS dish_image,
            kitchens.title AS kitchen_name,
            kitchens.city AS kitchen_city,
            kitchens.address AS kitchen_address,
            categories.name AS category_name
        FROM reviews
        JOIN users ON users.id = reviews.user_id
        JOIN dishes ON dishes.id = reviews.dish_id
        JOIN kitchens ON kitchens.id = dishes.kitchen_id
        ${categoryJoin}
        ${whereSQL}
        ORDER BY reviews.created_at ${safeSortOrder}
        LIMIT ? OFFSET ?
    `;
    const [reviews] = await pool.query(dataQuery, [...queryParams, pageLimit, offset]);

    // 6. Total count
    const countQuery = `
        SELECT COUNT(1) AS total
        FROM reviews
        JOIN dishes ON dishes.id = reviews.dish_id
        JOIN kitchens ON kitchens.id = dishes.kitchen_id
        ${categoryJoin}
        ${whereSQL}
    `;
    const [countResult] = await pool.query(countQuery, queryParams);
    const total = countResult[0]?.total || 0;

    // 7. Summary (بدون تأثير q/rating)
    const summaryWhereParts = [];
    const summaryParams = [];

    if (type && id !== undefined) {
        if (type === 'dish') {
            summaryWhereParts.push('reviews.dish_id = ?');
            summaryParams.push(id);
        } else if (type === 'kitchen') {
            summaryWhereParts.push('dishes.kitchen_id = ?');
            summaryParams.push(id);
        }
    }
    if (city) {
        summaryWhereParts.push('kitchens.city LIKE ?');
        summaryParams.push(`%${city}%`);
    }
    if (category) {
        summaryWhereParts.push('categories.name LIKE ?');
        summaryParams.push(`%${category}%`);
    }

    const summaryWhereSQL = summaryWhereParts.length ? `WHERE ${summaryWhereParts.join(' AND ')}` : '';
    const summaryJoin = `LEFT JOIN categories ON categories.id = dishes.category_id`;

    const [summaryRows] = await pool.query(`
        SELECT
            COUNT(reviews.id) AS total_reviews,
            ROUND(AVG(reviews.rating), 2) AS average_rating,
            SUM(reviews.rating = 5) AS star_5,
            SUM(reviews.rating = 4) AS star_4,
            SUM(reviews.rating = 3) AS star_3,
            SUM(reviews.rating = 2) AS star_2,
            SUM(reviews.rating = 1) AS star_1,
            ROUND(
                (COUNT(reviews.id) * AVG(reviews.rating) + ? * ?) / (COUNT(reviews.id) + ?)
            , 3) AS fair_score
        FROM reviews
        JOIN dishes ON dishes.id = reviews.dish_id
        JOIN kitchens ON kitchens.id = dishes.kitchen_id
        ${summaryJoin}
        ${summaryWhereSQL}
    `, [C, m, C, ...summaryParams]);

    const s = summaryRows[0] || {};
    const summary = {
        total_reviews: s.total_reviews || 0,
        average_rating: s.average_rating || 0,
        fair_score: s.fair_score || 0,
        rating_distribution: {
            5: s.star_5 || 0,
            4: s.star_4 || 0,
            3: s.star_3 || 0,
            2: s.star_2 || 0,
            1: s.star_1 || 0
        }
    };

    // 8. الرد
    return res.status(200).json({
        status: 'success',
        data: {
            type: type || null,
            id: id || null,
            entity_name: entityName,
            reviews,
            summary
        },
        pagination: {
            page: pageNum,
            limit: pageLimit,
            total,
            total_pages: Math.ceil(total / pageLimit) || 1
        }
    });
}

// ======================
// 3. Chef Dashboard (with Stats + Top Dishes)
// ======================

/**
 * Chef dashboard view: reviews written on the chef's dishes, optionally filtered by kitchen,
 * with aggregated stats and top dishes (ranked by Bayesian fair score) when include_stats is set.
 * @param {Object} req - Express request.
 * @param {string} req.user.id - Authenticated chef's user ID.
 * @param {Object} req.query - searchQuerySchema fields (q, rating, page, limit, sort_by, sort_order) plus raw kitchen_id and include_stats.
 * @param {Object} res - Express response.
 * @returns {Promise<void>} Sends JSON: 200 { status, data: { reviews, (stats, top_dishes)? }, pagination }, 400 on invalid query, 403 if kitchen_id does not belong to the chef.
 */
async function getChefReviews_controller(req, res) {
    const userId = req.user.id;

    const { error, value } = searchQuerySchema.validate(req.query);
    if (error) {
        return res.status(400).json({
            status: 'error',
            message: error.details[0].message
        });
    }

    const {
        q,
        rating,
        page = 1,
        limit = 10,
        sort_by = 'created_at',
        sort_order = 'DESC'
    } = value;

    const { kitchen_id, include_stats } = req.query;
    const wantStats = include_stats === 'true' || include_stats === '1';

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const pageLimit = parseInt(limit, 10);
    const pageOffset = parseInt(offset, 10);

    // التحقق من ملكية المطبخ
    if (kitchen_id) {
        const [kitchen] = await pool.query(
            `SELECT id FROM kitchens WHERE id = ? AND user_id = ?`,
            [kitchen_id, userId]
        );

        if (kitchen.length === 0) {
            return res.status(403).json({
                status: 'error',
                message: 'غير مصرح لك بالوصول لبيانات هذا المطبخ أو المطبخ غير موجود'
            });
        }
    }

    // ---- Reviews ----
    const tableName = 'reviews';
    const joinClause = `
        JOIN dishes ON ${tableName}.dish_id = dishes.id
        JOIN kitchens ON dishes.kitchen_id = kitchens.id
        JOIN users ON users.id=reviews.user_id
    `;

    const selectFields = `
        ${tableName}*, 
        dishes.name AS dish_name, 
        kitchens.title AS kitchen_title,
        users.first_name,
        users.last_name
    `;

    let baseQuery = `SELECT ${selectFields} FROM ${tableName} ${joinClause}`;
    let whereClauses = [`kitchens.user_id = ?`];
    let queryParams = [userId];

    if (kitchen_id) {
        whereClauses.push(`kitchens.id = ?`);
        queryParams.push(kitchen_id);
    }

    if (rating !== undefined && rating !== null && rating !== '') {
        whereClauses.push(`${tableName}.rating = ?`);
        queryParams.push(rating);
    }

    if (q) {
        whereClauses.push(`(${tableName}.comment LIKE ?)`);
        queryParams.push(`%${q}%`);
    }

    let finalQuery = baseQuery + ` WHERE ` + whereClauses.join(' AND ');

    const safeSortOrder = sort_order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const allowedSort = ['created_at', 'rating', 'id'];
    const safeSortBy = allowedSort.includes(sort_by) ? sort_by : 'created_at';

    finalQuery += ` ORDER BY ${tableName}.${safeSortBy} ${safeSortOrder} LIMIT ? OFFSET ?`;

    const [reviews] = await pool.query(finalQuery, [...queryParams, pageLimit, pageOffset]);

    // Count
    const [totalResult] = await pool.query(
        `SELECT COUNT(1) AS total FROM ${tableName} ${joinClause} WHERE ` + whereClauses.join(' AND '),
        queryParams
    );
    const total = totalResult[0].total;

    // ---- Stats + Top Dishes ----
    let stats = null;
    let topDishes = null;

    if (wantStats) {
        let statsWhere = `kitchens.user_id = ?`;
        let statsParams = [userId];

        if (kitchen_id) {
            statsWhere += ` AND kitchens.id = ?`;
            statsParams.push(kitchen_id);
        }

        const [statsResult] = await pool.query(`
            SELECT 
                COUNT(r.id) AS total_reviews,
                ROUND(AVG(r.rating), 2) AS average_rating,
                SUM(CASE WHEN r.rating = 5 THEN 1 ELSE 0 END) AS star_5,
                SUM(CASE WHEN r.rating = 4 THEN 1 ELSE 0 END) AS star_4,
                SUM(CASE WHEN r.rating = 3 THEN 1 ELSE 0 END) AS star_3,
                SUM(CASE WHEN r.rating = 2 THEN 1 ELSE 0 END) AS star_2,
                SUM(CASE WHEN r.rating = 1 THEN 1 ELSE 0 END) AS star_1
            FROM reviews r
            JOIN dishes d ON r.dish_id = d.id
            JOIN kitchens ON d.kitchen_id = kitchens.id
            WHERE ${statsWhere}
        `, statsParams);

        const [overTime] = await pool.query(`
            SELECT 
                DATE(r.created_at) AS date,
                COUNT(r.id) AS count
            FROM reviews r
            JOIN dishes d ON r.dish_id = d.id
            JOIN kitchens ON d.kitchen_id = kitchens.id
            WHERE ${statsWhere}
              AND r.created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
            GROUP BY DATE(r.created_at)
            ORDER BY date ASC
        `, statsParams);

        stats = {
            total_reviews: statsResult[0].total_reviews || 0,
            average_rating: statsResult[0].average_rating || 0,
            rating_distribution: {
                5: statsResult[0].star_5 || 0,
                4: statsResult[0].star_4 || 0,
                3: statsResult[0].star_3 || 0,
                2: statsResult[0].star_2 || 0,
                1: statsResult[0].star_1 || 0
            },
            reviews_over_time: overTime
        };

        // Top Dishes (Bayesian Fair Score)
        const C = 20;
        const m = 4.2;

        const [topDishesResult] = await pool.query(`
            SELECT 
                d.id,
                d.name,
                d.image_url,
                COUNT(r.id) AS reviews_count,
                ROUND(AVG(r.rating), 2) AS avg_rating,
                ROUND(
                    (COUNT(r.id) * AVG(r.rating) + ? * ?) / (COUNT(r.id) + ?)
                , 3) AS fair_score
            FROM dishes d
            JOIN kitchens k ON d.kitchen_id = k.id
            LEFT JOIN reviews r ON r.dish_id = d.id
            WHERE k.user_id = ?
            ${kitchen_id ? 'AND k.id = ?' : ''}
            GROUP BY d.id
            HAVING reviews_count >= 1
            ORDER BY fair_score DESC
            LIMIT 10
        `, kitchen_id ? [C, m, C, userId, kitchen_id] : [C, m, C, userId]);

        topDishes = topDishesResult;
    }

    return res.status(200).json({
        status: 'success',
        data: {
            reviews,
            ...(wantStats && { stats, top_dishes: topDishes })
        },
        pagination: {
            page: parseInt(page),
            limit: pageLimit,
            total,
            total_pages: Math.ceil(total / pageLimit) || 1
        }
    });
}

// ======================
// 4. Customer's own reviews
// ======================
async function getAllReviewsOnMyreviewOnDish_controller(req, res) {
    const value = checker(searchQuerySchema, req.query, res);
    if (!value) return; // لو الـ checker بيرجع error وبيعمل response

    const { q, rating, page = 1, limit = 10, sort_order = 'DESC' } = value;
    const dishId = parseInt(req.query.id); // dish_id اختياري

    const pageNum = parseInt(page) || 1;
    const pageLimit = parseInt(limit) || 10;
    const offset = (pageNum - 1) * pageLimit;
    const safeSortOrder = (sort_order && sort_order.toUpperCase() === 'ASC') ? 'ASC' : 'DESC';

    let whereClauses = [`reviews.user_id = ?`];
    let queryParams = [req.user.id];

    if (dishId) {
        whereClauses.push(`reviews.dish_id = ?`);
        queryParams.push(dishId);
    }

    if (q) {
        whereClauses.push(`reviews.comment LIKE ?`);
        queryParams.push(`%${q}%`);
    }

    if (rating !== undefined && rating !== null && rating !== '') {
        whereClauses.push(`reviews.rating = ?`);
        queryParams.push(rating);
    }

    const whereSQL = whereClauses.join(' AND ');

    // Query البيانات
    const dataQuery = `
        SELECT 
            reviews.id,
            reviews.rating,
            reviews.comment,
            reviews.created_at,
            dishes.name AS dish_name,
            dishes.image_url AS dish_image,
            kitchens.title AS kitchen_name,
            kitchens.phone_number AS kitchen_phone
        FROM reviews 
        JOIN dishes ON dishes.id = reviews.dish_id
        JOIN kitchens ON kitchens.id = dishes.kitchen_id
        WHERE ${whereSQL}
        ORDER BY reviews.created_at ${safeSortOrder}
        LIMIT ? OFFSET ?
    `;

    const [reviews] = await pool.query(dataQuery, [...queryParams, pageLimit, offset]);

    // Count
    const [totalResult] = await pool.query(
        `SELECT COUNT(1) AS total FROM reviews WHERE ${whereSQL}`,
        queryParams
    );
    const total = totalResult[0].total;

    return res.status(200).json({
        status: 'success',
        data: reviews,
        pagination: {
            page: pageNum,
            limit: pageLimit,
            total,
            total_pages: Math.ceil(total / pageLimit) || 1
        }
    });
}

// ======================
// 5. Admin Dashboard
// ======================
async function getAllReviewsDashboard_controller(req, res) {
    const { include_stats } = req.query;
    const wantStats = include_stats === 'true' || include_stats === '1';

    let stats = null;
    let topKitchens = null;
    let topDishes = null;

    if (wantStats) {
        // Stats عامة
        const [statsResult] = await pool.query(`
            SELECT 
                COUNT(id) AS total_reviews,
                ROUND(AVG(rating), 2) AS average_rating,
                SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) AS star_5,
                SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) AS star_4,
                SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) AS star_3,
                SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) AS star_2,
                SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) AS star_1
            FROM reviews
        `);

        const [overTime] = await pool.query(`
            SELECT 
                DATE(created_at) AS date,
                COUNT(id) AS count
            FROM reviews
            WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
            GROUP BY DATE(created_at)
            ORDER BY date ASC
        `);

        stats = {
            total_reviews: statsResult[0].total_reviews || 0,
            average_rating: statsResult[0].average_rating || 0,
            rating_distribution: {
                5: statsResult[0].star_5 || 0,
                4: statsResult[0].star_4 || 0,
                3: statsResult[0].star_3 || 0,
                2: statsResult[0].star_2 || 0,
                1: statsResult[0].star_1 || 0
            },
            reviews_over_time: overTime
        };

        // Top Kitchens (Fair Score)
        const C = 20;
        const m = 4.2;

        const [kitchensResult] = await pool.query(`
            SELECT 
                k.id,
                k.title,
                COUNT(r.id) AS reviews_count,
                ROUND(AVG(r.rating), 2) AS avg_rating,
                ROUND(
                    (COUNT(r.id) * AVG(r.rating) + ? * ?) / (COUNT(r.id) + ?)
                , 3) AS fair_score
            FROM kitchens k
            JOIN dishes d ON d.kitchen_id = k.id
            LEFT JOIN reviews r ON r.dish_id = d.id
            GROUP BY k.id
            HAVING reviews_count >= 1
            ORDER BY fair_score DESC
            LIMIT 10
        `, [C, m, C]);

        topKitchens = kitchensResult;

        // Top Dishes (Fair Score)
        const [dishesResult] = await pool.query(`
            SELECT 
                d.id,
                d.name,
                d.image_url,
                k.title AS kitchen_name,
                COUNT(r.id) AS reviews_count,
                ROUND(AVG(r.rating), 2) AS avg_rating,
                ROUND(
                    (COUNT(r.id) * AVG(r.rating) + ? * ?) / (COUNT(r.id) + ?)
                , 3) AS fair_score
            FROM dishes d
            JOIN kitchens k ON d.kitchen_id = k.id
            LEFT JOIN reviews r ON r.dish_id = d.id
            GROUP BY d.id
            HAVING reviews_count >= 1
            ORDER BY fair_score DESC
            LIMIT 10
        `, [C, m, C]);

        topDishes = dishesResult;
    }

    return res.status(200).json({
        status: 'success',
        currentUser: req.user,
        data: {
            reviews: req.paginatedData || [],
            ...(wantStats && {
                stats,
                top_kitchens: topKitchens,
                top_dishes: topDishes
            })
        },
        pagination: req.pagination || { page: 1, limit: 10, total: 0, total_pages: 1 }
    });
}

// ======================
// 6. Add Review
// ======================
async function addReviewOnDish_controller(req, res) {
    const { rating, comment, dish_id } = checker(reviewSchema, req.body, res);
    if (!rating) return; // لو الـ checker فشل

    // التحقق إن الطبق موجود
    const [foundDish] = await pool.query(
        `SELECT id FROM dishes WHERE id = ? LIMIT 1`,
        [dish_id]
    );

    if (foundDish.length === 0) {
        return res.status(404).json({
            status: 'error',
            message: 'الطبق غير موجود'
        });
    }

    // التحقق إن العميل مقيّمش الطبق قبل كده
    const [existingReview] = await pool.query(
        `SELECT id FROM reviews WHERE dish_id = ? AND user_id = ? LIMIT 1`,
        [dish_id, req.user.id]
    );

    if (existingReview.length > 0) {
        return res.status(400).json({
            status: 'error',
            message: 'لقد قمت بتقييم هذا الطبق من قبل'
        });
    }

    // إضافة التقييم
    await pool.query(
        `INSERT INTO reviews (user_id, dish_id, rating, comment) VALUES (?, ?, ?, ?)`,
        [req.user.id, dish_id, rating, comment]
    );

    return res.status(201).json({
        status: 'success',
        message: 'تم إضافة التقييم بنجاح'
    });
}

// ======================
// 7. Update Review
// ======================
async function updateReviewOnDish_controller(req, res) {
    const body = checker(reviewUpdateSchema, req.body, res);
    if (!body) return;

    const { rating, comment } = body;
    const { id } = checker(idParamSchema, req.params, res);
    if (!id) return;

    // بناء شرط الملكية
    let query = `SELECT * FROM reviews WHERE id = ?`;
    let params = [id];

    if (req.user.role === 'customer' || req.user.roles === 'customer') {
        query += ` AND user_id = ?`;
        params.push(req.user.id);
    }

    const [result] = await pool.query(query, params);

    if (result.length === 0) {
        return res.status(404).json({
            status: 'error',
            message: 'التقييم غير موجود أو ليس لديك صلاحية تعديله'
        });
    }

    // بناء الـ UPDATE
    const fields = [];
    const updateParams = [];

    if (rating !== undefined && rating !== null) {
        fields.push('rating = ?');
        updateParams.push(rating);
    }

    if (comment !== undefined && comment !== null) {
        fields.push('comment = ?');
        updateParams.push(comment);
    }

    if (fields.length === 0) {
        return res.status(200).json({
            status: 'success',
            message: 'لم يتم تغيير أي بيانات'
        });
    }

    updateParams.push(id);

    await pool.query(
        `UPDATE reviews SET ${fields.join(', ')} WHERE id = ?`,
        updateParams
    );

    // مسح كاش التقييمات والمطابخ والأطباق المتأثرة
    allRows.clearCache('review');
    allRows.clearCache('kitchen'); // لأن إحصائيات المطبخ تتغير
    allRows.clearCache('dish');    // لأن تقييمات الطبق تتغير

    return res.status(200).json({
        status: 'success',
        message: 'تم تحديث التقييم بنجاح'
    });
}

// ======================
// 8. Delete Review
// ======================
async function deleteReview_controller(req, res) {
    const { id } = checker(idParamSchema, req.params, res);
    if (!id) return;

    let query = `SELECT * FROM reviews WHERE id = ?`;
    let params = [id];

    if (req.user.role === 'customer' || req.user.roles === 'customer') {
        query += ` AND user_id = ?`;
        params.push(req.user.id);
    }

    const [reviews] = await pool.query(query, params);

    if (reviews.length === 0) {
        return res.status(404).json({
            status: 'error',
            message: 'التقييم غير موجود أو ليس لديك صلاحية حذفه'
        });
    }

    await pool.query(`DELETE FROM reviews WHERE id = ?`, [id]);

    // مسح كاش التقييمات والمطابخ والأطباق المتأثرة
    allRows.clearCache('review');
    allRows.clearCache('kitchen'); // لأن إحصائيات المطبخ تتغير
    allRows.clearCache('dish');    // لأن تقييمات الطبق تتغير

    return res.status(200).json({
        status: 'success',
        message: 'تم حذف التقييم بنجاح'
    });
}

// ======================
// Export
// ======================
module.exports = {
    getReviewsList_controller,
    getChefReviews_controller,
    getAllReviewsOnMyreviewOnDish_controller,
    getAllReviewsDashboard_controller,
    addReviewOnDish_controller,
    updateReviewOnDish_controller,
    deleteReview_controller,
    getAllReviewsForDish_controller
};