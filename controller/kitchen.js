const pool = require("../database/pool");
const checker = require("../utiles/checker");
const { kitchenSchema, kitchenUpdateSchema, idParamSchema } = require("../utiles/validation");

async function getKitchenById_middleware(req, res, next) {
    const { id } = checker(idParamSchema, req.params, res);

    // ==========================================
    // 1. بيانات المطبخ الأساسية
    // ==========================================
    let statements = ` 
        SELECT 
            k.*,
            CONCAT(u.first_name,' ',u.last_name) as chefName
        FROM kitchens k 
        JOIN users u ON u.id=k.user_id
        WHERE k.id=?`;

    const [result] = await pool.query(statements, [id]);

    if (result.length === 0) return res.redirect('/');

    // ==========================================
    // 2. استعلام منفصل لعدد الأطباق (عشان ميتضربش بالتقييمات)
    // ==========================================
    statements = `SELECT COUNT(DISTINCT id) AS dishes_count FROM dishes WHERE kitchen_id = ?`;
    const [dishCount] = await pool.query(statements, [id]);
    const dishesCount = dishCount[0]?.dishes_count || 0;

    // ==========================================
    // 3. بيانات التقييمات (هنا بنحسب كل حاجة)
    // ==========================================
    statements = `
        SELECT
            COUNT(r.id) AS reviews_count,
            ROUND(AVG(r.rating), 2) AS avg_rating,
            SUM(CASE WHEN r.rating = 5 THEN 1 ELSE 0 END) AS star_5,
            SUM(CASE WHEN r.rating = 4 THEN 1 ELSE 0 END) AS star_4,
            SUM(CASE WHEN r.rating = 3 THEN 1 ELSE 0 END) AS star_3,
            SUM(CASE WHEN r.rating = 2 THEN 1 ELSE 0 END) AS star_2,
            SUM(CASE WHEN r.rating = 1 THEN 1 ELSE 0 END) AS star_1
        FROM dishes d 
        LEFT JOIN reviews r ON r.dish_id = d.id
        WHERE d.kitchen_id = ?
    `;

    const [count] = await pool.query(statements, [id]);

    // ==========================================
    // 4. حساب الـ Fair Score (بنفس معادلة الـ reviews.js)
    // ==========================================
    const C = 20; // ثابت الـ Bayesian
    const m = 4.2; // المتوسط العام
    const totalReviews = count[0]?.reviews_count || 0;
    const rawAvg = count[0]?.avg_rating || 0;

    // الـ Fair Score: (n * avg + C * m) / (n + C)
    const fairScore = totalReviews > 0 
        ? Number(((totalReviews * rawAvg) + (C * m)) / (totalReviews + C)).toFixed(2)
        : null;

    // المتوسط الحسابي الخام (اللي هيظهر للمستخدم في الـ Rating)
    const displayAvg = totalReviews > 0 
        ? Number(rawAvg).toFixed(1) 
        : 'جديد';

    // ==========================================
    // 5. تجهير البيانات النهائية (جاهزة للـ Frontend)
    // ==========================================
    const publicKitchen = { ...result[0] };
    if (!['admin','chef'].includes(req.user?.roles)) { delete publicKitchen.phone_number; delete publicKitchen.whatsapp_number; }
    req.kitchen = {
        ...publicKitchen,
        ...count[0],
        dishes_count: dishesCount, // التصحيح المهم هنا!
        avg_rating: totalReviews > 0 ? Number(rawAvg) : null,
        fair_score: fairScore,
        display_avg_rating: displayAvg, // المتوسط الحسابي الخام
        reviews_count: totalReviews,
        rating_distribution: {
            5: count[0]?.star_5 || 0,
            4: count[0]?.star_4 || 0,
            3: count[0]?.star_3 || 0,
            2: count[0]?.star_2 || 0,
            1: count[0]?.star_1 || 0
        }
    };

    next();
}
async function Mykitchens_controller(req,res){
    return res.status(200).json({
        status:'success',
        data: req.my || [],
    });
}

//DON'T NEED IT 
async function getKitchens_controller(req, res) {
    const [kitchens]=await pool.query('SELECT * FROM kitchens');
    
    if(kitchens.length===0)return res.status(404).json({message:'not found kitchens',message:'error'});
    
    return res.status(200).json({
        status: 'success',
        data: kitchens || [],
        // pagination: req.pagination || { page: 1, limit: 10, total: 0, total_pages: 1 }
    });
}

// =============================================
// API لجلب المطابخ مع Pagination والفلترة
// =============================================
async function getKitchensPaginated_controller(req, res) {
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 10, 50);
        const offset = (page - 1) * limit;
        const q = req.query.q || '';
        const city = req.query.city || '';
        const category = req.query.category || '';
        
        let queryParams = [];
        let whereClauses = [];
        
        // بناء استعلام المطابخ مع JOIN للمستخدمين لحساب عدد الأطباق
        let baseQuery = `
            SELECT 
                k.*,
                CONCAT(u.first_name, ' ', u.last_name) as chef_name,
                u.first_name,
                u.last_name,
                COUNT(DISTINCT d.id) as dishes_count,
                ROUND(AVG(r.rating), 1) as avg_rating
            FROM kitchens k
            JOIN users u ON u.id = k.user_id
            LEFT JOIN dishes d ON d.kitchen_id = k.id
            LEFT JOIN reviews r ON r.dish_id = d.id
        `;
        
        // فلتر المدينة
        if (city) {
            whereClauses.push('k.city = ?');
            queryParams.push(city);
        }
        
        // فلتر التصنيف (من خلال الأطباق)
        if (category) {
            baseQuery += ` LEFT JOIN categories c ON d.category_id = c.id`;
            whereClauses.push('c.name = ?');
            queryParams.push(category);
        }
        
        // البحث النصي
        if (q) {
            const searchKeyword = `%${q}%`;
            whereClauses.push(`(k.title LIKE ? OR k.description LIKE ? OR k.address LIKE ?)`);
            queryParams.push(searchKeyword, searchKeyword, searchKeyword);
        }
        
        let whereClause = '';
        if (whereClauses.length > 0) {
            whereClause = ' WHERE ' + whereClauses.join(' AND ');
        }
        
        // استعلام البيانات مع GROUP BY و LIMIT
        const dataQuery = `
            ${baseQuery}
            ${whereClause}
            GROUP BY k.id
            ORDER BY k.created_at DESC
            LIMIT ? OFFSET ?
        `;
        
        const dataParams = [...queryParams, limit, offset];
        const [data] = await pool.query(dataQuery, dataParams);
        
        // استعلام COUNT
        let countQuery = `
            SELECT COUNT(DISTINCT k.id) as total
            FROM kitchens k
            JOIN users u ON u.id = k.user_id
            LEFT JOIN dishes d ON d.kitchen_id = k.id
        `;
        
        if (category) {
            countQuery += ` LEFT JOIN categories c ON d.category_id = c.id`;
        }
        
        if (whereClauses.length > 0) {
            countQuery += ` ${whereClause}`;
        }
        
        const [totalResult] = await pool.query(countQuery, queryParams);
        const total = totalResult[0]?.total || 0;
        
        const visible = !['admin','chef'].includes(req.user?.roles) ? data.map(row => { const item={...row}; delete item.phone_number; delete item.whatsapp_number; delete item.user_phone; delete item.email; return item; }) : data;
        return res.status(200).json({
            status: 'success',
            data: {
                kitchens: visible,
                pagination: {
                    page: page,
                    limit: limit,
                    total: total,
                    total_pages: Math.ceil(total / limit)
                },
                filters: {
                    q: q,
                    city: city,
                    category: category
                }
            }
        });
}

async function getKitchenById_controller(req, res) {
    const { id } = checker(idParamSchema, req.params, res);
    if (!id || res.headersSent) return;

    const [kitchens] = await pool.query(`
        SELECT k.*, u.first_name, u.last_name, u.email, u.phone_number as user_phone
        FROM kitchens k
        JOIN users u ON k.user_id = u.id
        WHERE k.id = ?
    `, [id]);

    if (kitchens.length === 0) {
        return res.status(404).json({
            status: 'error',
            message: 'المطبخ غير موجود'
        });
    }

    return res.status(200).json({
        status: 'success',
        data: kitchens[0]
    });
}

async function createKitchen_controller(req, res) {
    const userId = req.user.id;

    const [existing] = await pool.query(
        'SELECT id FROM kitchens WHERE user_id = ?',
        [userId]
    );

    if (existing.length > 0) {
        return res.status(409).json({
            status: 'error',
            message: 'لديك مطبخ مسجل مسبقاً'
        });
    }

    const validatedData = checker(kitchenSchema, req.body, res);
    if (!validatedData || res.headersSent) return;

    let { title, description, city, address, phone_number } = validatedData;

    if (!title) title = `مطبخ ${req.user.first_name} ${req.user.last_name}`;
    if (!phone_number) phone_number = req.user.phone_number;
    if (!city) city = 'غير محدد';

    const [result] = await pool.query(
        `INSERT INTO kitchens 
        (title, description, city, address, image_url, phone_number, user_id) 
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [title, description || null, city, address || null, null, phone_number, userId]
    );

    //redirect to /myKitchen
    return res.status(201).json({
        status: 'success',
        message: 'تم إنشاء المطبخ بنجاح',
        redirect: '/users/dachboard',
        data: {
            id: result.insertId,
            title,
            description,
            city,
            address,
            image_url:null,
            phone_number
        }
    });
}

async function deleteKitchen_controller(req, res) {
    const { id } = checker(idParamSchema, req.params, res);
    if (!id) return;

    const [existing] = await pool.query(
        'SELECT id FROM kitchens WHERE id = ?',
        [id]
    );

    if (existing.length === 0) {
        return res.status(404).json({
            status: 'error',
            message: 'المطبخ غير موجود'
        });
    }

    await pool.query(
        'DELETE FROM kitchens WHERE id = ?',
        [id]
    );

    return res.status(200).json({
        status: 'success',
        message: 'تم حذف المطبخ بنجاح'
    });
}

async function updateMyKitchen_controller(req, res) {
    const userId = req.user.id;
    let kitchen=[];

    const validatedData = checker(kitchenUpdateSchema, req.body, res);
    if (!validatedData || res.headersSent) return;


    const { title, description, city, address, phone_number,kitchen_id } = validatedData;

    if (phone_number) {
        const [userWithPhone] = await pool.query(
            'SELECT id FROM users WHERE phone_number = ? AND id != ?',
            [phone_number, userId]
        );

        if (userWithPhone.length > 0) {
            return res.status(409).json({
                status: 'error',
                message: 'رقم الهاتف مستخدم من قبل حساب آخر'
            });
        }

        const [kitchenWithPhone] = await pool.query(
            'SELECT id FROM kitchens WHERE phone_number = ? AND user_id != ?',
            [phone_number, userId]
        );

        if (kitchenWithPhone.length > 0) {
            return res.status(409).json({
                status: 'error',
                message: 'رقم الهاتف مستخدم من قبل مطبخ آخر'
            });
        }
    }

    if (title) {
        const [duplicateTitle] = await pool.query(
            'SELECT id FROM kitchens WHERE title = ? AND user_id != ?',
            [title, userId]
        );

        if (duplicateTitle.length > 0) {
            return res.status(409).json({
                status: 'error',
                message: 'هذا الاسم مستخدم من قبل مطبخ آخر'
            });
        }
    }

    if(!req.user.roles==="admin"){
        const [haveKitchen] = await pool.query(
            `SELECT * FROM kitchens WHERE id=? AND user_id=?`,[kitchen_id,userId]
        );
        
        if(haveKitchen.length===0){
            return res.status(401).json({
                status: 'error',
                message: 'اسف لن تستطيع التحكم فى هذا المطبخ'
            });
        }
        
        kitchen=haveKitchen;
    }
    

    if(kitchen.length===0)
        return res.status(404).json({
            stauts:'error',
            message:'اسف لم نجد المطبخ'
        });

    const updates = [];
    const params = [];

    if (title !== undefined) {
        updates.push('title = ?');
        params.push(title);
    }
    if (description !== undefined) {
        updates.push('description = ?');
        params.push(description);
    }
    if (city !== undefined) {
        updates.push('city = ?');
        params.push(city);
    }
    if (address !== undefined) {
        updates.push('address = ?');
        params.push(address);
    }
    if (phone_number !== undefined) {
        updates.push('phone_number = ?');
        params.push(phone_number);
    }

    if (updates.length === 0) {
        console.log('here controller');
        return res.status(400).json({
            status: 'error',
            message: 'لا توجد بيانات للتحديث'
        });
    }

    params.push(kitchen[0].id);

    await pool.query(
        `UPDATE kitchens SET ${updates.join(', ')} WHERE id = ?`,
        params
    );

    return res.status(200).json({
        status: 'success',
        message: 'تم تحديث المطبخ بنجاح'
    });
}

// must add req.query.kitchen_id
async function uploadKitchenImageBackground_controller(req, res) {
        const {kitchen_id}=req.query;
        let selectedKitchen = null;
        
        if (req.my && Array.isArray(req.my) && req.my.length > 0) {
            if (kitchen_id) 
                selectedKitchen = req.my.find(k => String(k.id) === String(kitchen_id));

            selectedKitchen = selectedKitchen || req.my[0];
        }

        if (!req.file) {
            return res.status(400).json({
                status: 'error',
                message: 'من فضلك ارفع صورة'
            });
        }

        const imageUrl = `/uploads/${req.file.filename}`;

        await pool.query(
            'UPDATE kitchens SET image_url = ? WHERE id = ?',
            [imageUrl, selectedKitchen.id]
        );

        return res.status(200).json({
            status: 'success',
            message: 'تم رفع الصورة بنجاح',
            data: {
                image_url: imageUrl
            },
        });
}

async function uploadKitchenImageProfile_controller(req, res) {
        const {kitchen_id}=req.query;
        let selectedKitchen = null;
        
        if (req.my && Array.isArray(req.my) && req.my.length > 0) {
            if (kitchen_id) 
                selectedKitchen = req.my.find(k => String(k.id) === String(kitchen_id));

            selectedKitchen = selectedKitchen || req.my[0];
        }
    
    
        if (!req.file) {
            return res.status(400).json({
                status: 'error',
                message: 'من فضلك ارفع صورة'
            });
        }

        const imageUrl = `/uploads/${req.file.filename}`;

        await pool.query(
            'UPDATE kitchens SET portfolio_url = ? WHERE id = ?',
            [imageUrl, selectedKitchen.id]
        );

        return res.status(200).json({
            status: 'success',
            message: 'تم رفع الصورة بنجاح',
            data: {
                image_url: imageUrl
            },
        });
}

async function listCities_controller(req,res) {
    const [rows] = await pool.query("SELECT DISTINCT city FROM kitchens WHERE city IS NOT NULL AND TRIM(city) <> '' ORDER BY city ASC");
    return res.json({status:'success',data:rows.map(row=>row.city)});
}

async function getFeaturedKitchens() {
    const [kitchens] = await pool.query(`
        SELECT 
            k.id,
            k.title,
            k.city,
            k.portfolio_url as image,
            CONCAT(u.first_name ,' ', u.last_name) as chef_name,
            COUNT(d.id) AS dishes_count
        FROM kitchens k
        LEFT JOIN dishes d ON d.kitchen_id = k.id
        JOIN users u ON u.id=k.user_id
        GROUP BY k.id
        ORDER BY k.created_at DESC
        LIMIT 6
    `);
    return kitchens;
}


module.exports = {
    getKitchenById_controller,
    getKitchens_controller,
    createKitchen_controller,
    deleteKitchen_controller,
    updateMyKitchen_controller,
    uploadKitchenImageBackground_controller,
    uploadKitchenImageProfile_controller,
    Mykitchens_controller,
    getKitchensPaginated_controller,
    getKitchenById_middleware,
    getFeaturedKitchens,
    listCities_controller
};
