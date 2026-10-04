/**
 * Helmet CSP configuration (currently unused – commented reference for index.js).
 * Defines a restrictive Content-Security-Policy and referrer policy.
 * Uncomment and import in index.js to enable.
 */
/*
const helmet = require('helmet');

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com", "https://fonts.googleapis.com"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            imgSrc: ["'self'", "data:", "https://images.unsplash.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            connectSrc: ["'self'"],
        },
    },
    referrerPolicy: {
        policy: 'strict-origin-when-cross-origin'
    }
}));
*/