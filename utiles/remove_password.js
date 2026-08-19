module.exports=(data)=>{
    if(Array.isArray(data))
        return data.map(({ password_hash, ...rest })=>rest);

    if(data && typeof data === 'object'){
        const {password_hash,...rest}=data;
        return rest;
    }
        

    return data;
}