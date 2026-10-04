/**
 * Security middleware suite for DOQ.
 * Provides: security headers, CSRF token issuance/validation, and request rate limiting.
 */
const crypto = require('crypto');

// In-memory rate limit buckets (key -> {startedAt, count})
const buckets = new Map();
const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Generates an HMAC-SHA256 signature for CSRF tokens.
 * @param {string} seed - Per-session CSRF seed from cookie.
 * @param {string} [session=''] - Session token for binding (optional).
 * @returns {string} Hex-encoded HMAC.
 */
const signature = (seed, session = '') => crypto.createHmac('sha256', process.env.JWT_SECRET).update(seed + ':' + session).digest('hex');

/**
 * Sets security-related HTTP headers on every response.
 * Headers: X-Content-Type-Options, X-Frame-Options, Referrer-Policy,
 * Permissions-Policy, Content-Security-Policy, HSTS (production only), Cache-Control.
 * @param {Object} req - Express request.
 * @param {Object} res - Express response.
 * @param {Function} next - Next middleware.
 */
function securityHeaders(req, res, next) {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'DENY');
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.set('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com; img-src 'self' data: https:; connect-src 'self'; frame-src https://accept.paymob.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'");
  if (process.env.NODE_ENV === 'production') {
    res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  res.set('Cache-Control', 'no-store');
  next();
}

/**
 * Issues a per-session CSRF seed cookie and attaches a csrfToken() function to req.
 * The seed is a 32-byte random value stored in an httpOnly cookie (doq_csrf_seed).
 * @param {Object} req - Express request; reads req.cookies.doq_csrf_seed.
 * @param {Object} res - Express response; sets doq_csrf_seed cookie if missing/invalid.
 * @param {Function} next - Next middleware.
 */
function issueCsrfCookie(req, res, next) {
  let seed = req.cookies?.doq_csrf_seed;
  if (!/^[a-f0-9]{64}$/.test(seed || '')) {
    seed = crypto.randomBytes(32).toString('hex');
    res.cookie('doq_csrf_seed', seed, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 86400000
    });
  }
  // Attach a function that returns the HMAC-bound token for this session
  req.csrfToken = () => signature(seed, req.cookies?.session_token);
  next();
}

/**
 * Validates CSRF token on state-changing requests (non-GET/HEAD/OPTIONS).
 * Skips validation for /payment/webhook (external webhook endpoint).
 * Expects token in x-csrf-token header or _csrf body field.
 * Uses timing-safe comparison to prevent timing attacks.
 * @param {Object} req - Express request; reads cookies and body/header.
 * @param {Object} res - Express response.
 * @param {Function} next - Next middleware (called on valid token).
 */
function csrfProtection(req, res, next) {
  if (safeMethods.has(req.method) || req.path === '/payment/webhook') return next();

  const seed = req.cookies?.doq_csrf_seed;
  const supplied = req.get('x-csrf-token') || req.body?._csrf;
  const expected = seed && signature(seed, req.cookies?.session_token);

  if (typeof supplied !== 'string' || !/^[a-f0-9]{64}$/.test(supplied) || !expected || !crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) {
    return res.status(403).json({ status: 'error', code: 'CSRF_INVALID', message: 'رمز الحماية انتهى أو غير صالح' });
  }
  next();
}

/**
 * Simple in-memory rate limiter with separate buckets for auth and general endpoints.
 * - Auth endpoints (POST/PUT/PATCH/DELETE to /auth/): 15 req/min per IP.
 * - General endpoints: 240 req/min per IP.
 * - Bucket cleanup runs when map exceeds 10k entries.
 * - Hard cap: 20k unique IP:bucket keys.
 * @param {Object} req - Express request; uses req.ip or socket address.
 * @param {Object} res - Express response; sets Retry-After on 429.
 * @param {Function} next - Next middleware.
 */
function requestRateLimit(req, res, next) {
  const now = Date.now();
  const windowMs = 60000;

  // Periodic cleanup of expired buckets
  if (buckets.size > 10000) {
    for (const [key, entry] of buckets) {
      if (now - entry.startedAt >= windowMs) buckets.delete(key);
    }
  }

  const sensitive = req.path.startsWith('/auth') && !safeMethods.has(req.method);
  const key = String(req.ip || req.socket.remoteAddress) + ':' + (sensitive ? 'auth' : 'general');

  let entry = buckets.get(key);
  if (!entry || now - entry.startedAt >= windowMs) {
    // Hard cap to prevent memory exhaustion
    if (buckets.size >= 20000 && !entry) {
      return res.status(429).json({ message: 'حاول مرة تانية بعد دقيقة' });
    }
    entry = { startedAt: now, count: 0 };
    buckets.set(key, entry);
  }

  if (++entry.count > (sensitive ? 15 : 240)) {
    res.set('Retry-After', '60');
    return res.status(429).json({ message: 'محاولات كتير في وقت قصير. حاول بعد دقيقة' });
  }
  next();
}

module.exports = { securityHeaders, issueCsrfCookie, csrfProtection, requestRateLimit };