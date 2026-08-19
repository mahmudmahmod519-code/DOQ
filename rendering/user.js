const remove_password = require("../utiles/remove_password");
const pool=require('../database/pool');

function admin_render(req,res){
    const users=remove_password(req.paginatedData);
    const {password_hash,currentUser}=req.my;
    res.render('./admin/users',{users,currentUser});   
}

async function portfolio_render(req,res){
    const [reviews]=await pool.query(`SELECT * FROM reviews WHERE user_id=?`,[req.my.id]);
    res.render('./user/portfolio',{
        user:req.my,
        reviews
    });
}


module.exports={
    admin_render,
    portfolio_render
};