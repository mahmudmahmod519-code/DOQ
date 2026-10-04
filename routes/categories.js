const router=require("express").Router();
const roles=require("../middlware/roles");
const auth=require("../middlware/auth");
const allRows=require("../middlware/allRows");
const {
    createCategory_controller,
    getAllCategories_controller,
    getCategory_controller,
    updateCategory_controller,
    deleteCategory_controller,
    getCategoriesWithCount_controller
}=require("../controller/category");

const {catgories_render}=require("../rendering/category");

const catchError=require("../utiles/catchError");


// Customers and guests need this read-only list for the public dish filters.
// Keep it before the admin-only router guard.
router.get('/api/v1/all', auth.optional, catchError(getCategoriesWithCount_controller));

router.use(auth);


router.use(roles('admin'));


//render page catgories to show it admin
// all categories only admin
router.get('/', catchError(catgories_render));


router.get('/api/v1',allRows('category'),catchError(getAllCategories_controller));

// create category
router.post('/api/v1', catchError(createCategory_controller));

// update any catgory
router.put('/api/v1/:id', catchError(updateCategory_controller));

//delete category
router.delete('/api/v1/:id', catchError(deleteCategory_controller));

//get spcific catgory information
router.get('/api/v1/:id', catchError(getCategory_controller));

router.get('/api/v1/stats/count', catchError(getCategoriesWithCount_controller));




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
