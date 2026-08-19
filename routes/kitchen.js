const router = require("express").Router();
const auth = require("../middlware/auth");
const roles = require("../middlware/roles");
const upload = require("../middlware/upload");
const catchError = require("../utiles/catchError");
const allRows = require("../middlware/allRows");
const for_main = require("../middlware/for_main");
const pool = require("../database/pool");

const {
    createKitchen_controller,
    deleteKitchen_controller,
    getKitchenById_controller,
    updateMyKitchen_controller,
    uploadKitchenImage_controller,
    getKitchens_controller,
    Mykitchens_controller,
    getKitchenById_middleware
} = require("../controller/kitchen");

const {
    kitchens_render,
    myKitchen_render,
    kitchenProfile_render
} = require("../rendering/kitchen");


router.use(auth,for_main('user'),(req,res,next)=>{
    req.user=req.my;
    next();
});


router.get('/',roles('customer','admin'),allRows('kitchen'),catchError(kitchens_render));//done

router.get('/my',roles('chef'),for_main('kitchen',true,false),catchError(myKitchen_render));//done

router.get('/:id',roles('customer','admin'),getKitchenById_middleware,catchError(kitchenProfile_render));//done

router.get('/api/v1/my',roles('chef'),for_main('kitchen'),catchError(Mykitchens_controller));

router.get('/api/v1/:id',roles('admin'),catchError(getKitchenById_controller));//done

router.get('/api/v1',roles('admin'),catchError(getKitchens_controller));//done

router.post("/api/v1/",roles('chef'),catchError(createKitchen_controller));//done

router.delete("/api/v1/:id",roles('admin'),catchError(deleteKitchen_controller));//done

router.post("/api/v1/my/upload",roles('chef'),for_main('kitchen'),upload.single('image'),catchError(uploadKitchenImage_controller));//done

router.put("/api/v1/my",roles('chef'),for_main('kitchen'),catchError(updateMyKitchen_controller));//done

module.exports = router;
    
    //render all kitchens for admin
    //render all kitchens for customer and admin
    //render spcific kitchen portfolio
    //render get mykitchen
    
    //get all kitchens
    //get spcific kitchen portfolio customer and admin
    //delete kitchen admin
    //update mykitchen chef
    //create kitchen chef one only
    //patch kitchen upload image chef
    
    
