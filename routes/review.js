const router=require("express").Router();
const catchError = require("../utiles/catchError");
const allRows = require("../middlware/allRows");
const for_main = require("../middlware/for_main");
const auth = require("../middlware/auth");
const roles = require("../middlware/roles");


const { 
    getAllReviewsForKitchen_controller,
    getAllReviewsForDish_controller,
    getChefReviews_controller
 } = require("../controller/reviews");

const { 
    reviews_render,
    reviewsDashboard_render
} = require("../rendering/reviews");


router.use(auth,for_main('user',true,false),(req,res,next)=>{
    req.user=req.my;
    next()
});//done

//if chef render page if admin render author page
//all reviews for admin render page only
router.get('/dashboard',roles('admin','chef'),catchError(reviewsDashboard_render));



// this page render it to spcific dish or kitchen only 
// use /v1/api/dish/:id to get all reviews for this dish
// use /v1/api/kitchen/:id to get all reviews for this kitchen
// render page reviews for this dish
// have query type=dish or kitchen 
//render only page reviews but will use dish/:id or kitchen/:id from browser base on type product 
router.get('/reviews',roles('customer'),catchError(reviews_render));


//controller

//get all reviews for my kitchens accept req.query dish_id and kitchen_id
router.get('/v1/api/chef/dashboard',roles('chef'),catchError(getChefReviews_controller));

// ============================================
// جلب جميع تقييمات مطبخ معين - GET /reviews/kitchen/:id
// ============================================
router.get('/v1/api/kitchen/:id', catchError(getAllReviewsForKitchen_controller));

// ============================================
// جلب جميع تقييمات طبق معين - GET /reviews/dish/:id
// ============================================
router.get('/v1/api/dish/:id', catchError(getAllReviewsForDish_controller));


//my reviews customer with dishe_id as req.query to get all my reviews and review for spcific dish
router.get('/v1/api/my',roles('customer'),catchError());

//get all reviews with pageination
router.get('/v1/api/',roles('admin'),allRows('review'),catchError());

//dish id
//check if i have comment or not
router.post('/v1/api/:id',roles('customer'),catchError());

//review id
//check my review before delete it if customer 
//my reviews customer with dishe_id as req.query to get all my reviews and review for spcific dish
router.put('/v1/api/:id',roles('customer','admin'),catchError());

//review id
//check my review before delete it if customer 
router.delete('/v1/api/:id',roles('customer','admin'),catchError());



module.exports=router;

/**
 * render
 * /:dishid/page_review customer
 * /dashboard admin,chef
 * 
 * functions
 * get /:dishid/review customer,admin,chef
 * get /v1/api/chef/dashboard chef
 * POST /v1/api/:id customer,admin
 * PUT /v1/api/:id customer,admin
 * DELETE /v1/api/:id admin,customer my reviews
 * 
 * 
 */




// AllRows(review,dish) //get all review for this dish
// AllRows(review) //get all review
