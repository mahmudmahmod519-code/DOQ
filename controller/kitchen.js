const pool = require("../database/pool");
const checker = require("../utiles/checker");
const { kitchenSchema, kitchenUpdateSchema, idParamSchema } = require("../utiles/validation");

async function getKitchenById_middleware(req,res,next){
    const {id}=checker(idParamSchema,req.params,res);
    
    const [result]=await pool.query(`SELECT * FROM kitchens WHERE id=?`,[id]);
    
    if(result.length===0)return res.redirect('/');

    req.kitchen=result[0];
    
    next();
}

async function Mykitchens_controller(req,res){
    return res.status(200).json({
        status:'success',
        data: req.my || [],
    });
}

async function getKitchens_controller(req, res) {
    const [kitchens]=await pool.query('SELECT * FROM kitchens');
    
    if(kitchens.length===0)return res.status(404).json({message:'not found kitchens',message:'error'});
    
    return res.status(200).json({
        status: 'success',
        data: kitchens || [],
        // pagination: req.pagination || { page: 1, limit: 10, total: 0, total_pages: 1 }
    });
}

async function getKitchenById_controller(req, res) {
    const { id } = checker(idParamSchema, req.params, res);
    if (!id) return;

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
    if (!validatedData) return;

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
        redirect: '/kitchens/my',
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
    const userId = req.user.id||req.my.user_id;
    const kitchen = req.my;

    const validatedData = checker(kitchenUpdateSchema, req.body, res);
    if (!validatedData) return;

    const { title, description, city, address, phone_number } = validatedData;

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
        return res.status(400).json({
            status: 'error',
            message: 'لا توجد بيانات للتحديث'
        });
    }

    params.push(kitchen.id);

    await pool.query(
        `UPDATE kitchens SET ${updates.join(', ')} WHERE id = ?`,
        params
    );
    return res.status(200).json({
        status: 'success',
        message: 'تم تحديث المطبخ بنجاح'
    });
}


async function uploadKitchenImage_controller(req, res) {
        if (!req.file) {
            return res.status(400).json({
                status: 'error',
                message: 'من فضلك ارفع صورة'
            });
        }

        const kitchen = req.my;

        // maby error
        const imageUrl = `/upload/${req.file.filename}`;

        await pool.query(
            'UPDATE kitchens SET image_url = ? WHERE id = ?',
            [imageUrl, kitchen.id]
        );

        return res.status(200).json({
            status: 'success',
            message: 'تم رفع الصورة بنجاح',
            data: {
                image_url: imageUrl
            },
        });
}


module.exports = {
    getKitchenById_controller,
    getKitchens_controller,
    createKitchen_controller,
    deleteKitchen_controller,
    updateMyKitchen_controller,
    uploadKitchenImage_controller,
    Mykitchens_controller,
    getKitchenById_middleware
};