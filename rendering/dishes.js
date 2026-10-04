const checkLogin = require("../utiles/checkLogin");

async function SpecificDish_render(req,res){
    //change , to , english
    req.my.ingredients = req.my.ingredients ? req.my.ingredients.split('，') : null;

    return res.render('./dish/dish',{dish:req.my,...checkLogin(req,res)});
}

// async function SpcificMyDish_render(req,res) {
    
// }

async function Dishes_render(req,res){
        let path='./customer/dishes';
        if(req.user?.roles==='admin')
            path='./admin/dishes';
        else if(req.user?.roles==='chef')
            path='./chef/dishes';
        
        
        return res.render(path,checkLogin(req,res));
}



module.exports = {
    SpecificDish_render,
    Dishes_render,
    // SpcificMyDish_render
}