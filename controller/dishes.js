/**
 * dishes.js — Dishes controller.
 * Manages create/read/update/delete of dishes, image uploads, and paginated listings
 * with filtering. Middleware attaches pre-fetched data to req.my or req.paginatedData.
 */
const Joi = require("joi");
const pool = require("../database/pool");
const checker = require("../utiles/checker");
const {
    dishSchema,
    dishUpdateSchema,
    idParamSchema,
    searchQuerySchema
} = require("../utiles/validation");

// ============================================
// Middleware: load single dish by ID into req.my
// ============================================

/**
 * Loads a dish by ID with joins to category, kitchen, and user.
 * Attaches to req.my; hides contact fields for non-admin/chef roles.
 * Renders 404 page if not found.
 * @param {Object} req - Expects req.params.id; req.user.roles optional.
 * @param {Object} res - Used for 404 response.
 * @param {Function} next - Called on success.
 * @returns {Promise<void>}
 */
async function dish_get_id(req, res, next) {
    const { id } = checker(idParamSchema, req.params, res);
    if (!id) return;

    const [dishes] = await pool.query(`
        SELECT 
            d.*,
            d.description as dish_description,
            c.name as category_name,
            u.first_name, u.last_name,
            k.phone_number,
            k.user_id,
            k.portfolio_url,
            k.image_url,
            k.address,
            k.city,
            k.description,
            k.title,
            d.image_url as dish_image
        FROM dishes d
        JOIN categories c ON d.category_id = c.id
        JOIN kitchens k ON d.kitchen_id = k.id
        JOIN users u ON k.user_id = u.id
        WHERE d.id = ?
    `, [id]);

    if (dishes.length === 0) {
        return res.status(404).render('./errors/page_404', {
            status: 'error',
            message: 'الطبق غير موجود',
        });
    }

    req.my = dishes[0];
    // Hide contact info from non-admin/chef
    if (!['admin','chef'].includes(req.user?.roles)) {
        delete req.my.phone_number;
        delete req.my.whatsapp_number;
        delete req.my.user_phone;
        delete req.my.email;
    }
    next();
}

// ============================================
// 1. Create dish — POST /dishes
// ============================================

/**
 * Creates a new dish for a kitchen owned by the current user.
 * @param {Object} req - req.body validated by dishSchema; req.user.id required.
 * @param {Object} res - Response.
 * @returns {Promise<void>} 201 with new dish data, or 400/403/409 on validation/ownership/duplicate.
 */
async function createDish_controller(req, res) {
    const validatedData = checker(dishSchema, req.body, res);
    if (!validatedData) return;

    const { name, description, price, image_url, category_id, kitchen_id, ingredients } = validatedData;
    const userId = req.user.id;

    // Verify kitchen ownership
    const [kitchens] = await pool.query(
        'SELECT id FROM kitchens WHERE id = ? AND user_id = ?',
        [kitchen_id, userId]
    );

    if (kitchens.length === 0) {
        return res.status(403).json({
            status: 'error',
            message: 'هذا المطبخ ليس ملكك أو غير موجود'
        });
    }

    // Check duplicate name in same kitchen
    const [existing] = await pool.query(
        'SELECT id FROM dishes WHERE name = ? AND kitchen_id = ?',
        [name, kitchen_id]
    );

    if (existing.length > 0) {
        return res.status(409).json({
            status: 'error',
            message: 'يوجد طبق بنفس الاسم في هذا المطبخ'
        });
    }

    const [result] = await pool.query(
        `INSERT INTO dishes 
        (name, description, price, image_url, category_id, kitchen_id, ingredients) 
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [name, description || null, price, image_url, category_id, kitchen_id, ingredients || null]
    );

    return res.status(201).json({
        status: 'success',
        message: 'تم إضافة الطبق بنجاح',
        data: {
            id: result.insertId,
            name,
            description,
            price,
            image_url,
            category_id,
            kitchen_id,
            ingredients: ingredients ? ingredients.split(',') : null
        }
    });
}

// ============================================
// 2. List all dishes (public) — GET /dishes
// ============================================

/**
 * Returns pre-paginated dishes from middleware (allRows).
 * @param {Object} req - Uses req.paginatedData and req.pagination.
 * @param {Object} res - Response.
 * @returns {Promise<void>} 200 with data and pagination.
 */
async function getAllDishes_controller(req, res) {
    return res.status(200).json({
        status: 'success',
        data: req.paginatedData || [],
        pagination: req.pagination || { page: 1, limit: 10, total: 0, total_pages: 1 }
    });
}

// ============================================
// 2b. List all dishes (admin) — GET /dishes/admin
// ============================================

/**
 * Admin listing of dishes with search, category/kitchen filters, price range, and pagination.
 * Validates query with searchQuerySchema.
 * @param {Object} req - Query: q, category, kitchen, min_price, max_price, page, limit, sort_by, sort_order.
 * @param {Object} res - Response.
 * @returns {Promise<void>} 200 with data and pagination, or 400 on invalid query.
 */
async function getAllDishesAdmin_controller(req, res) {
    req.query.min_price = req.query.min_price || 0;
    req.query.max_price = req.query.max_price || 10000;

    const { error, value } = searchQuerySchema.validate(req.query);
    if (error) {
        return res.status(400).json({
            status: 'error',
            message: error.details[0].message
        });
    }

    const { q, category, min_price, max_price, page, limit, sort_by, sort_order, kitchen } = value;
    const offset = (page - 1) * limit;
    const searchKeyword = q ? `%${q}%` : null;

    // Validate optional kitchen filter
    const kitchenSchemaAdmin = Joi.string()
        .optional()
        .max(100)
        .trim()
        .allow('', null)
        .messages({
            'string.base': 'اسم المطبخ يجب أن يكون نصاً.',
            'string.max': 'اسم المطبخ يجب ألا يتجاوز 100 حرف.'
        });
    checker(kitchenSchemaAdmin, kitchen, res);

    let baseQuery = `
        SELECT 
            dishes.*,
            categories.name AS category_name,
            kitchens.title AS kitchen_title
        FROM dishes
        JOIN categories ON dishes.category_id = categories.id
        JOIN kitchens ON dishes.kitchen_id = kitchens.id
    `;

    let whereClauses = [];
    let queryParams = [];

    if (q) {
        whereClauses.push(`(dishes.name LIKE ? OR dishes.description LIKE ?)`);
        queryParams.push(searchKeyword, searchKeyword);
    }
    if (category) {
        whereClauses.push(`categories.name = ?`);
        queryParams.push(category);
    }
    if (kitchen) {
        whereClauses.push(`kitchens.title = ?`);
        queryParams.push(kitchen);
    }
    if (min_price !== undefined || max_price !== undefined) {
        whereClauses.push(`dishes.price BETWEEN ? AND ?`);
        queryParams.push(min_price || 0, max_price || 10000);
    }

    let finalQuery = baseQuery;
    if (whereClauses.length > 0) {
        finalQuery += ` WHERE ` + whereClauses.join(' AND ');
    }

    let orderColumn = 'dishes.id';
    if (sort_by === 'price') orderColumn = 'dishes.price';
    else if (sort_by === 'name') orderColumn = 'dishes.name';
    else if (sort_by === 'created_at') orderColumn = 'dishes.created_at';

    finalQuery += ` ORDER BY ${orderColumn} ${sort_order} LIMIT ? OFFSET ?`;
    queryParams.push(parseInt(limit), offset);

    const [data] = await pool.query(finalQuery, queryParams);

    // Count query
    let countQuery = `
        SELECT COUNT(1) AS total 
        FROM dishes
        JOIN categories ON dishes.category_id = categories.id
        JOIN kitchens ON dishes.kitchen_id = kitchens.id
    `;
    let countParams = [];
    let countWhereClauses = [];

    if (q) {
        countWhereClauses.push(`(dishes.name LIKE ? OR dishes.description LIKE ?)`);
        countParams.push(searchKeyword, searchKeyword);
    }
    if (category) {
        countWhereClauses.push(`categories.name = ?`);
        countParams.push(category);
    }
    if (min_price !== undefined || max_price !== undefined) {
        countWhereClauses.push(`dishes.price BETWEEN ? AND ?`);
        countParams.push(min_price || 0, max_price || 10000);
    }

    if (countWhereClauses.length > 0) {
        countQuery += ` WHERE ` + countWhereClauses.join(' AND ');
    }

    const [totalResult] = await pool.query(countQuery, countParams);
    const total = totalResult[0]?.total || 0;

    return res.status(200).json({
        status: 'success',
        data: data || [],
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: total,
            total_pages: Math.ceil(total / limit) || 1
        }
    });
}

// ============================================
// 3. Get single dish — GET /dishes/:id
// ============================================

/**
 * Returns dish from req.my (loaded by dish_get_id), splitting ingredients string to array.
 * @param {Object} req - Uses req.my.
 * @param {Object} res - Response.
 * @returns {Promise<void>} 200 with dish data.
 */
async function getDish_controller(req, res) {
    const { ingredients } = req.my;
    req.my.ingredients = ingredients ? ingredients.split(',') : null;

    return res.status(200).json({
        status: 'success',
        data: req.my,
    });
}

// ============================================
// 4. Chef's dishes (paginated by middleware) — GET /dishes/my
// ============================================

/**
 * Returns chef's dishes from pre-paginated middleware data.
 * @param {Object} req - Uses req.my, req.pagination, req.query.
 * @param {Object} res - Response.
 * @returns {Promise<void>} 200 with data, pagination, and query echo.
 */
async function getMyDishes_controller(req, res) {
    return res.status(200).json({
        status: 'success',
        pagination: req.pagination || { page: 1, limit: 10, total: 0, total_pages: 1 },
        query: req.query || {},
        data: req.my || [],
    });
}

/**
 * Paginated dishes for one of the chef's kitchens with search.
 * Selects kitchen from req.my (chef's kitchens) via query.kitchen_id or first.
 * @param {Object} req - Query: page, limit, q, kitchen_id; req.my = chef's kitchens array.
 * @param {Object} res - Response.
 * @returns {Promise<void>} 200 with dishes, avg_rating, reviews_count, pagination.
 */
async function getMyDishesPaginated_controller(req, res) {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const offset = (page - 1) * limit;
    const q = req.query.q || '';
    const queryKitchenId = req.query.kitchen_id || '';

    let selectedKitchen = null;
    if (req.my && Array.isArray(req.my) && req.my.length > 0) {
        if (queryKitchenId) {
            selectedKitchen = req.my.find(k => String(k.id) === String(queryKitchenId));
        }
        selectedKitchen = selectedKitchen || req.my[0];
    }

    if (!selectedKitchen) {
        return res.status(200).json({
            status: 'success',
            data: [],
            pagination: { page: 1, limit: 10, total: 0, total_pages: 1 },
            query: req.query || {},
        });
    }

    const targetKitchenId = selectedKitchen.id;

    let baseQuery = `
        SELECT 
            d.*,
            c.name AS category_name,
            ROUND(AVG(r.rating), 1) AS avg_rating,
            COUNT(r.id) AS reviews_count
        FROM dishes d
        LEFT JOIN categories c ON d.category_id = c.id
        LEFT JOIN reviews r ON r.dish_id = d.id
        WHERE d.kitchen_id = ?
    `;

    let queryParams = [targetKitchenId];

    if (q) {
        const searchKeyword = `%${q}%`;
        baseQuery += ` AND (d.name LIKE ? OR d.description LIKE ? OR d.ingredients LIKE ?)`;
        queryParams.push(searchKeyword, searchKeyword, searchKeyword);
    }

    const dataQuery = `
        ${baseQuery}
        GROUP BY d.id
        ORDER BY d.created_at DESC
        LIMIT ? OFFSET ?
    `;

    const dataParams = [...queryParams, limit, offset];
    const [data] = await pool.query(dataQuery, dataParams);

    let countQuery = `
        SELECT COUNT(DISTINCT d.id) AS total
        FROM dishes d
        WHERE d.kitchen_id = ?
    `;
    let countParams = [targetKitchenId];

    if (q) {
        const searchKeyword = `%${q}%`;
        countQuery += ` AND (d.name LIKE ? OR d.description LIKE ? OR d.ingredients LIKE ?)`;
        countParams.push(searchKeyword, searchKeyword, searchKeyword);
    }

    const [totalResult] = await pool.query(countQuery, countParams);
    const total = totalResult[0]?.total || 0;

    return res.status(200).json({
        status: 'success',
        data: data,
        pagination: {
            page: page,
            limit: limit,
            total: total,
            total_pages: Math.ceil(total / limit)
        },
        query: req.query
    });
}

// ============================================
// 5. Chef's specific kitchen dishes — GET /kitchen/:id/my
// ============================================

/**
 * Returns pre-paginated dishes for a specific kitchen (from allRows middleware).
 * @param {Object} req - Uses req.paginatedData.
 * @param {Object} res - Response.
 * @returns {Promise<void>} 200 with data.
 */
async function getAllDieshesForSpecificKitchenForChef_controller(req, res) {
    return res.status(200).json({status: 'success', data: req.paginatedData});
}

// ============================================
// 5b. Chef's specific dish — GET /dishes/my/:id
// ============================================

/**
 * Returns a specific dish owned by the chef (from isOwner + for_main middleware).
 * @param {Object} req - Uses req.my populated by middleware.
 * @param {Object} res - Response.
 * @returns {Promise<void>} 200 with dish data.
 */
async function getMySpcificDish_controller(req, res) {
    return res.status(200).json({status: 'success', data: req.my});
}

// ============================================
// 6. Update dish — PUT /dishes/:id
// ============================================

/**
 * Updates a dish; validates ownership via kitchen_id and input via dishUpdateSchema.
 * Allows changing kitchen_id only to another kitchen owned by the user.
 * @param {Object} req - params.id; body validated by dishUpdateSchema; req.user.id for ownership.
 * @param {Object} res - Response.
 * @returns {Promise<void>} 200 on success, or 400/403/404/409 on error.
 */
async function updateDish_controller(req, res) {
    const { id } = checker(idParamSchema, req.params, res);
    if (!id) return;

    const [existing] = await pool.query(
        'SELECT kitchen_id FROM dishes WHERE id = ?',
        [id]
    );

    if (existing.length === 0) {
        return res.status(404).json({
            status: 'error',
            message: 'الطبق غير موجود'
        });
    }

    const validatedData = checker(dishUpdateSchema, req.body, res);
    if (!validatedData) return;

    const { name, description, price, image_url, category_id, ingredients, kitchen_id } = validatedData;

    if (name) {
        const [duplicate] = await pool.query(
            'SELECT id FROM dishes WHERE name = ? AND kitchen_id = ? AND id != ?',
            [name, existing[0].kitchen_id, id]
        );
        if (duplicate.length > 0) {
            return res.status(409).json({
                status: 'error',
                message: 'يوجد طبق بنفس الاسم في هذا المطبخ'
            });
        }
    }

    const updates = [];
    const params = [];

    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (description !== undefined) { updates.push('description = ?'); params.push(description); }
    if (price !== undefined) { updates.push('price = ?'); params.push(price); }
    if (image_url !== undefined) { updates.push('image_url = ?'); params.push(image_url); }
    if (category_id !== undefined) {
        const [category] = await pool.query('SELECT id FROM categories WHERE id = ?', [category_id]);
        if (category.length === 0) {
            return res.status(404).json({ status: 'error', message: 'التصنيف غير موجود' });
        }
        updates.push('category_id = ?');
        params.push(category_id);
    }
    if (kitchen_id !== undefined) {
        const [kitchens] = await pool.query(
            'SELECT id FROM kitchens WHERE id = ? AND user_id = ?',
            [kitchen_id, req.user.id]
        );
        if (kitchens.length === 0) {
            return res.status(403).json({
                status: 'error',
                message: 'هذا المطبخ ليس ملكك أو غير موجود'
            });
        }
        const [existing] = await pool.query(
            'SELECT id FROM dishes WHERE name = ? AND kitchen_id = ? AND id <> ?',
            [name, kitchen_id, id]
        );
        if (existing.length > 0) {
            return res.status(409).json({
                status: 'error',
                message: 'يوجد طبق بنفس الاسم في هذا المطبخ'
            });
        }
        updates.push('kitchen_id = ?');
        params.push(kitchen_id);
    }
    if (ingredients !== undefined) { updates.push('ingredients = ?'); params.push(ingredients); }

    if (updates.length === 0) {
        return res.status(400).json({ status: 'error', message: 'لا توجد بيانات للتحديث' });
    }

    params.push(id);
    await pool.query(`UPDATE dishes SET ${updates.join(', ')} WHERE id = ?`, params);

    return res.status(200).json({
        status: 'success',
        message: 'تم تحديث الطبق بنجاح'
    });
}

// ============================================
// 7. Upload dish image — POST /dishes/:id/upload_image
// ============================================

/**
 * Uploads an image for a dish and updates image_url.
 * @param {Object} req - params.id; req.file from multer middleware.
 * @param {Object} res - Response.
 * @returns {Promise<void>} 200 with image_url, or 400/404 on error.
 */
async function uploadDishImage_controller(req, res) {
    const { id } = checker(idParamSchema, req.params, res);
    if (!id) return;

    const [existing] = await pool.query('SELECT id FROM dishes WHERE id = ?', [id]);
    if (existing.length === 0) {
        return res.status(404).json({ status: 'error', message: 'الطبق غير موجود' });
    }

    if (!req.file) {
        return res.status(400).json({ status: 'error', message: 'من فضلك ارفع صورة' });
    }

    const imageUrl = `/uploads/${req.file.filename}`;
    await pool.query('UPDATE dishes SET image_url = ? WHERE id = ?', [imageUrl, id]);

    return res.status(200).json({
        status: 'success',
        message: 'تم رفع الصورة بنجاح',
        data: { image_url: imageUrl }
    });
}

// ============================================
// 8. Delete dish (admin) — DELETE /dishes/:id
// ============================================

/**
 * Deletes a dish by ID (admin only).
 * @param {Object} req - params.id.
 * @param {Object} res - Response.
 * @returns {Promise<void>} 200 on success, 404 if not found.
 */
async function deleteDish_controller(req, res) {
    const { id } = checker(idParamSchema, req.params, res);
    if (!id) return;

    const [existing] = await pool.query('SELECT id FROM dishes WHERE id = ?', [id]);
    if (existing.length === 0) {
        return res.status(404).json({ status: 'error', message: 'الطبق غير موجود' });
    }

    await pool.query('DELETE FROM dishes WHERE id = ?', [id]);

    return res.status(200).json({
        status: 'success',
        message: 'تم حذف الطبق بنجاح'
    });
}

module.exports = {
    dish_get_id,
    createDish_controller,
    getAllDishes_controller,
    getDish_controller,
    getMyDishes_controller,
    getMyDishesPaginated_controller,
    getMySpcificDish_controller,
    getAllDishesAdmin_controller,
    getAllDieshesForSpecificKitchenForChef_controller,
    updateDish_controller,
    uploadDishImage_controller,
    deleteDish_controller,
};