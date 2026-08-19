const checker=require('../utiles/checker');
const {
    idParamSchema,
    userUpdateSchema
}=require('../utiles/validation');
const pool = require("../database/pool");



async function deleteUser_controller(req,res){

    const {id}=checker(idParamSchema,req.params,res);

    const [user]=await pool.query(`SELECT * FROM users WHERE id=?`,[id]);
    if(user.length===0)return res.status(404).json({message:"this account not here",status:"error"});

    await pool.query(`DELETE FROM users WHERE id=?`,[id]);

    return res.status(200).json({message: "تم حذف الحساب بنجاح",status:"successful"});
}

async function changePortfolio_controller(req,res){

    
    const isAdminUser = req.my.roles === 'admin';
    const targetUserId = (req.params.id && isAdminUser) ? req.params.id : req.my.id;

    if (req.params.id && !isAdminUser) {
        return res.status(403).json({
            status: 'error',
            message: 'غير مسموح لك بتعديل بيانات مستخدمين آخرين'
        });
    }

    const validatedData=checker(userUpdateSchema,req.body,res);
    const first_name = validatedData.first_name || req.my.first_name;
    const last_name = validatedData.last_name || req.my.last_name;
    const phone_number = validatedData.phone_number || req.my.phone_number;
    const roles = validatedData.roles || req.my.roles;
    
    if (validatedData.phone_number) {
        const [userFound]=await pool.query(`SELECT * FROM users WHERE phone_number=? AND id <> ?`,[phone_number,targetUserId]);
    
        if (userFound.length > 0) 
            return res.status(409).json({ message: "رقم الهاتف مستخدم بالفعل من قبل حساب آخر", status: 'error' });
    }


    if (!isAdminUser && validatedData.roles && validatedData.roles !== req.my.roles)
        return res.status(403).json({ status: 'error', message: 'غير مسموح لك بتعديل صلاحياتك' });
    
    await pool.query(`
        UPDATE users 
        SET first_name=?,last_name=?,phone_number=?,roles=? 
        WHERE id=?
        `,[first_name,last_name,phone_number,roles,targetUserId]);

    return res.status(200).json({
            status: 'success',
            message: 'تم تحديث البيانات بنجاح'
        });
}

async function getSpcificUser_controller(req,res){
    const {id}=checker(idParamSchema,req.params,res);
    
    const [users] = await pool.query(
        `SELECT id, first_name, last_name, phone_number, email, code, roles, created_at FROM users WHERE id = ?`, 
        [id]
    );

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


module.exports={
    deleteUser_controller,
    changePortfolio_controller,
    getSpcificUser_controller
};