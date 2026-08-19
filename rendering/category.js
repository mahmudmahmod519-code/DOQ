function catgories_render(req,res){
res.render('./admin/cateogries',{
        categories: req.paginatedData || [],
        currentUser: req.my || null
});
}

module.exports={
    catgories_render
}