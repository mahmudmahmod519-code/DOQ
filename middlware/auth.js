const jwt = require('jsonwebtoken');
const pool = require('../database/pool');
const HttpError = require('../utiles/httpError');
async function identify(req) {
  const token=req.headers.authorization?.startsWith('Bearer ')?req.headers.authorization.slice(7):req.cookies?.session_token;
  if (!token) return null;
  let payload;
  try {payload=jwt.verify(token,process.env.JWT_SECRET,{algorithms:['HS256']});}
  catch {return null;}
  if (!payload.id || payload.type!=='session') return null;
  const [[user]]=await pool.query('SELECT * FROM users WHERE id=?',[payload.id]);
  if (!user || Number(payload.sv||0)!==Number(user.session_version||0) || user.account_status!=='approved') return null;
  if (Number(user.two_factor_required) && !Number(user.two_factor_enabled)) return null;
  return user;
}
async function auth(req,res,next) {
  try {
    req.user=await identify(req);
    if (req.user) return next();
    if (req.path.includes('/api') || req.get('accept')?.includes('application/json') || req.method!=='GET') return res.status(401).json({status:'error',message:'سجل دخول الأول'});
    return res.redirect('/auth');
  } catch(error) {next(error);}
}
auth.optional=async (req,res,next)=>{try {req.user=await identify(req);next();}catch(error){next(error);}};
auth.identify=identify;
module.exports=auth;
