const pool = require("../database/pool");

async function getAllReviewsForDish_controller(req,res){
const { dishId } = req.params;

    const [reviews] = await pool.query(`
        SELECT r.*, u.first_name, u.last_name
        FROM reviews r
        JOIN users u ON r.user_id = u.id
        WHERE r.dish_id = ?
        ORDER BY r.created_at DESC
        LIMIT 10
    `, [dishId]);

    return res.status(200).json({
        status: 'success',
        data: reviews
    });    
}

async function getAllReviewsForKitchen_controller(req,res){
 const { id } = req.params;

    const [reviews] = await pool.query(`
        SELECT r.*, u.first_name, u.last_name
        FROM reviews r
        JOIN dishes d ON r.dish_id = d.id
        JOIN users u ON r.user_id = u.id
        WHERE d.kitchen_id = ?
        ORDER BY r.created_at DESC
        LIMIT 10
    `, [id]);

    return res.status(200).json({
        status: 'success',
        data: reviews
    });
}


async function getChefReviews_controller(req, res){
const userId = req.user.id; // المعرف الخاص بالشيف المسجل

        // 1. التحقق من صحة معاملات الـ Query[cite: 5]
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

        const { kitchen_id } = req.query; // لتصفية مطبخ معين للشيف إن وجد

        const offset = (parseInt(page) - 1) * parseInt(limit);
        const pageLimit = parseInt(limit, 10);
        const pageOffset = parseInt(offset, 10);

        // 2. التحقق المسبق من ملكية المطبخ إذا تم تمرير kitchen_id
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

        // 3. إعداد الاستعلام الأساسي للجداول[cite: 5]
        const tableName = 'reviews';
        const joinClause = `
            JOIN dishes ON ${tableName}.dish_id = dishes.id
            JOIN kitchens ON dishes.kitchen_id = kitchens.id
        `;

        const selectFields = `
            ${tableName}.*, 
            dishes.name AS dish_name, 
            kitchens.title AS kitchen_title
        `;

        let baseQuery = `SELECT ${selectFields} FROM ${tableName} ${joinClause}`;
        
        // الشرط الأساسي: التقييمات التابعة لمطابخ هذا الشيف فقط
        let whereClauses = [`kitchens.user_id = ?`];
        let queryParams = [userId];

        // 4. تطبيق الفلاتر الإضافية[cite: 5]
        if (kitchen_id) {
            whereClauses.push(`kitchens.id = ?`);
            queryParams.push(kitchen_id);
        }

        if (rating !== undefined) {
            whereClauses.push(`${tableName}.rating = ?`);
            queryParams.push(rating);
        }

        // البحث النصي في تعليقات التقييمات[cite: 5]
        if (q) {
            const searchKeyword = `%${q}%`;
            whereClauses.push(`(${tableName}.comment LIKE ?)`);
            queryParams.push(searchKeyword);
        }

        // 5. بناء الاستعلام النهائي وجلب البيانات مع Pagination[cite: 5]
        let finalQuery = baseQuery + ` WHERE ` + whereClauses.join(' AND ');

        // تأمين الاتجاه الخاص بالترتيب
        const safeSortOrder = sort_order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
        finalQuery += ` ORDER BY ${tableName}.${sort_by} ${safeSortOrder} LIMIT ? OFFSET ?`;

        const dataQueryParams = [...queryParams, pageLimit, pageOffset];
        const [reviews] = await pool.query(finalQuery, dataQueryParams);

        // 6. استعلام إجمالي عدد النتائج للـ Pagination[cite: 5]
        let countQuery = `SELECT COUNT(1) AS total FROM ${tableName} ${joinClause} WHERE ` + whereClauses.join(' AND ');
        const [totalResult] = await pool.query(countQuery, queryParams);
        const total = totalResult[0].total;

        // 7. إرجاع النتيجة
        return res.status(200).json({
            status: 'success',
            data: reviews,
            pagination: {
                page: parseInt(page),
                limit: pageLimit,
                total: total,
                total_pages: Math.ceil(total / pageLimit)
            }
        });
};

async function name(req,res){

}
async function name(req,res){

}
async function name(req,res){

}

module.exports={
    getAllReviewsForDish_controller,
    getAllReviewsForKitchen_controller,
    getChefReviews_controller
}