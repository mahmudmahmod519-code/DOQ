const checkLogin = require("../utiles/checkLogin");

function catgories_render(req,res){
    res.render('./admin/cateogries',checkLogin(req,res));
}

module.exports={
    catgories_render
}