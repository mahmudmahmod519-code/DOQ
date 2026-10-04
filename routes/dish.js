const catchError = require("../utiles/catchError");
const upload=require('../middlware/upload');
const for_main=require('../middlware/for_main');
const allRows = require("../middlware/allRows");
const roles=require('../middlware/roles');
const auth=require('../middlware/auth');
const isOwner=require('../middlware/isOwner');
const pool = require("../database/pool");


const { 
    SpecificDish_render, 
    Dishes_render,
    // SpcificMyDish_render
}=require("../rendering/dishes");


const { checkSubscription } = require("../controller/payment");

const { 
    dish_get_id,
    createDish_controller,
    getAllDishes_controller,
    getDish_controller,
    // getMyDishes_controller,
    getMyDishesPaginated_controller,
    getMySpcificDish_controller,
    getAllDieshesForSpecificKitchenForChef_controller,
    deleteDish_controller,
    updateDish_controller,
    uploadDishImage_controller,
    getAllDishesAdmin_controller
} = require("../controller/dishes");


const router=require("express").Router();



router.use(auth.optional);


// render page for dishes dashboard for (admin,customer,chef)=>as kitchen /
router.get('/',catchError(Dishes_render));//done


// render page for dish specific dish /:id
router.get('/:id',dish_get_id,catchError(SpecificDish_render));//done

// router.get('/chef/:id',roles('admin','chef'),dish_get_id,catchError(SpcificMyDish_render));

//apis

//show all dishes in this catgory
router.get('/v1/api/category/:id',roles('admin','customer'),allRows("dish","category"),catchError(getAllDishes_controller));//done

router.get('/v1/api/kitchen/:id',roles('admin','customer'),allRows("dish","kitchen"),catchError(getAllDishes_controller));//done

router.get('/v1/api/dashboard',roles('admin'),catchError(getAllDishesAdmin_controller));//done

router.get('/v1/api/my',roles('chef'),for_main('kitchen',true,false),catchError(getMyDishesPaginated_controller));//done

router.get('/v1/api/:id',roles('admin','customer'),dish_get_id,catchError(getDish_controller));//done

router.get('/v1/api/',allRows("dish"),catchError(getAllDishes_controller)); //done

router.get('/v1/api/my/:id',roles('chef'),isOwner('dish'),for_main('dish'),catchError(getMySpcificDish_controller));//done

//if chef have more than kitchen and chef is primary subscriber
router.get('/v1/api/kitchen/:id/my',roles('chef'),isOwner('kitchen'),allRows("dish","kitchen"),catchError(getAllDieshesForSpecificKitchenForChef_controller));//done


router.put('/v1/api/:id',roles('chef'),checkSubscription,isOwner('dish'),catchError(updateDish_controller));//done
    //check id validation
    //get data of body and validate it
    //check if dish is found
    //update data
    //return successfuly message

router.post('/v1/api/:id/upload_image',roles('chef'),checkSubscription,isOwner('dish'),upload.single('image'),catchError(uploadDishImage_controller));//done
    // get id and validate it
    //check if dish is found
    //check image file is found
    //update image path in database
    //add image path to dish data in database
    //return successfuly message    

//if primary must be spcify kitchen in body
router.post('/v1/api/',roles('chef'),checkSubscription,catchError(createDish_controller));//done
    //get data of body and validate it
    //check if chef have kitchen
    // if have more kitchen and chef is primary subscriber must be specify kitchen in body
    // check kitchen id in body and validate it and check kitchen id === kichen from kitchens chef have it or not
    // store kitchen in var to can use it in next step
    //check if data is found in dish again in the same kitchen
    //if found return message error
    //insert data in database with relations 
    //return successfuly message


router.delete('/v1/api/:id',roles('admin'),catchError(deleteDish_controller));//done
    //get id and validate it
    //check if dish is found
    //delete data from database
    //return successfuly message


router.delete('/v1/api/my/:id',roles('chef'),checkSubscription,isOwner('dish'),catchError(deleteDish_controller));//done
    //get id and validate it
    //check if dish is found
    //delete data from database
    //return successfuly message


module.exports=router;
/**
 * renders
 * /dish/:id *
 * /dish/dashboard admin
 * /dish/my chef
 * 
 * functions
 * GET / * filter dishes and get all
 * GET /:id (customer,admin) get specific dish
 * GET /kitchen/:id (customer,admin) get all dishes for kitchen
 * GET /category/:id (customer,admin) get all dishes for category
 * GET /my/:id (chef) get specific dish for chef
 * GET /my (chef) get all dishes for chef
 * GET /kitchen/:id/my (chef) get all dishes for specific kitchen for chef
 * PUT /:id chef isOwner
 * POST /upload_image chef
 * POST / chef
 * DELETE /:id admin
 * DELETE /my/:id chef isOwner
 */