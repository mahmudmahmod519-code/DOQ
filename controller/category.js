/**
 * Category controller: CRUD for categories and listing with dish counts.
 */
const pool = require("../database/pool");
const checker = require("../utiles/checker");
const { categorySchema, idParamSchema } = require("../utiles/validation");

/**
 * Creates a new category (admin).
 * @param {Object} req - Body validated by categorySchema (name, description).
 * @param {Object} res - Express response.
 * @returns {Promise<void>} 201 with new category data, 409 if name exists.
 */
async function createCategory_controller(req, res) {
    const validatedData = checker(categorySchema, req.body, res);
    if (!validatedData) return;

    const { name, description } = validatedData;

    const [existing] = await pool.query(
        'SELECT id FROM categories WHERE name = ?',
        [name]
    );

    if (existing.length > 0) {
        return res.status(409).json({
            status: 'error',
            message: 'هذا التصنيف موجود بالفعل'
        });
    }

    const [result] = await pool.query(
        'INSERT INTO categories (name, description) VALUES (?, ?)',
        [name, description || null]
    );

    return res.status(201).json({
        status: 'success',
        message: 'تم إضافة التصنيف بنجاح',
        data: {
            id: result.insertId,
            name,
            description: description || null
        }
    });
}

/**
 * Returns pre-paginated categories from allRows middleware.
 * @param {Object} req - Uses req.paginatedData.
 * @param {Object} res - Express response.
 * @returns {Promise<void>} 200 with categories array.
 */
async function getAllCategories_controller(req, res) {
    return res.status(200).json({
        status: 'success',
        data: req.paginatedData
    });
}

/**
 * Fetches a single category by ID.
 * @param {Object} req - params.id validated by idParamSchema.
 * @param {Object} res - Express response.
 * @returns {Promise<void>} 200 with category data, 404 if not found.
 */
async function getCategory_controller(req, res) {
    const { id } = checker(idParamSchema, req.params, res);
    if (!id) return;

    const [categories] = await pool.query(
        'SELECT id, name, description, created_at FROM categories WHERE id = ?',
        [id]
    );

    if (categories.length === 0) {
        return res.status(404).json({
            status: 'error',
            message: 'التصنيف غير موجود'
        });
    }

    return res.status(200).json({
        status: 'success',
        data: categories[0]
    });
}

/**
 * Updates a category by ID (admin).
 * @param {Object} req - params.id, body validated by categorySchema.
 * @param {Object} res - Express response.
 * @returns {Promise<void>} 200 on success, 404/409 on not found/duplicate.
 */
async function updateCategory_controller(req, res) {
    const { id } = checker(idParamSchema, req.params, res);
    if (!id) return;

    const [existing] = await pool.query(
        'SELECT id FROM categories WHERE id = ?',
        [id]
    );

    if (existing.length === 0) {
        return res.status(404).json({
            status: 'error',
            message: 'التصنيف غير موجود'
        });
    }

    const validatedData = checker(categorySchema, req.body, res);
    if (!validatedData) return;

    const { name, description } = validatedData;

    const [duplicate] = await pool.query(
        'SELECT id FROM categories WHERE name = ? AND id != ?',
        [name, id]
    );

    if (duplicate.length > 0) {
        return res.status(409).json({
            status: 'error',
            message: 'يوجد تصنيف آخر بنفس الاسم'
        });
    }

    await pool.query(
        'UPDATE categories SET name = ?, description = ? WHERE id = ?',
        [name, description || null, id]
    );

    return res.status(200).json({
        status: 'success',
        message: 'تم تحديث التصنيف بنجاح'
    });
}

/**
 * Deletes a category by ID (admin).
 * Blocks deletion if dishes reference the category.
 * @param {Object} req - params.id validated by idParamSchema.
 * @param {Object} res - Express response.
 * @returns {Promise<void>} 200 on success, 404/409 on not found/has dishes.
 */
async function deleteCategory_controller(req, res) {
    const { id } = checker(idParamSchema, req.params, res);
    if (!id) return;

    const [existing] = await pool.query(
        'SELECT id FROM categories WHERE id = ?',
        [id]
    );

    if (existing.length === 0) {
        return res.status(404).json({
            status: 'error',
            message: 'التصنيف غير موجود'
        });
    }

    const [dishes] = await pool.query(
        'SELECT id FROM dishes WHERE category_id = ? LIMIT 1',
        [id]
    );

    if (dishes.length > 0) {
        return res.status(409).json({
            status: 'error',
            message: 'لا يمكن حذف هذا التصنيف لأنه يحتوي على أطباق مرتبطة به'
        });
    }

    await pool.query(
        'DELETE FROM categories WHERE id = ?',
        [id]
    );

    return res.status(200).json({
        status: 'success',
        message: 'تم حذف التصنيف بنجاح'
    });
}

/**
 * Lists all categories with dish counts (paginated by allRows middleware).
 * @param {Object} req - Uses req.paginatedData.
 * @param {Object} res - Express response.
 * @returns {Promise<void>} 200 with categories array.
 */
async function getCategoriesWithCount_controller(req, res) {
    const [categories] = await pool.query(`
        SELECT 
            c.id,
            c.name,
            c.description,
            c.created_at,
            COUNT(d.id) AS dishes_count
        FROM categories c
        LEFT JOIN dishes d ON c.id = d.category_id
        GROUP BY c.id
        ORDER BY c.name ASC
    `);

    return res.status(200).json({
        status: 'success',
        data: categories
    });
}

/**
 * Internal helper: returns all categories with dish counts (non-paginated).
 * Used for server-side rendering helpers.
 * @returns {Promise<Array>} Array of category objects.
 */
async function getCategoriesWithCount() {
    const [categories] = await pool.query(`
        SELECT 
            c.id,
            c.name,
            c.description,
            c.created_at,
            COUNT(d.id) AS dishes_count
        FROM categories c
        LEFT JOIN dishes d ON c.id = d.category_id
        GROUP BY c.id
        ORDER BY c.name ASC
    `);
    return categories;
}

module.exports = {
    createCategory_controller,
    getAllCategories_controller,
    getCategory_controller,
    updateCategory_controller,
    deleteCategory_controller,
    getCategoriesWithCount_controller,
    getCategoriesWithCount
};