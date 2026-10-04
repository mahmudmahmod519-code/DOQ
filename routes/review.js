/**
 * Review routes (mounted at /reviews).
 * Provides: public review listings, chef review dashboard, admin review dashboard,
 * customer review management, and page rendering.
 */
const router = require("express").Router();
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
    myReviews_render
} = require("../rendering/reviews");

router.use(auth.optional);

// --- Page Routes ---

// GET /reviews - Reviews page (dish/kitchen reviews with type/id query)
router.get('/', catchError(reviews_render));

// GET /reviews/my-reviews - Customer's reviews page (customer)
router.get('/my-reviews', roles('customer'), catchError(myReviews_render));

// --- API Routes ---

// GET /reviews/v1/api/list - All reviews with pagination/filters (customer, admin)
// Query: type=dish|kitchen, id, page, limit, q, rating, sort_order, city, category
router.get('/v1/api/list', roles('customer', 'admin'), catchError(getReviewsList_controller));

// GET /reviews/v1/api/dashboard - Admin reviews dashboard with stats (admin)
router.get('/v1/api/dashboard', roles('admin'), allRows('review'), catchError(getAllReviewsDashboard_controller));

// GET /reviews/v1/api/my - Customer's reviews with optional dish filter (customer)
router.get('/v1/api/my', roles('customer'), catchError(getAllReviewsOnMyreviewOnDish_controller));

// GET /reviews/v1/api/chef - Chef's reviews with stats/top dishes (chef)
router.get('/v1/api/chef', roles('chef'), catchError(getChefReviews_controller));

// GET /reviews/v1/api/:id - Single dish reviews with summary (admin, customer)
router.get('/v1/api/:id', roles('admin', 'customer'), catchError(getAllReviewsForDish_controller));

// POST /reviews/v1/api - Create review (customer)
router.post('/v1/api', roles('customer'), catchError(addReviewOnDish_controller));

// PATCH /reviews/v1/api/:id - Update review (customer, admin)
router.patch('/v1/api/:id', roles('customer', 'admin'), catchError(updateReviewOnDish_controller));

// DELETE /reviews/v1/api/:id - Delete review (customer, admin)
router.delete('/v1/api/:id', roles('customer', 'admin'), catchError(deleteReview_controller));

module.exports = router;