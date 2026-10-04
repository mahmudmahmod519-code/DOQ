const checker=require('../utiles/checker');
const {
    idParamSchema,
    userUpdateSchema,
    createAdminUserSchema
}=require('../utiles/validation');
const pool = require("../database/pool");
const bcrypt = require("bcrypt");


/**
 * Middleware: يجلب إحصائيات الشيف ويضعها في req.dashboard
 */
async function getUnifiedChefDashboard(req, res, next) {
    const userId = req.user.id;
    const requestedKitchenId = req.query.kitchen_id;
    // const requestedKitchenId = uuidToBinary(req.query.kitchen_id);

    // 1. جلب كل مطابخ الشيف (للقائمة المنسدلة)
    const [allKitchens] = await pool.query(
        'SELECT id, title, image_url, portfolio_url, city, phone_number, created_at FROM kitchens WHERE user_id = ? ORDER BY created_at DESC',
        [userId]
    );

    if (allKitchens.length === 0) {
        req.dashboard = { hasKitchen: false, allKitchens: [] };
        return next();
    }

    // 2. تحديد المطبخ النشط (من الـ URL أو أول مطبخ افتراضياً)
    let activeKitchen = allKitchens.find(k => String(k.id) === String(requestedKitchenId));
    if (!activeKitchen) {
        activeKitchen = allKitchens[0];
    }
    const activeKitchenId = activeKitchen.id;

    // 3. جلب الإحصائيات للمطبخ النشط فقط
    const [dishesCountResult] = await pool.query(
        'SELECT COUNT(*) as count FROM dishes WHERE kitchen_id = ?',
        [activeKitchenId]
    );
    const dishesCount = dishesCountResult[0].count;

    const [reviewsResult] = await pool.query(
        `SELECT COUNT(r.id) as count, ROUND(AVG(r.rating), 2) as avg_rating
         FROM dishes d
         LEFT JOIN reviews r ON r.dish_id = d.id
         WHERE d.kitchen_id = ?`,
        [activeKitchenId]
    );
    const reviewsCount = reviewsResult[0].count || 0;
    const avgRating = parseFloat(reviewsResult[0].avg_rating || 0);

    // حساب Fair Score
    const C = 20;
    const m = 4.2;
    const fairScore = reviewsCount > 0
        ? parseFloat((((reviewsCount * avgRating) + (C * m)) / (reviewsCount + C)).toFixed(2))
        : 0;

    // آخر 5 تقييمات
    const [recentReviews] = await pool.query(
        `SELECT r.id, r.rating, r.comment, r.created_at, d.name as dish_name, d.image_url as dish_image, u.first_name, u.last_name
         FROM reviews r
         JOIN dishes d ON r.dish_id = d.id
         JOIN users u ON r.user_id = u.id
         WHERE d.kitchen_id = ?
         ORDER BY r.created_at DESC LIMIT 5`,
        [activeKitchenId]
    );

    // أفضل 5 أطباق
    const [topDishes] = await pool.query(
        `SELECT d.id, d.name, d.image_url, d.price, COUNT(r.id) as review_count, AVG(r.rating) as avg_rating,
                (COUNT(r.id) * AVG(r.rating) + 20 * 4.2) / (COUNT(r.id) + 20) as fair_score
         FROM dishes d
         LEFT JOIN reviews r ON r.dish_id = d.id
         WHERE d.kitchen_id = ?
         GROUP BY d.id
         ORDER BY fair_score DESC, review_count DESC LIMIT 5`,
        [activeKitchenId]
    );

    // آخر 5 أطباق مضافة
    const [recentDishes] = await pool.query(
        `SELECT d.id, d.name, d.image_url, d.price, d.created_at, COUNT(r.id) as review_count, AVG(r.rating) as avg_rating
         FROM dishes d
         LEFT JOIN reviews r ON r.dish_id = d.id
         WHERE d.kitchen_id = ?
         GROUP BY d.id
         ORDER BY d.created_at DESC LIMIT 5`,
        [activeKitchenId]
    );

    // 4. تجميع البيانات وإرسالها للـ Frontend
    req.dashboard = {
        hasKitchen: true,
        allKitchens: allKitchens,
        activeKitchen: activeKitchen,
        stats: { dishesCount, reviewsCount, avgRating, fairScore },
        recentReviews,
        topDishes,
        recentDishes
    };

    next();
}


async function deleteUser_controller(req,res){

    const {id}=checker(idParamSchema,req.params,res);

    const [user]=await pool.query(`SELECT * FROM users WHERE id=?`,[id]);
    if(user.length===0)return res.status(404).json({message:"this account not here",status:"error"});

    await pool.query(`DELETE FROM users WHERE id=?`,[id]);

    return res.status(200).json({message: "تم حذف الحساب بنجاح",status:"successful"});
}

async function changePortfolio_controller(req,res){

    
    const isAdminUser = req.user.roles === 'admin';
    const targetUserId = (req.params.id && isAdminUser) ? req.params.id : req.user.id;

    if (req.params.id && !isAdminUser) {
        return res.status(403).json({
            status: 'error',
            message: 'غير مسموح لك بتعديل بيانات مستخدمين آخرين'
        });
    }

    const validatedData=checker(userUpdateSchema,req.body,res);
    const first_name = validatedData.first_name || req.user.first_name;
    const last_name = validatedData.last_name || req.user.last_name;
    const phone_number = validatedData.phone_number || req.user.phone_number;
    const roles = validatedData.roles || req.user.roles;
    const city = validatedData.city || req.user.city;
    const address = validatedData.address || req.user.address;


    if (validatedData.phone_number) {
        const [userFound]=await pool.query(`SELECT * FROM users WHERE phone_number=? AND id <> ?`,[phone_number,targetUserId]);
    
        if (userFound.length > 0) 
            return res.status(409).json({ message: "رقم الهاتف مستخدم بالفعل من قبل حساب آخر", status: 'error' });
    }


    if (!isAdminUser && validatedData.roles && validatedData.roles !== req.user.roles)
        return res.status(403).json({ status: 'error', message: 'غير مسموح لك بتعديل صلاحياتك' });
    
    await pool.query(`
        UPDATE users 
        SET first_name=?,last_name=?,phone_number=?,roles=?,city=?,address=? 
        WHERE id=?
        `,[first_name,last_name,phone_number,roles,city,address,targetUserId]);

    return res.status(200).json({
            status: 'success',
            message: 'تم تحديث البيانات بنجاح'
        });
}

async function getSpcificUser_controller(req,res){
    const {id}=checker(idParamSchema,req.params,res);
    
    const [users] = await pool.query(
        `SELECT id, first_name, last_name, phone_number, email, city,address, roles, created_at FROM users WHERE id = ?`, 
        [id]
    );

    console.log(res);
    if (users.length === 0) {
        return res.status(404).json({
            status: 'error',
            message: 'المستخدم غير موجود'
        });
    }

    return res.status(200).json({
        status: 'success',
        data: users[0]
    });
}



async function uploadImageProfile_controller(req,res){
    const [users] = await pool.query(
        `SELECT count(1) as user FROM users WHERE id = ?`, 
        [req.user.id]
    );

    if(users.length===0)
        return res.status(404).json({message:'المستخدم غير موجود',status:'error'})
    
        if (!req.file) {
            return res.status(400).json({
                status: 'error',
                message: 'من فضلك ارفع صورة'
            });
        }

        const imageUrl = `/uploads/${req.file.filename}`;

        await pool.query(
            'UPDATE users SET portfolio_url = ? WHERE id = ?',
            [imageUrl, req.user.id]
        );

        console.log(imageUrl);
        return res.status(200).json({
            status: 'success',
            message: 'تم رفع الصورة بنجاح',
            data: {
                image_url: imageUrl
            },
        });
}

// أضف هذه الدالة في ملف controller/user.js
async function createUser_controller(req, res) {

    const {firstname, lastname, email, phone_number, password, roles}=checker(createAdminUserSchema,req.body,res);
    
    if(res.headersSent)return;

        // التحقق من عدم وجود البريد أو الهاتف مسبقاً
    const [existing] = await pool.query(
        'SELECT id FROM users WHERE email = ? OR phone_number = ?', 
        [email, phone_number]
    );
    
    if (existing.length > 0) {
        return res.status(409).json({ 
            status: 'error', 
            message: 'البريد الإلكتروني أو رقم الهاتف مستخدم بالفعل من قبل حساب آخر' 
        });
    }

    // تشفير كلمة المرور
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);
    const userRole = roles || 'admin';

    // إدخال البيانات في قاعدة البيانات (two_factor_enabled = 0 افتراضياً)
    await pool.query(
        `INSERT INTO users (first_name, last_name, email, phone_number, password_hash, roles, two_factor_enabled) 
         VALUES (?, ?, ?, ?, ?, ?, 0)`,
        [firstname, lastname, email, phone_number, password_hash, userRole]
    );

    return res.status(201).json({
        status: 'success',
        message: 'تم إنشاء الحساب بنجاح'
    });
}

module.exports={
    deleteUser_controller,
    changePortfolio_controller,
    getSpcificUser_controller,
    getUnifiedChefDashboard,
    uploadImageProfile_controller,
    createUser_controller
};
