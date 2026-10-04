
const pool = require("../database/pool");
const checker = require("../utiles/checker");
const { categorySchema, idParamSchema } = require("../utiles/validation");

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


async function getAllCategories_controller(req, res) {
    return res.status(200).json({
        status: 'success',
        data: req.paginatedData
    });
}



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


module.exports={
    createCategory_controller,
    getAllCategories_controller,
    getCategory_controller,
    updateCategory_controller,
    deleteCategory_controller,
    getCategoriesWithCount_controller,
    getCategoriesWithCount
}