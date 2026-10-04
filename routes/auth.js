const router=require("express").Router();
const auth=require("../middlware/auth");
const catchError=require('../utiles/catchError');

const {
    auth_render,
    forgetPassword_render,
    resetPassword_render,
    authSignUp2_render
}=require("../rendering/auth");

const { 
    signIn_controller,
    forgetPassword_controller,
    logout_controller,
    resetPassword_controller,
    signUp_controller,
    signUp2_verify_controller,
    generateSecretKey_controller,
    change2fa_controller,
    recover_controller
 } = require("../controller/auth");
const for_main = require("../middlware/for_main");


// rendering

router.get("/",auth_render);

router.get("/signup2",authSignUp2_render);



router.get("/forgetpassword",forgetPassword_render);

router.get('/resetpassword',auth,resetPassword_render)




//controllers
router.post('/generate-secret', catchError(generateSecretKey_controller));


router.post("/signin",catchError(signIn_controller));

router.post("/signup",catchError(signUp_controller));

router.post('/signup2', catchError(signUp2_verify_controller)); // ✅ مسار التحقق من OTP

router.post("/logout",catchError(logout_controller));


//page add code and password and mail and confirme password
router.post("/forgetpassword",catchError(forgetPassword_controller));


router.post("/resetpassword",auth,catchError(resetPassword_controller));



router.get('/recovery', (req,res) => res.render('auth/recovery', { token: String(req.query.token || '') }));
router.post('/recovery', catchError(recover_controller));
router.get('/2fa',auth,(req,res)=>res.render('auth/2fa',{currentUser:req.user}));
router.post('/2fa', auth, catchError(change2fa_controller));
module.exports=router;