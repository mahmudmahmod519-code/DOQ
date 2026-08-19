const router=require("express").Router();
const auth=require("../middlware/auth");
const catchError=require('../utiles/catchError');

const {
    auth_render,
    forgetPassword_render,
    resetPassword_render
}=require("../rendering/auth");

const { 
    signIn_controller,
    forgetPassword_controller,
    logout_controller,
    resetPassword_controller,
    signUp_controller
 } = require("../controller/auth");
const for_main = require("../middlware/for_main");


// rendering

router.get("/",auth_render);

router.get("/forgetpassword",forgetPassword_render);

router.get('/resetpassword',auth,for_main('user'),resetPassword_render)




//controllers

router.post("/signin",catchError(signIn_controller));


router.post("/signup",catchError(signUp_controller));

router.get("/logout",catchError(logout_controller));


//page add code and password and mail and confirme password
router.post("/forgetpassword",catchError(forgetPassword_controller));


router.post("/resetpassword",auth,for_main('user'),catchError(resetPassword_controller));



module.exports=router;