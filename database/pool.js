require('../config/env');
const mysql=require('mysql2/promise');
module.exports=mysql.createPool({
  host:process.env.DB_HOST||'127.0.0.1',user:process.env.DB_USER||'doq_user',
  password:process.env.DB_PASSWORD,database:process.env.DB_NAME||'DOQ',port:Number(process.env.DB_PORT||3306),
  waitForConnections:true,connectionLimit:10,queueLimit:100,connectTimeout:5000,
  charset:'utf8mb4',timezone:'Z',decimalNumbers:false
});
