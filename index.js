const express = require('express');
const cookieParser = require('cookie-parser');
require('./config/env');
const pool = require('./database/pool');
const path = require('path');
const error = require('./middlware/error');
const notFound = require('./middlware/notFound');
const app = express();
const { securityHeaders, issueCsrfCookie, csrfProtection, requestRateLimit } = require('./middlware/security');
app.set('trust proxy', Number(process.env.TRUST_PROXY || 0));
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) console.error('JWT_SECRET is shorter than the required 32 characters');
app.use(express.json({ limit: '64kb' }));
app.use(express.urlencoded({ extended: true, limit: '64kb' }));
app.use(cookieParser());
app.disable('x-powered-by');
app.use(securityHeaders);
app.use(issueCsrfCookie);
app.use(requestRateLimit);
app.get('/security/csrf', (req, res) => res.json({ token: req.csrfToken() }));
app.use(csrfProtection);

app.use(express.static(path.join(__dirname, "public"),{
    maxAge: process.env.NODE_ENV === 'production' ?  3600000 : 0,
    immutable: false,
    etag: true,
    lastModified: true
}));

app.use("/uploads",express.static('public/upload'));


app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));


if (process.env.NODE_ENV !== 'production' && process.env.ENABLE_TEST_PAGE === 'true') {
    app.get('/test', (req, res) => res.render('testPages', { title: 'My App' }));
}



app.use('/auth', require('./routes/auth.js'));
app.use('/categories', require('./routes/categories.js'));
app.use('/dishes', require('./routes/dish.js'));
app.use('/', require('./routes/home.js'));
app.use('/admin', require('./routes/admin.js'));
app.use('/kitchens', require('./routes/kitchen.js'));
app.use('/reviews', require('./routes/review.js'));
app.use('/users', require('./routes/user.js'));
app.use('/police', require('./routes/police.js'));
app.use('/payment', require('./routes/payment.js'));
app.use('/orders', require('./routes/orders.js'));
app.use('/my-orders', require('./routes/customer-orders.js'));
app.use('/delivery', require('./routes/delivery.js'));
app.use('/platform', require('./routes/platform.js'));
app.use('/notifications', require('./routes/notifications.js'));
app.use('/share', require('./routes/share.js'));


app.use(notFound);

app.use(error);


if (require.main === module) app.listen(process.env.PORT || 3000, () => {
    console.log('Server is running...');
    console.log(`http://localhost:${process.env.PORT || 3000}/test`);
    console.log(`Server is running on port ${process.env.PORT || 3000}`);
});




module.exports = app;
