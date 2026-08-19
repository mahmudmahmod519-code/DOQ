const router=require("express").Router();
const roles=require("../middlware/roles");
const auth=require("../middlware/auth");
const allRows=require("../middlware/allRows");
const for_main=require("../middlware/for_main");
const {
    createCategory_controller,
    getAllCategories_controller,
    getCategory_controller,
    updateCategory_controller,
    deleteCategory_controller,
    getCategoriesWithCount_controller
}=require("../controller/category");
const {catgories_render}=require("../rendering/category");
const catchError=require("../utiles/catchError")


router.use(auth);


router.get('/all', catchError(getCategoriesWithCount_controller));


router.use(roles('admin'));


//render page catgories to show it admin
// all categories only admin
router.get('/dashboard',for_main('user'), allRows('category'), catchError(catgories_render));


router.get('/',for_main('user'),allRows('category'),catchError(getAllCategories_controller));

// create category
router.post('/', catchError(createCategory_controller));

// update any catgory
router.put('/:id', catchError(updateCategory_controller));

//delete category
router.delete('/:id', catchError(deleteCategory_controller));

//get spcific catgory information
router.get('/:id', catchError(getCategory_controller));

router.get('/stats/count', catchError(getCategoriesWithCount_controller));




module.exports=router;

/**
 * render
 * /categories admin
 * 
 * functions
 * GET /categories customer,admin,chef
 * POST /categories admin
 * PUT /categories/:id admin
 * DELETE /categories/:id admin
 * GET /categories/:id admin
 * 
 *  * ============================================
 * ملخص الـ Routes:
 * ============================================
 * GET    /categories/dashboard   → Render صفحة إدارة التصنيفات (Admin)
 * GET    /categories             → جلب جميع التصنيفات (Admin)
 * GET    /categories/:id         → جلب تصنيف معين (Admin)
 * GET    /categories/stats/count → جلب التصنيفات مع عدد الأطباق (Admin)
 * POST   /categories             → إنشاء تصنيف جديد (Admin)
 * PUT    /categories/:id         → تحديث تصنيف (Admin)
 * DELETE /categories/:id         → حذف تصنيف (Admin)
 * 
 */