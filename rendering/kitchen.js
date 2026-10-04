const checkLogin = require("../utiles/checkLogin");

//all kitchens admin and customer
function kitchens_render(req, res) {

    let path_render='./customer/kitchens';
    
    if(req.user?.roles==='admin')
        path_render='./admin/kitchens';

    res.status(200).render(path_render,checkLogin(req, res));
}



//add req.query.kitchen_id = 1
// check here if query is kitchen_id=1 and req.my.id found return it
// else return new kitchen i have it
// if not add req.query.kitchen_id will get first kitchen
// and have button in page can controller in req.query.kitchen in page to get req.my right




//update it
//my kitchen chef
function myKitchen_render(req, res) {
    res.render('./chef/kitchen', {
        kitchen: req.my[0] || null,
        // kitchensList: req.my || [],
        ...checkLogin(req, res)
    });
}

//spcific kitchen
function kitchenProfile_render(req, res) {
    res.render('./kitchen/kitchen', {
        kitchen: req.kitchen || null,
        // dishes: req.dishes || [], will use api dishes in page fetch
        ...checkLogin(req,res)
    });
}



module.exports = {
    kitchens_render,
    myKitchen_render,
    kitchenProfile_render
};