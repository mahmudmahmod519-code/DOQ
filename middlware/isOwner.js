/**
 * Ownership verification middleware factory.
 * Checks that the authenticated user owns the requested resource (kitchen, dish, or review)
 * before allowing the request to proceed.
 */
const pool = require("../database/pool");

/**
 * @param {string} resourceType - Type of resource to check ownership for ('kitchen', 'dish', 'review').
 * @returns {Function} Express middleware: async (req, res, next) => void.
 */
module.exports = (resourceType) => {
    return async (req, res, next) => {
        try {
            const userId = req.user.id;
            let resourceId = req.params.id;

            let query = '';

            // Build ownership query per resource type
            switch (resourceType) {
                case 'kitchen':
                    query = 'SELECT user_id FROM kitchens WHERE id = ?';
                    break;

                case 'dish':
                    query = `
                    SELECT kitchens.user_id as user_id FROM kitchens
                    JOIN dishes ON dishes.kitchen_id = kitchens.id
                    WHERE dishes.id = ?;
                    `;
                    break;

                case 'review':
                    query = 'SELECT user_id FROM reviews WHERE id = ?';
                    break;

                default:
                    return res.status(400).json({
                        status: 'error',
                        message: 'نوع مورد غير معروف'
                    });
            }

            const [rows] = await pool.query(query, [resourceId]);

            if (rows.length === 0) {
                return res.status(404).json({
                    status: 'error',
                    message: 'المورد غير موجود'
                });
            }

            if (rows[0].user_id !== userId) {
                return res.status(403).json({
                    status: 'error',
                    message: 'ليس لديك صلاحية للوصول إلى هذا المورد'
                });
            }

            next();

        } catch (error) {
            console.error('Owner Check Error:', error && error.message);
            res.status(500).json({
                status: 'error',
                message: 'حدث خطأ أثناء التحقق من الملكية'
            });
        }
    };
};