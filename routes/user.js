const router=require("express").Router();
const roles=require('../middlware/roles');
const for_main=require('../middlware/for_main');
const allRows=require('../middlware/allRows');
const auth=require('../middlware/auth');
const upload = require("../middlware/upload");
const catchError=require('../utiles/catchError');

const { getChefOrders_controller } = require('../controller/orders');

const {
    deleteUser_controller,
    changePortfolio_controller,
    getSpcificUser_controller,
    getUnifiedChefDashboard,
    uploadImageProfile_controller,
    createUser_controller
}=require("../controller/user");

const {
    portfolio_render,
    dashboard_render,
    setting_render,
    users_render
}=require("../rendering/user");

router.use(auth);


//render my portfolio can update data in the same page
//don't add api return my portfolio will use middleware in the same render
// isOwner
router.get('/profile',for_main('review',true,true),catchError(portfolio_render));

//update in it
router.get('/orders',roles('chef'),(req,res)=>res.render('./chef/orders',{...require('../utiles/checkLogin')(req,res),pageTitle:'طلبات المطبخ | دوق'}));
router.get('/orders/api',roles('chef'),catchError(getChefOrders_controller));

router.get('/dashboard',roles('chef','admin'),
// getUnifiedChefDashboard,
catchError(dashboard_render));

router.get('/',roles('admin'),catchError(users_render))

router.get('/settings',catchError(setting_render))

router.post('/api/v1', roles('admin'), catchError(createUser_controller));

router.delete('/api/v1/:id',roles('admin'),catchError(deleteUser_controller));

//change data if admin and if any user
router.put('/api/v1/',catchError(changePortfolio_controller));

router.put('/api/v1/:id',roles('admin'),catchError(changePortfolio_controller));

router.get('/api/v1/:id',roles('admin'),catchError(getSpcificUser_controller));

router.post("/api/v1/my/profile",upload.single('profile'),catchError(uploadImageProfile_controller));//done


module.exports=router;

/**
 * renders
 *  GET /user/dashboard  admin not yet
 *  GET /user/dashboard/users  admin done
 *  GET /user/dashboard/categories  admin not yet
 *  GET /user/dashboard/kitchens  admin not yet
 *  GET /user/dashboard/Reviews  admin not yet
 *  GET /user/dashboard/dishes  admin not yet
 *  GET /portfolio  * -> controller = GET /myaccount *
 *  
 * functions
 * DELETE /user   admin
 * PUT /portfolio and update all users *
 * GET /user/:id  admin
 */