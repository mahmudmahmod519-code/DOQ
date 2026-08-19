const pool = require("../database/pool");
const { searchQuerySchema } = require('../utiles/validation');

module.exports = (resource, pass = false,withPageination=true) => {
    return async (req, res, next) => {
        try {
                // 1. التحقق من صحة معاملات query
                const { error, value } = searchQuerySchema.validate(req.query);
                if (error) {
                    return res.status(400).json({
                        status: 'error',
                        message: error.details[0].message
                    });
                }
                
                const {
                    q,
                    city,
                    category,
                    min_price = 0,
                    max_price = 10000,
                    rating,
                    page = 1,
                    limit = 10,
                    sort_by = 'id',
                    sort_order = 'ASC'
                } = value;
                
                const offset = (page - 1) * limit;
                
                // 2. تحديد اسم الجدول الأساسي والجداول المنضمة
                let tableName = '';
                let joinClause = '';
                let selectFields = '';
                let baseQuery = '';
                let whereClauses = [];
                let queryParams = [];
                let isCollection = true; // هل النتيجة مجموعة أم مفردة
                

            const userId = req.user.id;

            switch (resource) {
                case 'kitchen':
                    tableName = 'kitchens';
                    selectFields = `${tableName}.*`;
                    baseQuery = `SELECT ${selectFields} FROM ${tableName}`;
                    whereClauses.push(`${tableName}.user_id = ?`);
                    queryParams.push(userId);
                    isCollection = true; // مفردة (لأن المستخدم له مطبخ واحد فقط)
                    break;

                case 'dish':
                    tableName = 'dishes';
                    // انضمام مع kitchens و categories
                    joinClause = `
                        JOIN kitchens ON ${tableName}.kitchen_id = kitchens.id
                        JOIN categories ON ${tableName}.category_id = categories.id
                    `;
                    selectFields = `${tableName}.*, categories.name as category_name`;
                    baseQuery = `SELECT ${selectFields} FROM ${tableName} ${joinClause}`;
                    whereClauses.push(`kitchens.user_id = ?`);
                    queryParams.push(userId);
                    isCollection = true;
                    break;

                case 'review':
                    tableName = 'reviews';
                    selectFields = `${tableName}.*`;
                    baseQuery = `SELECT ${selectFields} FROM ${tableName}`;
                    whereClauses.push(`${tableName}.user_id = ?`);
                    queryParams.push(userId);
                    isCollection = true;
                    break;

                case 'user':
                    tableName = 'users';
                    selectFields = `${tableName}.*`;
                    baseQuery = `SELECT ${selectFields} FROM ${tableName}`;
                    whereClauses.push(`${tableName}.id = ?`);
                    queryParams.push(userId);
                    isCollection = false; // بيانات مستخدم واحد
                    break;

                default:
                    return res.status(400).json({
                        status: 'error',
                        message: 'نوع مورد غير معروف'
                    });
            }
if(withPageination){

    // 3. إضافة الفلاتر حسب نوع المورد
    if (resource === 'kitchen' && city) {
                whereClauses.push(`${tableName}.city = ?`);
                queryParams.push(city);
            }
            
            if (resource === 'dish') {
                if (category) {
                    // الفلتر باسم الفئة (categories.name)
                    whereClauses.push(`categories.name = ?`);
                    queryParams.push(category);
                }
                // فلتر السعر (نطاق)
                whereClauses.push(`${tableName}.price BETWEEN ? AND ?`);
                queryParams.push(min_price, max_price);
            }
            
            if (resource === 'review' && rating !== undefined) {
                whereClauses.push(`${tableName}.rating = ?`);
                queryParams.push(rating);
            }
}
            // 4. البحث (q)
            if (q && withPageination) {
                const searchKeyword = `%${q}%`;
                switch (resource) {
                    case 'kitchen':
                        whereClauses.push(`(${tableName}.title LIKE ? OR ${tableName}.description LIKE ? OR ${tableName}.address LIKE ? OR ${tableName}.phone_number LIKE ?)`);
                        queryParams.push(searchKeyword, searchKeyword, searchKeyword, searchKeyword);
                        break;
                    case 'dish':
                        whereClauses.push(`(${tableName}.name LIKE ? OR ${tableName}.description LIKE ?)`);
                        queryParams.push(searchKeyword, searchKeyword);
                        break;
                    case 'review':
                        whereClauses.push(`(${tableName}.comment LIKE ?)`);
                        queryParams.push(searchKeyword);
                        break;
                    case 'user':
                        whereClauses.push(`(${tableName}.first_name LIKE ? OR ${tableName}.last_name LIKE ? OR ${tableName}.phone_number LIKE ? OR ${tableName}.email LIKE ? OR ${tableName}.roles LIKE ?)`);
                        queryParams.push(searchKeyword, searchKeyword, searchKeyword, searchKeyword, searchKeyword);
                        break;
                    default:
                        return res.status(400).json({ status: 'error', message: 'نوع مورد غير معروف للبحث' });
                }
            }

            
            // 5. بناء الاستعلام النهائي مع ORDER BY و LIMIT و OFFSET
            const pageLimit = parseInt(limit, 10);
            const pageOffset = parseInt(offset, 10);
            let paginationParams=[...queryParams];

            let finalQuery = baseQuery;
            if (whereClauses.length > 0) 
                finalQuery += ` WHERE ` + whereClauses.join(' AND ');
            
            if(withPageination){
                finalQuery += ` ORDER BY ${tableName}.${sort_by} ${sort_order} LIMIT ? OFFSET ?`;
                // إضافة معاملات LIMIT و OFFSET
                paginationParams=[...paginationParams,pageLimit,pageOffset];
            }
                
            
            const [data] = await pool.query(finalQuery, paginationParams);

            // 6. تخزين النتائج في req.my
            req.my = isCollection ? data : data[0];

            // 7. حساب إجمالي السجلات (pagination)
            let countQuery = `SELECT COUNT(1) AS total FROM ${tableName}`;
            if (joinClause) {
                countQuery = `SELECT COUNT(1) AS total FROM ${tableName} ${joinClause}`;
            }
            // إعادة بناء WHERE clauses بدون معاملات LIMIT/OFFSET
            let countWhere = '';
            if (whereClauses.length > 0) {
                countWhere = ' WHERE ' + whereClauses.join(' AND ');
            }
            countQuery += countWhere;

            // معاملات الاستعلام (بدون last two parameters الخاصة بـ LIMIT/OFFSET)
            const countParams = queryParams.slice(); // نسخ
            const [totalResult] = await pool.query(countQuery, countParams);
            const total = totalResult[0].total;

            req.pagination = {
                page: parseInt(page),
                limit: parseInt(limit),
                total: total,
                total_pages: Math.ceil(total / limit)
            };

            // 8. إذا لم توجد بيانات و pass = false نعيد 404
            if ((data.length === 0 || !data) && pass === false) {
                return res.status(404).json({ message: 'لم أجد أي بيانات شخصية', status: 'error' });
            }

            next();

        } catch (ex) {
            console.error('My Resources Error:', ex);
            return res.status(500).json({
                status: 'error',
                message: 'حدث خطأ أثناء جلب البيانات الشخصية'
            });
        }
    };
};