function home_render(req,res){
    res.render('index',{kitchens:req.paginatedData});
}

function about_render(req,res){
    res.render('about');
}

function fqs_render(req,res){
    res.render('fqs');
}

function content_render(req,res){
    res.render('contect-us');
}




module.exports={
about_render,
fqs_render,
content_render,
home_render
}