const express = require('express');
const cookieParser = require('cookie-parser');
const pool = require('./database/pool');
const path = require('path');
const app = express();
require('dotenv').config();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads",express.static('public/upload'));


app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));


app.get('/', (req, res) => {
    res.render('index', { title: 'My App' });
});


app.use('/auth', require('./routes/auth.js'));
app.use('/categories', require('./routes/categories.js'));
app.use('/dishes', require('./routes/dish.js'));
app.use('/', require('./routes/home.js'));
app.use('/kitchens', require('./routes/kitchen.js'));
app.use('/reviews', require('./routes/review.js'));
app.use('/users', require('./routes/user.js'));


require('./utiles/swagger.js')();


app.listen(process.env.PORT || 3000, () => {
    console.log('Server is running...');
    console.log(`http://localhost:${process.env.PORT || 3000}`);
    console.log(`Server is running on port ${process.env.PORT || 3000}`);
});