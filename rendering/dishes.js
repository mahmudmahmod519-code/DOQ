async function SpecificDish_render(req,res){
    //change , to , english
    req.my.ingredients = req.my.ingredients ? req.my.ingredients.split('，') : null;
    
    return res.render('./dish/dish',{dish:req.my,user:req.user});
}


async function Dishes_render(req,res){
        let path='./dish/dishes';
        if(req.user.roles==='admin')
            path='./admin/dishes';
        
        return res.render(path,
            {
                currentUser: req.user || null,
            });
}

async function MyDishes_render(req,res){
    return res.render('./dish/mydishes',{ 
        currentUser:req.user||null,
    });
}


module.exports = {
    SpecificDish_render,
    Dishes_render,
    MyDishes_render
}