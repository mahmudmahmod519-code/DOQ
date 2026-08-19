const pool = require("../database/pool");

module.exports = (resource,pass=false) => {
    return async (req, res, next) => {
        try {
            const userId = req.user.id;
            let query = '';
            
            let isCollection = true; 

            switch (resource) {
                case 'kitchen':
                    query = 'SELECT * FROM kitchens WHERE user_id = ?';
                    isCollection = false; 
                    break;

                case 'dish':
                    query = `
                        SELECT dishes.* ,
                        categories.name as category_name
                        FROM dishes 
                        JOIN kitchens ON dishes.kitchen_id = kitchens.id
                        JOIN categories ON categories.id=dishes.category_id 
                        WHERE kitchens.user_id = ?;
                    `;
                    isCollection = true; 
                    break;

                case 'review':
                    query = `SELECT * FROM reviews WHERE user_id = ?`;
                    isCollection = true;
                    break;

                case 'user':
                    query = `SELECT * FROM users WHERE id = ?`;
                    isCollection = false;
                    break;
                    
                default:
                    return res.status(400).json({
                        status: 'error',
                        message: 'نوع مورد غير معروف'
                    });
            } 

            const [results] = await pool.query(query, [userId]);

            if (results.length === 0 && pass===false) 
                return res.status(404).json({ message: 'لم أجد أي بيانات شخصية', status: 'error' });
            
            req.my = isCollection ? results : results[0];
            //don't need it again
            // delete req.user;
            next();
            
        } catch (ex) {
            // تم تصحيح المتغير هنا من error إلى ex
            console.error('Owner Check Error:', ex);
            return res.status(500).json({
                status: 'error',
                message: 'حدث خطأ أثناء تخزين موردي الشخصي'
            });
        }
    }
}