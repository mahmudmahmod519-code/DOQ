const checkLogin = require("../utiles/checkLogin");


function myReviews_render(req, res) {
    return res.render('./customer/myreviews',checkLogin(req,res));
}


//add info kitchen from api mykitchens
function reviews_render(req,res){
    const { type, id } = req.query;
    //all reviews for customers
    let path='./customer/reviews';

    if(req.user?.roles==='admin')
        path='./admin/reviews';
    else if(req.user?.roles==='chef')
        path='./chef/reviews';

    const response= {
        type: type || null,
        id: id || null,
        ...checkLogin(req,res)
    }
   
    if(req.user?.roles!=='customer')
        delete response.type;delete response.id;
    
    
    return res.render(path,response);
}

module.exports={
    reviews_render,
    myReviews_render
}