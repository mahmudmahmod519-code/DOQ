const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const pool = require('../database/pool');
const options = (maxAge) => ({ httpOnly:true, secure:process.env.NODE_ENV==='production', sameSite:'lax', path:'/', maxAge });
function issueSession(res, user) {
  const token = jwt.sign({id:user.id,sv:Number(user.session_version||0),type:'session'},process.env.JWT_SECRET,{expiresIn:'7d',algorithm:'HS256'});
  res.clearCookie('pending_token',{path:'/'}); res.cookie('session_token',token,options(7*86400000));
}
async function issueChallenge(res,user,purpose='login') {
  const nonce=crypto.randomUUID();
  await pool.query('INSERT INTO auth_challenges (nonce_hash,user_id,purpose,expires_at) VALUES (?,?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 10 MINUTE))',[crypto.createHash('sha256').update(nonce).digest('hex'),user.id,purpose]);
  const token=jwt.sign({userId:user.id,type:'pending_2fa',purpose,nonce,sv:Number(user.session_version||0)},process.env.JWT_SECRET,{expiresIn:'10m',algorithm:'HS256'});
  res.cookie('pending_token',token,options(600000));
}
function seal(value) {
  const key=crypto.createHash('sha256').update(process.env.JWT_SECRET).digest();
  const iv=crypto.randomBytes(12), cipher=crypto.createCipheriv('aes-256-gcm',key,iv);
  const data=Buffer.concat([cipher.update(JSON.stringify(value)),cipher.final()]);
  return [iv,cipher.getAuthTag(),data].map(x=>x.toString('base64url')).join('.');
}
function unseal(value) {
  const parts=String(value||'').split('.').map(x=>Buffer.from(x,'base64url'));
  const key=crypto.createHash('sha256').update(process.env.JWT_SECRET).digest();
  const decipher=crypto.createDecipheriv('aes-256-gcm',key,parts[0]);decipher.setAuthTag(parts[1]);
  return JSON.parse(Buffer.concat([decipher.update(parts[2]),decipher.final()]).toString('utf8'));
}
function dashboard(role) {return role==='admin'?'/admin':role==='delivery'?'/delivery':role==='chef'?'/users/dashboard':'/my-orders';}
module.exports={issueSession,issueChallenge,seal,unseal,options,dashboard};
