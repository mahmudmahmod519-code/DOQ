const checkLogin = require('../utiles/checkLogin');

async function auth_render(req,res){    
    res.render("./auth/auth",checkLogin(req,res));
}

async function authSignUp2_render(req, res) { 
    // 1. فحص التوكن من الـ Cookies (للويب) أو من الـ Authorization Header (للموبايل/API)
    let pendingToken = req.cookies?.pending_token;

    if (!pendingToken && req.headers.authorization) {
        const parts = req.headers.authorization.split(" ");
        if (parts[0] === "Bearer") pendingToken = parts[1];
    }

    // 2. لو مفيش توكن، رجعه لصفحة تسجيل الدخول
    if (!pendingToken) {
        return res.redirect('/auth');
    }

    // 3. (اختياري ولكن أفضل أمنياً) فحص صحة الـ Token
    try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(pendingToken, process.env.JWT_SECRET);
        if (decoded.type !== 'pending_2fa') {
            return res.redirect('/auth');
        }
    } catch (err) {
        // لو التوكن منتهي الصلاحية أو مش متفبرك
        return res.redirect('/auth');
    }

    // 4. رندر الصفحة بنجاح
    res.render('./auth/signup2', checkLogin(req, res));
}

function forgetPassword_render(req,res){
    res.render("./auth/forgetpassword",checkLogin(req,res));
}

function resetPassword_render(req,res){
    res.render("./auth/resetpassword",checkLogin(req,res));
}






module.exports={
    auth_render,
    forgetPassword_render,
    resetPassword_render,
    authSignUp2_render
}