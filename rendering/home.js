//add current user if found

const { getCategoriesWithCount } = require("../controller/category");
const { getFeaturedKitchens } = require("../controller/kitchen");
const checkLogin = require("../utiles/checkLogin");

async function getLandingPage_render(req, res){

    const categories = await getCategoriesWithCount();

    const kitchens = await getFeaturedKitchens();
    
    res.render('index',{
        ...checkLogin(req,res),
        categories,
        kitchens
    });
}

function about_render(req,res){
    res.render('about',checkLogin(req,res));
}

function fqs_render(req,res){
    res.render('fqs',checkLogin(req,res));
}

function content_render(req,res){
    res.render('contect-us',checkLogin(req,res));
}




module.exports={
about_render,
fqs_render,
content_render,
getLandingPage_render
}