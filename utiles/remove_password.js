const hidden = new Set(['password_hash','password','two_factor_secret','two_factor_last_step','session_version','reset_token','reset_token_hash','secretKey']);
function removeSecrets(data) {
  if (Array.isArray(data)) return data.map(removeSecrets);
  if (!data || typeof data !== 'object' || data instanceof Date || Buffer.isBuffer(data)) return data;
  return Object.fromEntries(Object.entries(data).filter(([key]) => !hidden.has(key)).map(([key,value]) => [key,removeSecrets(value)]));
}
module.exports = removeSecrets;
