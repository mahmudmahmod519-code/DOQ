

module.exports=(schema,data,res)=>{
    const { error, value } = schema.validate(data);
    
    if (error) 
        return res.status(400).json({message:error.details[0].message,status:"error"});
    
    return value;
}