const router=require("express").Router();
const {
    about_render,
    content_render,
    fqs_render,
    getLandingPage_render
}=require("../rendering/home");
const catchError=require('../utiles/catchError');

router.get('',catchError(getLandingPage_render)); //static & dynamic (optional)
router.get('/about',catchError(about_render));//static
router.get('/faqs',catchError(fqs_render));//static
router.get('/contect-us',catchError(content_render));//static

module.exports=router;

/**
 * renders
 * GET /  show home page (optional) and top dishes but with paid for 3 days
 * GET /about  show about page
 * GET /contact  show contact page 
 * GET /faq  show faq page
 * 
 */