const pool = require('../database/pool'); 
const { searchQuerySchema, idParamSchema } = require('../utiles/validation');

module.exports = (resource, relationType) => {
    return async (req, res, next) => {
        try {
            req.query.min_price = req.query.min_price || 0;
            req.query.max_price = req.query.max_price || 10000;
            
            const { error, value } = searchQuerySchema.validate(req.query);
            if (error) {
                return res.status(400).json({
                    status: 'error',
                    message: error.details[0].message
                });
            }

            const { q, city, category, min_price, max_price, rating, page, limit, sort_by, sort_order } = value;            
            const relationId = req.params.id;
            const offset = (page - 1) * limit;

            // التأكد من صحة اتجاه الترتيب لمنع SQL Injection
            const safeSortOrder = (sort_order && sort_order.toUpperCase() === 'ASC') ? 'ASC' : 'DESC';

            let baseQuery = '';
            let whereClauses = [];
            let queryParams = [];
            let tableName = '';
            let joinTableName = '';
            let relation_key_name = '';

            // 1. التحقق من ID العلاقات بحالة وجودها
            if (relationType) {
                try {
                    await idParamSchema.validateAsync({ id: relationId });
                } catch (err) {
                    return res.status(400).json({
                        status: 'error',
                        message: 'Invalid ID parameter'
                    });
                }

                switch (relationType) {
                    case 'kitchen':
                        tableName = 'dishes';
                        joinTableName = 'kitchens';
                        relation_key_name = 'kitchen_id';
                        baseQuery = `SELECT ${tableName}.*, ${joinTableName}.title as kitchen_title, ${joinTableName}.portfolio_url as kitchen_portfolio FROM ${tableName} JOIN ${joinTableName} ON ${tableName}.${relation_key_name} = ${joinTableName}.id`;
                        whereClauses.push(`${joinTableName}.id = ?`);
                        queryParams.push(relationId);
                        break;
                        
                    case 'category':
                        tableName = 'dishes';
                        joinTableName = 'categories';
                        relation_key_name = 'category_id';
                        baseQuery = `SELECT ${tableName}.*, ${joinTableName}.name as category_name FROM ${tableName} JOIN ${joinTableName} ON ${tableName}.${relation_key_name} = ${joinTableName}.id`;
                        whereClauses.push(`${joinTableName}.id = ?`);
                        queryParams.push(relationId);
                        break;
                        
                    case 'dish':
                        tableName = 'reviews';
                        joinTableName = 'dishes';
                        relation_key_name = 'dish_id';
                        baseQuery = `SELECT ${tableName}.*, ${joinTableName}.name FROM ${tableName} JOIN ${joinTableName} ON ${tableName}.${relation_key_name} = ${joinTableName}.id`;
                        whereClauses.push(`${joinTableName}.id = ?`);
                        queryParams.push(relationId);
                        break;
                }
            } else {
                // حدد اسم الجدول الأساسي حسب نوع المورد
                if (resource === 'category') tableName = 'categories';
                else if (resource === 'dish') tableName = 'dishes';
                else tableName = resource + 's';

                baseQuery = `SELECT * FROM ${tableName}`;
            }

            // 2. تطبيق الفلاتر الخصيصة للموارد
            if (resource === 'kitchen' && city) {
                whereClauses.push(`${tableName}.city = ?`);
                queryParams.push(city);
            }

            if (resource === 'dish' && category && relationType !== 'category') {
                // إضافة Join مع التصنيفات بدون تدمير الـ Query الأصلية
                if (!joinTableName) {
                    joinTableName = 'categories';
                    relation_key_name = 'category_id';
                    baseQuery = `SELECT ${tableName}.*, ${joinTableName}.name as category_name FROM ${tableName} JOIN ${joinTableName} ON ${tableName}.${relation_key_name} = ${joinTableName}.id`;
                } else {
                    baseQuery += ` JOIN categories ON ${tableName}.category_id = categories.id`;
                }
                whereClauses.push(`categories.name = ?`);
                queryParams.push(category);
            }

            if (resource === 'dish' && (min_price !== undefined || max_price !== undefined)) {
                whereClauses.push(`${tableName}.price BETWEEN ? AND ?`);
                queryParams.push(min_price, max_price);
            }

            if (resource === 'review' && rating !== undefined) {
                whereClauses.push(`${tableName}.rating = ?`);
                queryParams.push(rating);
            }

            // 3. البحث النصي (q)
            if (q) {
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
                        return res.status(400).json({ status: 'error', message: 'نوع مورد غير معروف' });
                }
            }

            // 4. بناء الاستعلام النهائي لجلب البيانات
            let finalQuery = baseQuery;
            if (whereClauses.length > 0) {
                finalQuery += ` WHERE ` + whereClauses.join(' AND ');
            }
            finalQuery += ` ORDER BY ${tableName}.id ${safeSortOrder} LIMIT ? OFFSET ?`;
            
            const dataQueryParams = [...queryParams, parseInt(limit), parseInt(offset)];

            // 5. بناء استعلام الـ Pagination للمجموع (COUNT)
            let pageinationQuery = `SELECT COUNT(1) AS total FROM ${tableName}`;
            if (joinTableName) {
                pageinationQuery += ` JOIN ${joinTableName} ON ${tableName}.${relation_key_name} = ${joinTableName}.id`;
            }
            if (whereClauses.length > 0) {
                pageinationQuery += ` WHERE ` + whereClauses.join(' AND ');
            }

            // تنفيذ الاستعلامين
            const [data] = await pool.query(finalQuery, dataQueryParams);
            const [total] = await pool.query(pageinationQuery, queryParams);

            req.paginatedData = data;
            req.pagination = {
                page: parseInt(page),
                limit: parseInt(limit),
                total: total[0].total,
                total_pages: Math.ceil(total[0].total / limit)
            };

            next();

        } catch (ex) {
            console.error(ex);
            return res.status(500).json({
                status: 'error',
                message: ex.message
            });
        }
    };
};