const isAuthenticated=require('../utiles/isAuthenticated');

async function auth_render(req,res){

    const user=await isAuthenticated(req, res);

    res.render("./auth/auth",{currentUser: user || null});
}

function forgetPassword_render(req,res){
    res.render("./auth/forgetpassword");
}

function resetPassword_render(req,res){
const {password_hash,id,...currentUser}=req.my
    res.render("./auth/resetpassword",{currentUser});
}






module.exports={
    auth_render,
    forgetPassword_render,
    resetPassword_render
}