const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const bcrypt = require('bcrypt');
process.env.JWT_SECRET = crypto.randomBytes(48).toString('hex');
const poolPath = require.resolve('../database/pool');
let rows = [];
require.cache[poolPath] = { id: poolPath, filename: poolPath, loaded: true, exports: { query: async () => [rows], execute: async () => [{insertId: 1}] } };
const auth = require('../controller/auth');
const security = require('../middlware/security');
const scrub = require('../utiles/remove_password');
const { userSchema } = require('../utiles/validation');
function response() { return { statusCode: 200, cookies: [], status(n){this.statusCode=n;return this;}, cookie(name,value){this.cookies.push(name);return this;}, json(value){this.body=value;return this;}, clearCookie(){}, redirect(value){this.redirectTo=value;return this;} }; }
test('incomplete MFA enrollment cannot issue a full login session', async () => {
 rows=[{ id:1,roles:'customer',account_status:'approved',two_factor_required:1,two_factor_enabled:0,password_hash:await bcrypt.hash('Fixture@123',4) }];
 const res=response();
 await auth.signIn_controller({body:{email:'fixture@example.com',password:'Fixture@123'},cookies:{},headers:{}},res);
 assert.equal(res.cookies.includes('session_token'),false);
});
test('signed session-bound CSRF token is accepted', () => {
 const seed='a'.repeat(64), crypto=require('node:crypto'), token=crypto.createHmac('sha256',process.env.JWT_SECRET).update(seed+':session').digest('hex'); let called=false; const res=response(); security.csrfProtection({method:'POST',headers:{},cookies:{doq_csrf_seed:seed,session_token:'session'},body:{},get(name){return name==='x-csrf-token'?token:undefined;}},res,()=>{called=true;}); assert.equal(called,true);
});
test('unverified Bearer text does not bypass CSRF', () => {
 const res=response();let called=false;
 security.csrfProtection({method:'POST',headers:{authorization:'Bearer bogus'},cookies:{},body:{},get(){return undefined;}},res,()=>{called=true;});
 assert.equal(called,false);assert.equal(res.statusCode,403);
});

test('Paymob HMAC uses nested order and source fields and compares in constant time', () => {
 const crypto=require('node:crypto');
 const previous=process.env.PAYMOB_HMAC_SECRET;
 process.env.PAYMOB_HMAC_SECRET='paymob-test-secret';
 const payload={amount_cents:100,created_at:'2026-01-01T00:00:00Z',currency:'EGP',error_occured:false,has_parent_transaction:false,id:12,integration_id:34,is_3d_secure:false,is_auth:true,is_capture:true,is_refunded:false,is_standalone_payment:true,is_voided:false,order:{id:56},owner:1,pending:false,source_data:{pan:'0000',sub_type:'Visa',type:'card'},success:true};
 const values=[payload.amount_cents,payload.created_at,payload.currency,payload.error_occured,payload.has_parent_transaction,payload.id,payload.integration_id,payload.is_3d_secure,payload.is_auth,payload.is_capture,payload.is_refunded,payload.is_standalone_payment,payload.is_voided,payload.order.id,payload.owner,payload.pending,payload.source_data.pan,payload.source_data.sub_type,payload.source_data.type,payload.success];
 payload.hmac=crypto.createHmac('sha512',process.env.PAYMOB_HMAC_SECRET).update(values.map(v=>String(v ?? '')).join('')).digest('hex');
 const {verifyPaymobHmac}=require('../utiles/payment');
 assert.equal(verifyPaymobHmac(payload),true);
 payload.hmac=payload.hmac.slice(0,-1)+'0';
 assert.equal(verifyPaymobHmac(payload),false);
 if(previous===undefined) delete process.env.PAYMOB_HMAC_SECRET; else process.env.PAYMOB_HMAC_SECRET=previous;
});
test('user serialization hides password and MFA secrets', () => {
 const output=scrub({id:3,password_hash:'sensitive',two_factor_secret:'sensitive',first_name:'Ahmed'});
 assert.equal(output.password_hash,undefined);assert.equal(output.two_factor_secret,undefined);assert.equal(output.id,3);
});
test('signup with MFA disabled accepts the real blank-secret form payload', () => {
 const {error}=userSchema.validate({firstname:'Ahmed',lastname:'Ali',email:'fixture@example.com',phone_number:'01012345678',password:'Fixture@123',password_confirmation:'Fixture@123',roles:'customer',enable_2fa:'0',secretKey:''});
 assert.equal(error,undefined);
});
