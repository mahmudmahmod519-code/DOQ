const router=require("express").Router();
const catchError = require("../utiles/catchError");
const allRows = require("../middlware/allRows");
const auth = require("../middlware/auth");
const roles = require("../middlware/roles");


const { 
    getReviewsList_controller,
    getChefReviews_controller,
    getAllReviewsDashboard_controller,
    getAllReviewsOnMyreviewOnDish_controller,
    addReviewOnDish_controller,
    updateReviewOnDish_controller,
    deleteReview_controller,
    getAllReviewsForDish_controller
 } = require("../controller/reviews");

const { 
    reviews_render,
    // reviewsDashboard_render,
    myReviews_render
} = require("../rendering/reviews");


router.use(auth.optional);



// this page render it to spcific dish or kitchen only
// render page reviews for this dish
// have query type=dish or kitchen 
//render only page reviews but will use type=kitchen and dish to get review it

//if chef render page if admin render author page
//all reviews for admin render page only
router.get('/',catchError(reviews_render));//done

 
router.get('/my-reviews', roles('customer'), catchError(myReviews_render));//done

//controller

// ============================================
// جلب جميع التقييمات مع pageination وفلتر وبحث وكل حاجة وكمان req.query.type=kitchen query.id=رقم المطبخ عشان يجيب تقييمات مطبخ معين
// req.query.type=dish id=رقم الطبق عشان يجيب لي كل التقييمات الى معموله على الطبق دة بس
// ============================================
//the joker can use it in all things
router.get('/v1/api/list',roles('customer','admin'), catchError(getReviewsList_controller));//done

//get all reviews to admin in dashboard
router.get('/v1/api/dashboard',roles('admin')
,allRows('review')
,catchError(getAllReviewsDashboard_controller));//done


//my reviews customer with dishe_id as req.query to get all my reviews and review for spcific dish
router.get('/v1/api/my',roles('customer'),catchError(getAllReviewsOnMyreviewOnDish_controller)); //done



//get all reviews for my kitchens accept req.query dish_id and kitchen_id
router.get('/v1/api/chef',roles('chef'),catchError(getChefReviews_controller));//done


router.get('/v1/api/:id',roles('admin','customer'),catchError(getAllReviewsForDish_controller));



//dish id
//check if i have comment or not
router.post('/v1/api',roles('customer'),catchError(addReviewOnDish_controller));//done


//check the api if dish_id in query don't add it as admin or customer
//review id
//check my review before delete it if customer 
//my reviews customer with dishe_id as req.query to get all my reviews and review for spcific dish
router.patch('/v1/api/:id',roles('customer','admin'),catchError(updateReviewOnDish_controller));//done

//review id
//check my review before delete it if customer 
router.delete('/v1/api/:id',roles('customer','admin'),catchError(deleteReview_controller));//done





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
 * GET /v1/api/list get all reviews with pageination and type kitchen or dish and id for dish or kitchen
 * 
 */

//

//user or admin show review for kitchen fetch /v1/api/kitchen/:id
//user go to as page reviews for all dishes and kitchens 
//user go dish and show some reviews when click on see more will show all reviews for this dish /v1/api/my req.query.id as dish_id
//chef can show his reviews page to will render the same page reviews but with req.user.role to get fetch /v1/api/chef/dashboard chef this api have all thing don't need more apis
//admin can show all reviews in dashboard and use api to show reviews count as digram in dashboard /v1/api/
//admin can go to spcific dish and click on show more reviews then go to reviews will use to fetch to get all reviews /v1/api/ , /v1/api/dish/:id and /v1/api/kitchen/:id get to spcific dish or kitchen 



//get spcific reviews by dish_id with pageination for admin 


// الapi المستخدم بيجيب كل حاجة انت عايزها لدرجه اني ممكن مستخدمش apiتاني اصلا
// page reveiws_render use one api /v1/api/list 