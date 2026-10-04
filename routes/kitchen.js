/**
 * Kitchen routes (mounted at /kitchens).
 * Provides: public kitchen listings, chef kitchen management, admin kitchen management,
 * image uploads, city listing, and page rendering.
 */
const router = require("express").Router();
const auth = require("../middlware/auth");
const roles = require("../middlware/roles");
const upload = require("../middlware/upload");
const catchError = require("../utiles/catchError");
const allRows = require("../middlware/allRows");
const for_main = require("../middlware/for_main");

const {
    createKitchen_controller,
    deleteKitchen_controller,
    getKitchenById_controller,
    updateMyKitchen_controller,
    getKitchens_controller,
    Mykitchens_controller,
    getKitchenById_middleware,
    uploadKitchenImageBackground_controller,
    uploadKitchenImageProfile_controller,
    getKitchensPaginated_controller,
    listCities_controller
} = require("../controller/kitchen");

const {
    kitchens_render,
    myKitchen_render,
    kitchenProfile_render
} = require("../rendering/kitchen");
const { checkSubscription } = require("../controller/payment");

router.use(auth.optional);

// --- Page Routes ---

// GET /kitchens - Public kitchens listing page
router.get('/', catchError(kitchens_render));

// GET /kitchens/my - Chef's kitchen management page (chef only)
router.get('/my', roles('chef'), for_main('kitchen', true, false), catchError(myKitchen_render));

// GET /kitchens/:id - Kitchen profile page (public)
router.get('/:id', getKitchenById_middleware, catchError(kitchenProfile_render));

// --- API Routes ---

// GET /kitchens/api/v1/my - Chef's kitchens (chef only)
router.get('/api/v1/my', roles('chef'), for_main('kitchen', true, false), catchError(Mykitchens_controller));

// GET /kitchens/api/v1/paginated - Public paginated kitchens with filters
router.get('/api/v1/paginated', catchError(getKitchensPaginated_controller));

// GET /kitchens/api/v1/cities - List distinct cities for filter dropdown
router.get('/api/v1/cities', catchError(listCities_controller));

// GET /kitchens/api/v1/:id - Single kitchen (admin)
router.get('/api/v1/:id', roles('admin'), catchError(getKitchenById_controller));

// GET /kitchens/api/v1 - All kitchens (admin)
router.get('/api/v1', roles('admin'), catchError(getKitchens_controller));

// POST /kitchens/api/v1/ - Create kitchen (chef, one per chef)
router.post("/api/v1/create", roles('chef'), catchError(createKitchen_controller));

// DELETE /kitchens/api/v1/:id - Delete kitchen (admin)
router.delete("/api/v1/:id", roles('admin'), catchError(deleteKitchen_controller));

// POST /kitchens/api/v1/my/background - Upload background image (chef, subscription)
router.post("/api/v1/my/background", roles('chef'), checkSubscription, for_main('kitchen'), upload.single('background'), catchError(uploadKitchenImageBackground_controller));

// POST /kitchens/api/v1/my/profile - Upload profile image (chef, subscription)
router.post("/api/v1/my/profile", roles('chef'), checkSubscription, for_main('kitchen'), upload.single('profile'), catchError(uploadKitchenImageProfile_controller));

// PUT /kitchens/api/v1/my - Update kitchen (chef, subscription)
router.put("/api/v1/my", roles('chef'), checkSubscription, for_main('kitchen'), catchError(updateMyKitchen_controller));

module.exports = router;