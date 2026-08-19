const Joi = require("joi");
const pool = require("../database/pool");
const checker = require("../utiles/checker");
const { 
    dishSchema, 
    dishUpdateSchema, 
    idParamSchema, 
    searchQuerySchema
} = require("../utiles/validation");

async function dish_get_id(req, res, next) {
    const { id } = checker(idParamSchema, req.params, res);
    if (!id) return;

    const [dishes] = await pool.query(`
        SELECT d.*, 
               c.name as category_name,
               u.first_name, u.last_name,
               k.*
        FROM dishes d
        JOIN categories c ON d.category_id = c.id
        JOIN kitchens k ON d.kitchen_id = k.id
        JOIN users u ON k.user_id = u.id
        WHERE d.id = ?
    `, [id]);

    if (dishes.length === 0) {
        return res.status(404).json({
            status: 'error',
            message: 'الطبق غير موجود'
        });
    }

    req.my = dishes[0];
    next();
}

// ============================================
// 1. إنشاء طبق جديد - POST /dishes
// ============================================
async function createDish_controller(req, res) {
    // 1. التحقق من البيانات
    const validatedData = checker(dishSchema, req.body, res);
    if (!validatedData) return;

    const { name, description, price, image_url, category_id, kitchen_id, ingredients } = validatedData;
    const userId = req.user.id;
    
    // 2. التحقق من أن المطبخ يخص الشيف
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

    // 3. التحقق من عدم وجود طبق بنفس الاسم في نفس المطبخ
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

    // 4. إضافة الطبق
    const [result] = await pool.query(
        `INSERT INTO dishes 
        (name, description, price, image_url, category_id, kitchen_id, ingredients) 
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [name, description || null, price, image_url || null, category_id, kitchen_id, ingredients || null]
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
// 2. جلب جميع الأطباق (مع فلترة) - GET /dishes
// ============================================
async function getAllDishes_controller(req, res) {
    return res.status(200).json({
        status: 'success',
        data: req.paginatedData || [],
        pagination: req.pagination || { page: 1, limit: 10, total: 0, total_pages: 1 }
    });
}

// ============================================
// جلب جميع الأطباق (مع فلترة) للأدمن - GET /dishes/admin
// ============================================
async function getAllDishesAdmin_controller(req, res) {
        // 1. تعيين القيم الافتراضية
        req.query.min_price = req.query.min_price || 0;
        req.query.max_price = req.query.max_price || 10000;
        
        // 2. التحقق من البيانات باستخدام searchQuerySchema
        const { error, value } = searchQuerySchema.validate(req.query);
        if (error) {
            return res.status(400).json({
                status: 'error',
                message: error.details[0].message
            });
        }

        const { q, category, min_price, max_price, page, limit, sort_by, sort_order,kitchen } = value;
        const offset = (page - 1) * limit;
        const searchKeyword = q ? `%${q}%` : null;

        // 3. بناء استعلام SQL مع JOINs
        let baseQuery = `
            SELECT 
                dishes.*,
                categories.name AS category_name,
                kitchens.title AS kitchen_title
            FROM dishes
            JOIN categories ON dishes.category_id = categories.id
            JOIN kitchens ON dishes.kitchen_id = kitchens.id
        `;
        const kitchenSchemaAdmin=Joi.string()
                .optional()
                .max(100)
                .trim()
                .allow('', null)
                .messages({
                    'string.base': 'اسم المطبخ يجب أن يكون نصاً.',
                    'string.max': 'اسم المطبخ يجب ألا يتجاوز 100 حرف.'
                });

        checker(kitchenSchemaAdmin,kitchen,res);

        let whereClauses = [];
        let queryParams = [];

        // 4. إضافة شروط البحث
        if (q) {
            whereClauses.push(`(dishes.name LIKE ? OR dishes.description LIKE ?)`);
            queryParams.push(searchKeyword, searchKeyword);
        }
        // 5. إضافة شرط التصنيف
        if (category) {
            whereClauses.push(`categories.name = ?`);
            queryParams.push(category);
        }

        if (kitchen) {
            whereClauses.push(`kitchens.title = ?`);
            queryParams.push(kitchen);
        }

        // 6. إضافة شرط السعر
        if (min_price !== undefined || max_price !== undefined) {
            whereClauses.push(`dishes.price BETWEEN ? AND ?`);
            queryParams.push(min_price || 0, max_price || 10000);
        }

        // 7. بناء الاستعلام النهائي
        let finalQuery = baseQuery;
        if (whereClauses.length > 0) {
            finalQuery += ` WHERE ` + whereClauses.join(' AND ');
        }

        // 8. إضافة الترتيب
        let orderColumn = 'dishes.id';
        if (sort_by === 'price') orderColumn = 'dishes.price';
        else if (sort_by === 'name') orderColumn = 'dishes.name';
        else if (sort_by === 'created_at') orderColumn = 'dishes.created_at';

        finalQuery += ` ORDER BY ${orderColumn} ${sort_order} LIMIT ? OFFSET ?`;
        queryParams.push(parseInt(limit), offset);

        // 9. تنفيذ الاستعلام
        const [data] = await pool.query(finalQuery, queryParams);

        // 10. جلب العدد الإجمالي (لـ Pagination)
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

        // 11. إرجاع النتيجة
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
// 3. جلب طبق معين - GET /dishes/:id
// ============================================
async function getDish_controller(req, res) {
    const { ingredients } = req.my;
    req.my.ingredients= ingredients ? ingredients.split(',') : null;

    return res.status(200).json({
        status: 'success',
        data: req.my,
    });
}

// ============================================
// 4. جلب أطباق الشيف الحالي - GET /dishes/my
// ============================================
async function getMyDishes_controller(req, res) {
    console.log(req.my);
    return res.status(200).json({
        status: 'success',
        pagination: req.pagination || { page: 1, limit: 10, total: 0, total_pages: 1 },
        query: req.query || {},   // لإعادة تعبئة حقول الفلترة
        data: req.my || [],
    });
}

// ============================================
// 7. جلب أطباق مطبخ معين - GET /dishes/my/:id
// ============================================
async function getMySpcificDish_controller(req, res) {
    return res.status(200).json({status:'success',data:req.my})
}

// ============================================
// 7. جلب أطباق مطبخ معين - GET /dishes/my/:id
// ============================================
// async function getMySpcificDish_controller(req, res) {
//     return res.status(200).json({status:'success',data:req.my})
// }

// ============================================
// 7. جلب أطباق مطبخ معين - GET /kitchen/:id/my
// ============================================
async function getAllDieshesForSpecificKitchenForChef_controller(req, res) {
    return res.status(200).json({status:'success',data:req.paginatedData})
}

// ============================================
// 6. تحديث طبق - PUT /dishes/:id
// ============================================
async function updateDish_controller(req, res) {
    // 1. التحقق من الـ ID
    const { id } = checker(idParamSchema, req.params, res);
    if (!id) return;

    // 2. التحقق من وجود الطبق
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

    // 3. التحقق من البيانات
    const validatedData = checker(dishUpdateSchema, req.body, res);
    if (!validatedData) return;

    const { name, description, price, image_url, category_id, ingredients,kitchen_id } = validatedData;

    // 4. التحقق من عدم وجود طبق بنفس الاسم في نفس المطبخ (إن وجد name)
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

    // 5. بناء استعلام التحديث
    const updates = [];
    const params = [];

    if (name !== undefined) {
        updates.push('name = ?');
        params.push(name);
    }
    if (description !== undefined) {
        updates.push('description = ?');
        params.push(description);
    }
    if (price !== undefined) {
        updates.push('price = ?');
        params.push(price);
    }
    if (image_url !== undefined) {
        updates.push('image_url = ?');
        params.push(image_url);
    }
    if (category_id !== undefined) {
        // التحقق من وجود التصنيف
        const [category] = await pool.query(
            'SELECT id FROM categories WHERE id = ?',
            [category_id]
        );
        if (category.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'التصنيف غير موجود'
            });
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
    
        // 3. التحقق من عدم وجود طبق بنفس الاسم في نفس المطبخ
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
        updates.push('kitchen_id = ?');
        params.push(kitchen_id);
    }
    if (ingredients !== undefined) {
        updates.push('ingredients = ?');
        params.push(ingredients);
    }

    if (updates.length === 0) {
        return res.status(400).json({
            status: 'error',
            message: 'لا توجد بيانات للتحديث'
        });
    }

    params.push(id);

    // 6. تنفيذ التحديث
    await pool.query(
        `UPDATE dishes SET ${updates.join(', ')} WHERE id = ?`,
        params
    );

    return res.status(200).json({
        status: 'success',
        message: 'تم تحديث الطبق بنجاح'
    });
}

// ============================================
// 7. رفع صورة طبق - POST /dishes/:id/upload_image
// ============================================
async function uploadDishImage_controller(req, res) {
    // 1. التحقق من الـ ID
    const { id } = checker(idParamSchema, req.params, res);
    if (!id) return;

    // 2. التحقق من وجود الطبق
    const [existing] = await pool.query(
        'SELECT id FROM dishes WHERE id = ?',
        [id]
    );

    if (existing.length === 0) {
        return res.status(404).json({
            status: 'error',
            message: 'الطبق غير موجود'
        });
    }

    // 3. التحقق من وجود صورة
    if (!req.file) {
        return res.status(400).json({
            status: 'error',
            message: 'من فضلك ارفع صورة'
        });
    }

    // 4. حفظ مسار الصورة
    const imageUrl = `/uploads/${req.file.filename}`;

    // 5. تحديث الطبق بالصورة
    await pool.query(
        'UPDATE dishes SET image_url = ? WHERE id = ?',
        [imageUrl, id]
    );

    return res.status(200).json({
        status: 'success',
        message: 'تم رفع الصورة بنجاح',
        data: {
            image_url: imageUrl
        }
    });
}

// ============================================
// 8. حذف طبق (للأدمن) - DELETE /dishes/:id
// ============================================
async function deleteDish_controller(req, res) {
    // 1. التحقق من الـ ID
    const { id } = checker(idParamSchema, req.params, res);
    if (!id) return;

    // 2. التحقق من وجود الطبق
    const [existing] = await pool.query(
        'SELECT id FROM dishes WHERE id = ?',
        [id]
    );

    if (existing.length === 0) {
        return res.status(404).json({
            status: 'error',
            message: 'الطبق غير موجود'
        });
    }

    // 3. حذف الطبق
    await pool.query(
        'DELETE FROM dishes WHERE id = ?',
        [id]
    );

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
    getMySpcificDish_controller,
    getAllDishesAdmin_controller,
    getAllDieshesForSpecificKitchenForChef_controller,
    updateDish_controller,
    uploadDishImage_controller,
    deleteDish_controller,
};