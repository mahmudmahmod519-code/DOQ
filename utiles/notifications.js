const pool=require('../database/pool');
async function notify(db,userId,type,title,body,entityType=null,entityId=null,dedupe=null) {
  if (!userId) return;
  await db.query('INSERT IGNORE INTO notifications (user_id,type,title,body,entity_type,entity_id,dedupe_key) VALUES (?,?,?,?,?,?,?)',[userId,type,title,body,entityType,entityId,dedupe]);
}
async function admins(db,type,title,body,entityType=null,entityId=null) {
  const [rows]=await db.query("SELECT id FROM users WHERE roles='admin' AND account_status='approved'");
  for (const user of rows) await notify(db,user.id,type,title,body,entityType,entityId, entityType && entityId ? `${type}:${entityType}:${entityId}` : null);
}
module.exports={notify,admins};
