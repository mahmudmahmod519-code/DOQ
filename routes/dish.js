/**
 * Dish routes (mounted at /dishes).
 * Provides: public dish listings, chef dish management, admin dish management,
 * image uploads, and page rendering.
 */
const catchError = require("../utiles/catchError");
const upload = require('../middlware/upload');
const for_main = require('../middlware/for_main');
const allRows = require("../middlware/allRows");
const roles = require('../middlware/roles');
const auth = require('../middlware/auth');
const isOwner = require('../middlware/isOwner');

const {
    SpecificDish_render,
    Dishes_render
} = require("../rendering/dishes");

const { checkSubscription } = require("../controller/payment");

const {
    dish_get_id,
    createDish_controller,
    getAllDishes_controller,
    getDish_controller,
    getMyDishesPaginated_controller,
    getMySpcificDish_controller,
    getAllDieshesForSpecificKitchenForChef_controller,
    deleteDish_controller,
    updateDish_controller,
    uploadDishImage_controller,
    getAllDishesAdmin_controller
} = require("../controller/dishes");

const router = require("express").Router();

// Optional auth for public pages
router.use(auth.optional);

// --- Page Routes ---

// GET /dishes - Dishes dashboard page (admin/customer/chef)
router.get('/', catchError(Dishes_render));

// GET /dishes/:id - Single dish detail page
router.get('/:id', dish_get_id, catchError(SpecificDish_render));

// --- API Routes ---

// GET /dishes/v1/api/category/:id - Dishes by category (admin, customer)
router.get('/v1/api/category/:id', roles('admin', 'customer'), allRows("dish", "category"), catchError(getAllDishes_controller));

// GET /dishes/v1/api/kitchen/:id - Dishes by kitchen (admin, customer)
router.get('/v1/api/kitchen/:id', roles('admin', 'customer'), allRows("dish", "kitchen"), catchError(getAllDishes_controller));

// GET /dishes/v1/api/dashboard - All dishes paginated (admin)
router.get('/v1/api/dashboard', roles('admin'), catchError(getAllDishesAdmin_controller));

// GET /dishes/v1/api/my - Chef's dishes paginated (chef, requires kitchen)
router.get('/v1/api/my', roles('chef'), for_main('kitchen', true, false), catchError(getMyDishesPaginated_controller));

// GET /dishes/v1/api/:id - Single dish (admin, customer)
router.get('/v1/api/:id', roles('admin', 'customer'), dish_get_id, catchError(getDish_controller));

// GET /dishes/v1/api/ - All dishes paginated (public)
router.get('/v1/api/', allRows("dish"), catchError(getAllDishes_controller));

// GET /dishes/v1/api/my/:id - Chef's specific dish (chef, owner)
router.get('/v1/api/my/:id', roles('chef'), isOwner('dish'), for_main('dish'), catchError(getMySpcificDish_controller));

// GET /dishes/v1/api/kitchen/:id/my - Chef's dishes for specific kitchen (chef, kitchen owner)
router.get('/v1/api/kitchen/:id/my', roles('chef'), isOwner('kitchen'), allRows("dish", "kitchen"), catchError(getAllDieshesForSpecificKitchenForChef_controller));

// PUT /dishes/v1/api/:id - Update dish (chef, owner, subscription required)
router.put('/v1/api/:id', roles('chef'), checkSubscription, isOwner('dish'), catchError(updateDish_controller));

// POST /dishes/v1/api/:id/upload_image - Upload dish image (chef, owner, subscription)
router.post('/v1/api/:id/upload_image', roles('chef'), checkSubscription, isOwner('dish'), upload.single('image'), catchError(uploadDishImage_controller));

// POST /dishes/v1/api/ - Create dish (chef, subscription required)
router.post('/v1/api/', roles('chef'), checkSubscription, catchError(createDish_controller));

// DELETE /dishes/v1/api/:id - Delete dish (admin)
router.delete('/v1/api/:id', roles('admin'), catchError(deleteDish_controller));

// DELETE /dishes/v1/api/my/:id - Delete own dish (chef, owner, subscription)
router.delete('/v1/api/my/:id', roles('chef'), checkSubscription, isOwner('dish'), catchError(deleteDish_controller));

module.exports = router;