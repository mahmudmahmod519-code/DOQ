const router=require("express").Router();
const roles=require('../middlware/roles');
const my_data=require('../middlware/for_main');
const allRows=require('../middlware/allRows');
const auth=require('../middlware/auth');
const catchError=require('../utiles/catchError');

const {
    deleteUser_controller,
    changePortfolio_controller,
    getSpcificUser_controller
}=require("../controller/user");

const {
    admin_render,
    portfolio_render
}=require("../rendering/user");

router.use(auth);

//render users page can delete and update data for any user in the same page
//get any user and info in the same page as form
router.get('/dashboard',roles('admin'),allRows('user'),my_data('user'),catchError(admin_render));

//render my portfolio can update data in the same page
//don't add api return my portfolio will use middleware in the same render
// isOwner
router.get('/',my_data('user'),catchError(portfolio_render));

router.delete('/:id',roles('admin'),catchError(deleteUser_controller));


//change data if admin and if any user
router.put('/',my_data('user'),catchError(changePortfolio_controller));
router.put('/:id',roles('admin'),my_data('user'),catchError(changePortfolio_controller));

router.get('/:id',roles('admin'),catchError(getSpcificUser_controller));


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