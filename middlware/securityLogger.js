/**
 * Security request logger middleware.
 * Detects and logs suspicious request patterns (path traversal, SQL injection, XSS, code injection)
 * to a file and console. Does NOT block requests – only logs for audit/monitoring.
 */
const fs = require('fs');
const path = require('path');

/**
 * Express middleware that inspects request URL and body for suspicious patterns.
 * @param {Object} req - Express request.
 * @param {Object} res - Express response.
 * @param {Function} next - Next middleware (always called).
 */
module.exports = (req, res, next) => {
    const startTime = Date.now();

    // Patterns to flag as suspicious
    const suspiciousPatterns = [
        /\.\.\//,            // Path traversal attempts
        /union\s+select/i,   // SQL injection
        /<script/i,          // XSS
        /eval\(/i            // Code injection
    ];

    const isSuspicious = suspiciousPatterns.some(pattern =>
        pattern.test(req.url) || pattern.test(JSON.stringify(req.body))
    );

    if (isSuspicious) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            ip: req.ip,
            method: req.method,
            url: req.url,
            headers: req.headers,
            body: req.body,
            userAgent: req.headers['user-agent']
        };

        // Append to log file (sync for simplicity; consider async in high-traffic)
        fs.appendFileSync(
            path.join(__dirname, '../logs/suspicious.log'),
            JSON.stringify(logEntry) + '\n'
        );

        // Console warning for immediate visibility
        console.warn('⚠️ Suspicious request detected:', logEntry);
    }

    next();
};