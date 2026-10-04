/**
 * Category routes (mounted at /categories).
 * Admin-only management of dish categories with public read endpoint.
 */
const router = require("express").Router();
const roles = require("../middlware/roles");
const auth = require("../middlware/auth");
const allRows = require("../middlware/allRows");
const catchError = require("../utiles/catchError");

const {
    createCategory_controller,
    getAllCategories_controller,
    getCategory_controller,
    updateCategory_controller,
    deleteCategory_controller,
    getCategoriesWithCount_controller
} = require("../controller/category");

const { catgories_render } = require("../rendering/category");

// --- Public Read Endpoint (no admin role required) ---
// GET /categories/api/v1/all - All categories with dish counts (for public filters)
router.get('/api/v1/all', auth.optional, catchError(getCategoriesWithCount_controller));

// --- Admin Routes ---
router.use(auth);
router.use(roles('admin'));

// GET /categories - Render admin categories management page
router.get('/', catchError(catgories_render));

// GET /categories/api/v1 - Paginated list of categories (admin)
router.get('/api/v1', allRows('category'), catchError(getAllCategories_controller));

// POST /categories/api/v1 - Create new category (admin)
router.post('/api/v1', catchError(createCategory_controller));

// PUT /categories/api/v1/:id - Update category (admin)
router.put('/api/v1/:id', catchError(updateCategory_controller));

// DELETE /categories/api/v1/:id - Delete category (admin)
router.delete('/api/v1/:id', catchError(deleteCategory_controller));

// GET /categories/api/v1/:id - Get specific category (admin)
router.get('/api/v1/:id', catchError(getCategory_controller));

// GET /categories/api/v1/stats/count - Categories with dish counts (admin)
router.get('/api/v1/stats/count', catchError(getCategoriesWithCount_controller));

module.exports = router;