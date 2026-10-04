const checkLogin = require("../utiles/checkLogin");


async function portfolio_render(req,res){
    const path='./user/portfolio';
    const response={
        reviews:req.my,
        total_reviews:req.pagination.total,
        ...checkLogin(req,res)
    }

    if(req.user.roles === 'admin' || req.user.roles === 'chef'){
        delete response.reviews;delete response.total_reviews;
    }
        
    
    res.render(path,response);
}


async function setting_render(req,res){
    res.render('./user/setting',checkLogin(req,res));
}

async function users_render(req,res){
    res.render('./admin/users',checkLogin(req,res));
}



async function dashboard_render(req,res){
    let path='./chef/dashboard';
    const response={
        ...checkLogin(req,res),
        dashboard: req.dashboard || {}
    };

    if(req.user.roles==='admin'){
        path='./admin/dashboard';
        delete response.dashboard;
        response.pageTitle='لوحة التحكم | دوق DOQ';
    }
    
    res.render(path,response);
}



module.exports={
    portfolio_render,
    dashboard_render,
    setting_render,
    users_render
};