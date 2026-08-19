
//all kitchens admin and customer
function kitchens_render(req, res) {

    let path_render='./kitchen/kitchens';
    
    if(req.my.roles==='admin')
        path_render='./admin/kitchens';

    res.render(path_render, {
        kitchens: req.paginatedData || [],
        currentUser: req.user || null,
    });
}


//my kitchen chef
function myKitchen_render(req, res) {
    res.render('./kitchen/my-kitchen', {
        kitchen: req.my || null,
        // return deishes
        // render my dishes as fetch
        currentUser: req.user || null
    });
}

//spcific kitchen
function kitchenProfile_render(req, res) {
    res.render('./kitchen/kitchen-profile', {
        kitchen: req.kitchen || null,
        // dishes: req.dishes || [], will use api dishes in page fetch
        currentUser: req.user || null
    });
}



module.exports = {
    kitchens_render,
    myKitchen_render,
    kitchenProfile_render
};