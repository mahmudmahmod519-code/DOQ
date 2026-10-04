/**
 * Authentication routes (mounted at /auth).
 * Provides: login/signup pages, 2FA flow, password reset, and API endpoints.
 */
const router = require("express").Router();
const auth = require("../middlware/auth");
const catchError = require('../utiles/catchError');

const {
    auth_render,
    forgetPassword_render,
    resetPassword_render,
    authSignUp2_render
} = require("../rendering/auth");

const {
    signIn_controller,
    forgetPassword_controller,
    logout_controller,
    resetPassword_controller,
    signUp_controller,
    signUp2_verify_controller,
    generateSecretKey_controller,
    change2fa_controller,
    recover_controller
} = require("../controller/auth");
const for_main = require("../middlware/for_main");

// --- Page Routes ---

// GET /auth - Login/signup page
router.get("/", auth_render);

// GET /auth/signup2 - 2FA OTP entry page
router.get("/signup2", authSignUp2_render);

// GET /auth/forgetpassword - Forgot password request page
router.get("/forgetpassword", forgetPassword_render);

// GET /auth/resetpassword - Reset password page (requires auth)
router.get('/resetpassword', auth, resetPassword_render);

// GET /auth/recovery - Password recovery page (token from email)
router.get('/recovery', (req, res) => res.render('auth/recovery', { token: String(req.query.token || '') }));

// GET /auth/2fa - 2FA management page (requires auth)
router.get('/2fa', auth, (req, res) => res.render('auth/2fa', { currentUser: req.user }));

// --- API Routes ---

// POST /auth/generate-secret - Generate TOTP secret for 2FA enrollment
router.post('/generate-secret', catchError(generateSecretKey_controller));

// POST /auth/signin - User login
router.post("/signin", catchError(signIn_controller));

// POST /auth/signup - User registration
router.post("/signup", catchError(signUp_controller));

// POST /auth/signup2 - Verify 2FA OTP during signup/enrollment
router.post('/signup2', catchError(signUp2_verify_controller));

// POST /auth/logout - User logout
router.post("/logout", catchError(logout_controller));

// POST /auth/forgetpassword - Request password reset email
router.post("/forgetpassword", catchError(forgetPassword_controller));

// POST /auth/resetpassword - Change password (requires auth)
router.post("/resetpassword", auth, catchError(resetPassword_controller));

// POST /auth/recovery - Complete password reset with token
router.post('/recovery', catchError(recover_controller));

// POST /auth/2fa - Toggle 2FA on/off (requires auth)
router.post('/2fa', auth, catchError(change2fa_controller));

module.exports = router;