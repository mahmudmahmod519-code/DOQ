/**
 * Middleware factory that loads the current user's owned resources (kitchen, dishes, reviews, user profile)
 * into req.my with optional pagination and filters.
 * Requires an authenticated user (req.user must be set by auth middleware).
 */
const pool = require("../database/pool");
const { searchQuerySchema } = require('../utiles/validation');

/**
 * @param {string} resource - Resource type to load ('kitchen', 'dish', 'review', 'user').
 * @param {boolean} [pass=false] - If true, allows empty results without 404.
 * @param {boolean} [withPagination=true] - If true, applies pagination, filters, and search.
 * @returns {Function} Express middleware: async (req, res, next) => void.
 */
module.exports = (resource, pass = false, withPagination = true) => {
    return async (req, res, next) => {
        try {
            // 1. Validate query parameters
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

            // 2. Determine base table, joins, and WHERE clause per resource
            let tableName = '';
            let joinClause = '';
            let selectFields = '';
            let baseQuery = '';
            let whereClauses = [];
            let queryParams = [];
            let isCollection = true; // whether result is an array or single object

            if (!req.user)
                return res.status(401).redirect('/auth');

            const userId = req.user.id;

            switch (resource) {
                case 'kitchen':
                    tableName = 'kitchens';
                    selectFields = `${tableName}.*`;
                    baseQuery = `SELECT ${selectFields} FROM ${tableName}`;
                    whereClauses.push(`${tableName}.user_id = ?`);
                    queryParams.push(userId);
                    isCollection = true; // user has one kitchen but we treat as collection
                    break;

                case 'dish':
                    tableName = 'dishes';
                    // Join with kitchens and categories for name lookups
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
                    isCollection = false; // single user profile
                    break;

                default:
                    return res.status(400).json({
                        status: 'error',
                        message: 'نوع مورد غير معروف'
                    });
            }

            if (withPagination) {
                // 3. Add resource-specific filters
                if (resource === 'kitchen' && city) {
                    whereClauses.push(`${tableName}.city = ?`);
                    queryParams.push(city);
                }

                if (resource === 'dish') {
                    if (category) {
                        // Filter by category name (categories.name)
                        whereClauses.push(`categories.name = ?`);
                        queryParams.push(category);
                    }
                    // Price range filter
                    whereClauses.push(`${tableName}.price BETWEEN ? AND ?`);
                    queryParams.push(min_price, max_price);
                }

                if (resource === 'review' && rating !== undefined) {
                    whereClauses.push(`${tableName}.rating = ?`);
                    queryParams.push(rating);
                }
            }

            // 4. Text search (q)
            if (q && withPagination) {
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


            // 5. Build final query with ORDER BY, LIMIT, OFFSET
            const pageLimit = parseInt(limit, 10);
            const pageOffset = parseInt(offset, 10);
            let paginationParams = [...queryParams];

            let finalQuery = baseQuery;
            if (whereClauses.length > 0)
                finalQuery += ` WHERE ` + whereClauses.join(' AND ');

            if (withPagination) {
                finalQuery += ` ORDER BY ${tableName}.${sort_by} ${sort_order} LIMIT ? OFFSET ?`;
                // Add LIMIT and OFFSET params
                paginationParams = [...paginationParams, pageLimit, pageOffset];
            }


            const [data] = await pool.query(finalQuery, paginationParams);

            // 6. Store results in req.my
            req.my = isCollection ? data : data[0];

            // 7. Calculate total count for pagination
            let countQuery = `SELECT COUNT(1) AS total FROM ${tableName}`;
            if (joinClause) {
                countQuery = `SELECT COUNT(1) AS total FROM ${tableName} ${joinClause}`;
            }
            // Rebuild WHERE clauses without LIMIT/OFFSET params
            let countWhere = '';
            if (whereClauses.length > 0) {
                countWhere = ' WHERE ' + whereClauses.join(' AND ');
            }
            countQuery += countWhere;

            // Count query params (without LIMIT/OFFSET)
            const countParams = queryParams.slice(); // copy
            const [totalResult] = await pool.query(countQuery, countParams);
            const total = totalResult[0].total;

            req.pagination = {
                page: parseInt(page),
                limit: parseInt(limit),
                total: total,
                total_pages: Math.ceil(total / limit)
            };

            // 8. If no data and pass = false, return 404
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