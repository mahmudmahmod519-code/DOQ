function reviews_render(req,res){
    return res.render('./reviews/reviews',{
        currentUser:req.user,
        status:'success'
    })
}


//add info kitchen from api mykitchens
function reviewsDashboard_render(req,res){
    let path='./reviews/reviews_chef_dashboard';
    if(req.user.roles==='admin')
        path='./admin/reviews';

    return res.render(path,{
        currentUser:req.user
    });
}

module.exports={
    reviewsDashboard_render,
    reviews_render
}