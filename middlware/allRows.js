/**
 * Middleware factory that runs paginated, filterable list queries (with caching) for a resource
 * and attaches the resulting rows and pagination object to req before the controller runs.
 */
const pool = require('../database/pool');
const analyzeQuery = require('../utiles/analyzeQuery');
const { searchQuerySchema, idParamSchema } = require('../utiles/validation');
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 60, checkperiod: 120 });

/**
 * Deletes all cached GET responses whose key is prefixed with `${resource}_`.
 * @param {string} resource - Resource name used when the cache keys were created (e.g. 'dish').
 * @returns {void} Mutates the in-memory cache and logs how many keys were removed.
 */
function clearResourceCache(resource) {
    const keys = cache.keys();
    const keysToDelete = keys.filter(key => key.startsWith(`${resource}_`));
    keysToDelete.forEach(key => cache.del(key));
    console.log(`🗑️ Cleared cache for ${resource}: ${keysToDelete.length} keys`);
}

// ✅ مسح كل الكاش

/**
 * Removes every entry from the in-memory cache.
 * @returns {void} Flushes the cache and logs a confirmation message.
 */
function clearAllCache() {
    cache.flushAll();
    console.log('🗑️ All cache cleared');
}


/**
 * Builds an Express middleware that lists rows for `resource`, optionally scoped to a parent
 * relation (`relationType`), with search/filter/sort/pagination, a 60s in-memory cache, and
 * slow-query logging.
 * @param {string} resource - Resource name ('category', 'dish', 'review', 'user', 'kitchen', ...).
 * @param {string} [relationType] - Optional parent relation ('kitchen', 'category', 'dish') that
 *                                  filters rows by req.params.id of the parent table.
 * @returns {Function} Express middleware: async (req, res, next) => void.
 */
const middleware = (resource, relationType) => {

    /**
     * Middleware invoked for every request to the route.
     * - On POST/PUT/PATCH/DELETE it invalidates this resource's cache entries (side effect).
     * - Validates req.query against searchQuerySchema; on failure responds 400 directly.
     * - Clamps limit (<=100) and page (<=500), reads req.params.id for relation scoping.
     * - On GET, serves from cache when present: sets req.paginatedData/req.pagination and calls next().
     * - Otherwise builds the data + count SQL per resource/relation, applies filters, text search,
     *   ordering and LIMIT/OFFSET, executes both queries, stores the result in cache, sets
     *   req.paginatedData and req.pagination, logs slow queries and query analysis, then calls next().
     * - On error: logs it, responds 500 for SQL parse/field errors, 503 for timeout/deadlock,
     *   otherwise 500 with the error message.
     * @param {Object} req - Express request; inspects req.method, req.query, req.params.id;
     *                       mutates req.paginatedData and req.pagination.
     * @param {Object} res - Express response used for direct error/cache-miss responses.
     * @param {Function} next - Called on success or cache hit.
     */
    return async (req, res, next) => {
        try {
            const startTime = Date.now();

            // Invalidate cached reads whenever the resource may have changed
            if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
                clearResourceCache(resource);
            }


            // Validate query parameters first
            const { error, value } = searchQuerySchema.validate(req.query);
            if (error) {
                return res.status(400).json({
                    status: 'error',
                    message: error.details[0].message
                });
            }
            // console.log(value);
            // console.log(typeof(req.query.min_price || 0));
            const { q, city, category, min_price=0, max_price=10000, rating, page, limit, sort_by, sort_order } = value;

            // تحديد حد أقصى للـ limit (حماية من DDoS)
            const safeLimit = Math.min(parseInt(limit) || 20, 100);
            const safePage = Math.min(parseInt(page) || 1, 500);
            const offset = (safePage - 1) * safeLimit;

            const relationId = req.params.id;
            const safeSortOrder = (sort_order && sort_order.toUpperCase() === 'ASC') ? 'ASC' : 'DESC';

            // =============================================
            // 2. الكاش (Cache) لتقليل ضغط السيرفر
            // =============================================
            const cacheKey = `${resource}_${relationType || 'none'}_${relationId || 'none'}_${JSON.stringify(req.query)}`;

            if (req.method === 'GET') {
                const cachedData = cache.get(cacheKey);
                if (cachedData) {
                    req.paginatedData = cachedData.data;
                    req.pagination = cachedData.pagination;
                    return next();
                }
            }


            // =============================================
            // 3. بناء الاستعلام حسب نوع المورد
            // =============================================
            let dataQuery = '';
            let countQuery = '';
            let queryParams = [];
            let whereClauses = [];
            let tableName = '';
            let joinTableName = '';
            let relationKeyName = '';

            // تحديد الجدول الأساسي
            if (resource === 'category') tableName = 'categories';
            else if (resource === 'dish') tableName = 'dishes';
            else if (resource === 'review') tableName = 'reviews';
            else if (resource === 'user') tableName = 'users';
            else tableName = resource + 's';

            // =============================================
            // 4. التعامل مع العلاقات (relationType)
            // =============================================
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
                        relationKeyName = 'kitchen_id';
                        dataQuery = `
                            SELECT dishes.*, kitchens.title as kitchen_title, kitchens.portfolio_url as kitchen_portfolio
                            FROM dishes
                            JOIN kitchens ON dishes.kitchen_id = kitchens.id
                        `;
                        whereClauses.push('kitchens.id = ?');
                        queryParams.push(relationId);
                        break;
                    case 'category':
                        tableName = 'dishes';
                        joinTableName = 'categories';
                        relationKeyName = 'category_id';
                        dataQuery = `
                            SELECT dishes.*, categories.name as category_name
                            FROM dishes
                            JOIN categories ON dishes.category_id = categories.id
                        `;
                        whereClauses.push('categories.id = ?');
                        queryParams.push(relationId);
                        break;

                    case 'dish':
                        tableName = 'reviews';
                        joinTableName = 'dishes';
                        relationKeyName = 'dish_id';
                        dataQuery = `
                            SELECT reviews.*, dishes.name as dish_name
                            FROM reviews
                            JOIN dishes ON reviews.dish_id = dishes.id
                        `;
                        whereClauses.push('dishes.id = ?');
                        queryParams.push(relationId);
                        break;
                }
            } else {
                // حالة خاصة: التقييمات بدون relationType
                if (resource === 'review') {
                    dataQuery = `
                        SELECT
                            reviews.id,
                            reviews.rating,
                            reviews.comment,
                            reviews.created_at,
                            kitchens.title as kitchen_name,
                            dishes.name as dish_name,
                            users.first_name,
                            users.last_name
                        FROM reviews
                        JOIN dishes ON dishes.id = reviews.dish_id
                        JOIN kitchens ON kitchens.id = dishes.kitchen_id
                        JOIN users ON users.id = reviews.user_id
                    `;
                }
                //must get dish_count but have error when join query and pageination
                // else if(resource==='category'){
                //     dataQuery=`SELECT c.*,COUNT(d.id) as dishes_count FROM categories c
                //     LEFT JOIN dishes d ON c.id=d.cateogry_id
                //     GROUP BY c.id`;
                // }
                else {
                    // باقي الموارد
                    dataQuery = `SELECT ${tableName}.* FROM ${tableName}`;
                }
            }

            // =============================================
            // 5. تطبيق الفلاتر الخاصة بكل مورد
            // =============================================

            if(resource==='dish' && !relationType)
                dataQuery=`SELECT dishes.*, categories.name as category_name
                        FROM dishes
                        JOIN categories ON dishes.category_id = categories.id`;


            // فلتر المدينة (للمطابخ)
            if (resource === 'kitchen' && city) {
                whereClauses.push(`${tableName}.city = ?`);
                queryParams.push(city);
            }

            // فلتر التصنيف (للأطباق) مع تجنب التكرار
            if (resource === 'dish' && category && relationType !== 'category') {
                if (!joinTableName) {
                    joinTableName = 'categories';
                    relationKeyName = 'category_id';
                    dataQuery = `
                        SELECT dishes.*, categories.name as category_name
                        FROM dishes
                        JOIN categories ON dishes.category_id = categories.id
                    `;
                }
                whereClauses.push('categories.name = ?');
                queryParams.push(category);
            }

            // فلتر السعر (للأطباق)
            if (resource === 'dish' && (min_price !== undefined || max_price !== undefined)) {
                whereClauses.push(`${tableName}.price BETWEEN ? AND ?`);
                queryParams.push(min_price, max_price);
            }

            // فلتر التقييم (للتقييمات)
            if (resource === 'review' && rating !== undefined) {
                whereClauses.push(`${tableName}.rating = ?`);
                queryParams.push(rating);
            }

            // =============================================
            // 6. البحث النصي (q)
            // =============================================
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
                        return res.status(400).json({
                            status: 'error',
                            message: 'نوع مورد غير معروف'
                        });
                }
            }

            // =============================================
            // 7. تحديد عمود الترتيب
            // =============================================
            let orderColumn = `${tableName}.id`;
            if (sort_by === 'rating') {
                orderColumn = `${tableName}.rating`;
            } else if (sort_by === 'created_at') {
                orderColumn = `${tableName}.created_at`;
            } else if (sort_by === 'price') {
                orderColumn = `${tableName}.price`;
            }

            // =============================================
            // 8. بناء الاستعلام النهائي
            // =============================================
            let whereClause = '';
            if (whereClauses.length > 0) {
                whereClause = ' WHERE ' + whereClauses.join(' AND ');
            }

            // استعلام البيانات مع LIMIT و OFFSET
            const finalDataQuery = `
                ${dataQuery}
                ${whereClause}
                ORDER BY ${orderColumn} ${safeSortOrder}
                LIMIT ? OFFSET ?
            `;

            // =============================================
            // 9. بناء استعلام COUNT
            // =============================================
            let countQueryBase = '';

            // حالة خاصة للتقييمات
            if (resource === 'review' && !relationType) {
                countQueryBase = `
                    SELECT COUNT(1) AS total
                    FROM reviews
                    JOIN dishes ON dishes.id = reviews.dish_id
                    JOIN kitchens ON kitchens.id = dishes.kitchen_id
                    JOIN users ON users.id = reviews.user_id
                `;
            } else if (relationType) {
                // مع العلاقات
                countQueryBase = `SELECT COUNT(1) AS total FROM ${tableName}`;
                if (joinTableName) {
                    countQueryBase += ` JOIN ${joinTableName} ON ${tableName}.${relationKeyName} = ${joinTableName}.id`;
                }
            } else {
                // باقي الموارد
                countQueryBase = `SELECT COUNT(1) AS total FROM ${tableName}`;
            }

            // إضافة JOIN إضافي للتصنيفات إذا لزم الأمر
            if (resource === 'dish' && category && relationType !== 'category') {
                if (!countQueryBase.includes('categories')) {
                    countQueryBase += ` JOIN categories ON ${tableName}.category_id = categories.id`;
                }
            }

            const finalCountQuery = `
                ${countQueryBase}
                ${whereClause}
            `;

            // =============================================
            // 10. تنفيذ الاستعلامات
            // =============================================
            const dataQueryParams = [...queryParams, safeLimit, offset];

            // تنفيذ استعلام البيانات
            const [data] = await pool.query({
                sql: finalDataQuery,
                timeout: 5000
            }, dataQueryParams);

            // تنفيذ استعلام COUNT
            const [total] = await pool.query({
                sql: finalCountQuery,
                timeout: 5000
            }, queryParams);

            // =============================================
            // 11. تخزين النتائج
            // =============================================
            const result = {
                data: data,
                pagination: {
                    page: safePage,
                    limit: safeLimit,
                    total: total[0]?.total || 0,
                    total_pages: Math.ceil((total[0]?.total || 0) / safeLimit)
                }
            };

            // تخزين في الكاش
            cache.set(cacheKey, result);

            req.paginatedData = result.data;
            req.pagination = result.pagination;

            // =============================================
            // 12. تسجيل الاستعلامات البطيئة
            // =============================================
            const executionTime = Date.now() - startTime;
            if (executionTime > 1000) {
                console.warn(`⚠️ Slow Query (${executionTime}ms):`, {
                    resource,
                    relationType,
                    query: finalDataQuery,
                    params: dataQueryParams
                });
            }

            analyzeQuery(finalDataQuery,dataQueryParams).then(s=>{
                console.log(s);
            });

            next();

        } catch (ex) {
            console.error('Middleware Error:', {
                message: ex.message,
                stack: ex.stack,
                resource,
                relationType,
                query: req.query
            });

            // معالجة الأخطاء المختلفة
            if (ex.code === 'ER_PARSE_ERROR' || ex.code === 'ER_BAD_FIELD_ERROR') {
                return res.status(500).json({
                    status: 'error',
                    message: 'Database query error'
                });
            }

            if (ex.timeout || ex.code === 'ER_LOCK_DEADLOCK') {
                return res.status(503).json({
                    status: 'error',
                    message: 'Database is busy, please try again later'
                });
            }

            return res.status(500).json({
                status: 'error',
                message: ex.message || 'Internal server error'
            });
        }
    };
};

middleware.clearCache = clearResourceCache;
middleware.clearAll = clearAllCache;

module.exports = middleware;