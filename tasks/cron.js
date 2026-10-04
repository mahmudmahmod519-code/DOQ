/**
 * DOQ scheduled tasks (cron jobs).
 * Runs product reminders, daily delivery reports, settlement calculations,
 * order cleanup, database backups, and email outbox flushing.
 * Uses a file lock to prevent overlapping executions.
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const pool = require('../database/pool');

const lockPath = path.join(__dirname, '.cron.lock');
const payoutLink = process.env.PAYOUT_LINK || 'https://ipn.eg/S/mahmoudmustafamm/instapay/0qc4FA';

/**
 * Inserts a notification for a user, ignoring duplicates via dedupe_key.
 * @param {number} userId - Target user ID.
 * @param {string} type - Notification type string.
 * @param {string} title - Notification title.
 * @param {string} body - Notification body text.
 * @param {string} dedupe - Deduplication key.
 * @returns {Promise<void>}
 */
async function notify(userId, type, title, body, dedupe) {
  await pool.query(
    'INSERT IGNORE INTO notifications (user_id,type,title,body,dedupe_key) VALUES (?,?,?,?,?)',
    [userId, type, title, body, dedupe]
  );
}

/**
 * Marks expired coupons as deleted and purges those deleted more than 1 day ago.
 * @returns {Promise<void>}
 */
async function cleanupCompletedOrders() {
  await pool.query("UPDATE dish_coupons SET deleted_at=UTC_TIMESTAMP() WHERE expires_at <= UTC_TIMESTAMP() AND deleted_at IS NULL");
  await pool.query("DELETE FROM dish_coupons WHERE deleted_at IS NOT NULL AND deleted_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 DAY)");
}

/**
 * Returns today's date in Cairo timezone as YYYY-MM-DD.
 * @returns {string}
 */
function cairoDate() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

/**
 * Shifts a YYYY-MM-DD date by a number of days.
 * @param {string} day - Base date in YYYY-MM-DD.
 * @param {number} offset - Days to add (can be negative).
 * @returns {string} Shifted date in YYYY-MM-DD.
 */
function shiftDay(day, offset) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

/**
 * Determines the next daily report date that needs to be generated.
 * Respects catch-up logic for missed days.
 * @param {string} [today=cairoDate()] - Reference date.
 * @returns {Promise<string|null>} Next report date or null if up to date.
 */
async function nextDailyReportDate(today = cairoDate()) {
  const latestAllowed = shiftDay(today, -1);
  const [[latest]] = await pool.query("SELECT DATE_FORMAT(MAX(report_date),'%Y-%m-%d') AS last_report FROM daily_reports");
  if (latest?.last_report) {
    const next = shiftDay(latest.last_report, 1);
    return next <= latestAllowed ? next : null;
  }
  const [[first]] = await pool.query('SELECT MIN(created_at) AS created,MIN(accepted_at) AS accepted,MIN(completed_at) AS completed FROM orders');
  const dates = [first?.created, first?.accepted, first?.completed].filter(Boolean).map(value =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value))
  );
  const oldest = dates.sort()[0];
  return oldest && oldest < latestAllowed ? oldest : latestAllowed;
}

/**
 * Calculates UTC midnight bounds for a Cairo date.
 * @param {string} day - Date in YYYY-MM-DD.
 * @returns {Promise<[string, string]>} [start_utc, end_utc] as MySQL DATETIME strings.
 */
function cairoUtcBounds(day) {
  const offsetMinutes = instant => {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Africa/Cairo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23'
    }).formatToParts(instant).reduce((out, part) => { out[part.type] = part.value; return out; }, {});
    const localAsUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
    return Math.round((localAsUtc - instant.getTime()) / 60000);
  };

  const midnight = date => {
    const utcGuess = new Date(`${date}T00:00:00Z`);
    const utc = new Date(utcGuess.getTime() - offsetMinutes(utcGuess) * 60000);
    return utc.toISOString().slice(0, 19).replace('T', ' ');
  };

  const next = new Date(`${day}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return [midnight(day), midnight(next.toISOString().slice(0, 10))];
}

/**
 * HTML-escapes a value for safe embedding in email/report HTML.
 * @param {any} value
 * @returns {string}
 */
const htmlEscape = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&',
  '<': '<',
  '>': '>',
  '"': '"',
  "'": "'"
}[char]));

/**
 * Builds the HTML body for a daily delivery report.
 * @param {string} day - Report date YYYY-MM-DD.
 * @param {number} totalOrders - Total new orders.
 * @param {number} totalValue - Total order value.
 * @param {Array} deliveries - Delivery company rows.
 * @param {Array} kitchens - Kitchen rows.
 * @returns {string} Complete HTML document.
 */
function dailyReportHtml(day, totalOrders, totalValue, deliveries, kitchens) {
  const cells = values => '<tr>' + values.map(value => `<td style="padding:9px;border-bottom:1px solid #eadbd7">${htmlEscape(value)}</td>`).join('') + '</tr>';
  const deliveryRows = deliveries.map(row => {
    const delivered = Number(row.delivered_total || 0);
    return cells([row.company_name || row.delivery_name, row.vehicle_label, row.order_count, Number(row.total_price || 0).toFixed(2), row.accepted_count, row.completed_count, row.pending_count, row.cancelled_count, (delivered * 0.07).toFixed(2)]);
  }).join('');
  const kitchenRows = kitchens.map(row => {
    const delivered = Number(row.delivered_total || 0);
    return cells([row.kitchen_name, row.order_count, Number(row.total_price || 0).toFixed(2), row.completed_count, row.pending_count, (delivered * 0.07).toFixed(2)]);
  }).join('');
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"></head><body style="font-family:Arial,sans-serif;color:#261816;background:#fff8f6;padding:24px"><main style="max-width:860px;margin:auto;background:#fff;border-radius:16px;overflow:hidden"><header style="background:#261816;color:white;padding:24px"><h1 style="margin:0">تقرير التشغيل اليومي</h1><p style="margin-bottom:0">${htmlEscape(day)}</p></header><div style="padding:24px"><p>عدد الطلبات الجديدة: <b>${htmlEscape(totalOrders)}</b> | قيمتها: <b>${htmlEscape(totalValue.toFixed(2))} جنيه</b></p><h2>شركات الدليفري والعربيات</h2><table style="border-collapse:collapse;width:100%" border="0"><thead>${cells(['الشركة','العربية','طلبات','القيمة','مقبولة','وصلت','معلقة','ملغية','٧٪ مكتملة'])}</thead><tbody>${deliveryRows || cells(['لا توجد طلبات','','','','','','','',''])}</tbody></table><h2>المطابخ</h2><table style="border-collapse:collapse;width:100%" border="0"><thead>${cells(['المطبخ','طلبات','القيمة','وصلت','معلقة','٧٪ مكتملة'])}</thead><tbody>${kitchenRows || cells(['لا توجد طلبات','','','','',''])}</tbody></table><p style="color:#59413d">النسبة المعروضة هي سبعة بالمئة من قيمة الطلبات المكتملة للتقرير اليومي. تحويل المستحقات يظل مربوطاً بإعدادات التسوية المعتمدة</p></div></main></body></html>`;
}

/**
 * Generates and queues the daily delivery report for all admins.
 * Inserts into daily_reports, email_outbox, and notifications tables transactionally.
 * @returns {Promise<Object>} Result status and metadata.
 */
async function sendDailyDeliveryReport() {
  if (process.env.DAILY_REPORT_ENABLED !== 'true') return { status: 'disabled' };

  const day = await nextDailyReportDate();
  if (!day) return { status: 'up_to_date' };

  const [start, end] = cairoUtcBounds(day);
  const range = column => `(${column}>=? AND ${column}<?)`;

  const [rows] = await pool.query(
    `SELECT o.delivery_id,
      COALESCE(NULLIF(CONCAT_WS(' ',u.first_name,u.last_name),''),'بدون شركة') AS delivery_name,
      COALESCE(u.company_name,'') AS company_name,
      COALESCE(v.label,'بدون عربية') AS vehicle_label,
      SUM(${range('o.created_at')}) AS order_count,
      SUM(CASE WHEN ${range('o.created_at')} THEN o.total_price ELSE 0 END) AS total_price,
      SUM(${range('o.accepted_at')}) AS accepted_count,
      SUM(${range('o.completed_at')} AND o.status='completed') AS completed_count,
      SUM(CASE WHEN ${range('o.completed_at')} AND o.status='completed' THEN o.total_price ELSE 0 END) AS delivered_total,
      SUM(${range('o.created_at')} AND o.status='pending') AS pending_count,
      SUM(${range('o.created_at')} AND o.status='cancelled') AS cancelled_count
    FROM orders o
    LEFT JOIN users u ON u.id=o.delivery_id
    LEFT JOIN delivery_vehicles v ON v.id=o.vehicle_id
    WHERE ${range('o.created_at')} OR ${range('o.accepted_at')} OR ${range('o.completed_at')}
    GROUP BY o.delivery_id,u.first_name,u.last_name,u.company_name,v.label
    ORDER BY delivery_name,vehicle_label`,
    Array.from({length:10},()=>[start,end]).flat()
  );

  const [kitchens] = await pool.query(
    `SELECT k.title AS kitchen_name,
      SUM(${range('o.created_at')}) AS order_count,
      SUM(CASE WHEN ${range('o.created_at')} THEN o.total_price ELSE 0 END) AS total_price,
      SUM(${range('o.completed_at')} AND o.status='completed') AS completed_count,
      SUM(CASE WHEN ${range('o.completed_at')} AND o.status='completed' THEN o.total_price ELSE 0 END) AS delivered_total,
      SUM(${range('o.created_at')} AND o.status='pending') AS pending_count
    FROM orders o
    JOIN kitchens k ON k.id=o.kitchen_id
    WHERE ${range('o.created_at')} OR ${range('o.completed_at')}
    GROUP BY o.kitchen_id,k.title
    ORDER BY k.title`,
    Array.from({length:7},()=>[start,end]).flat()
  );

  const [adminsRows] = await pool.query("SELECT id,email FROM users WHERE roles='admin' AND account_status='approved' AND email IS NOT NULL");
  if (!adminsRows.length) return { status: 'admin_email_missing' };

  const totalOrders = rows.reduce((sum, row) => sum + Number(row.order_count), 0);
  const totalValue = rows.reduce((sum, row) => sum + Number(row.total_price || 0), 0);
  const deliveryCommission = rows.reduce((sum, row) => sum + Number(row.delivered_total || 0) * 0.07, 0);
  const kitchenCommission = kitchens.reduce((sum, row) => sum + Number(row.delivered_total || 0) * 0.07, 0);

  const deliveryLines = rows.length ? rows.map(row =>
    `${row.delivery_name}${row.company_name ? ` (${row.company_name})` : ''} | ${row.vehicle_label} | الطلبات ${row.order_count} | قيمة الطلبات ${Number(row.total_price || 0).toFixed(2)} جنيه | اتقبلت ${row.accepted_count} | اتوصلت ${row.completed_count} بقيمة ${Number(row.delivered_total || 0).toFixed(2)} جنيه | ٧٪ الإدارة ${(Number(row.delivered_total || 0) * 0.07).toFixed(2)} جنيه | معلقة ${row.pending_count} | ملغية ${row.cancelled_count}`
  ).join('\n') : 'مفيش طلبات للدليفري في اليوم ده';

  const kitchenLines = kitchens.length ? kitchens.map(row =>
    `${row.kitchen_name} | الطلبات ${row.order_count} | قيمة الطلبات ${Number(row.total_price || 0).toFixed(2)} جنيه | اتوصلت ${row.completed_count} بقيمة ${Number(row.delivered_total || 0).toFixed(2)} جنيه | ٧٪ الإدارة ${(Number(row.delivered_total || 0) * 0.07).toFixed(2)} جنيه | معلقة ${row.pending_count}`
  ).join('\n') : 'مفيش طلبات للمطابخ في اليوم ده';

  const body = `تقرير تشغيل يوم ${day}\n\nإجمالي الطلبات الجديدة: ${totalOrders}\nإجمالي قيمتها: ${totalValue.toFixed(2)} جنيه\nإجمالي رسوم الإدارة من شركات الدليفري: ${deliveryCommission.toFixed(2)} جنيه\nإجمالي رسوم الإدارة من المطابخ: ${kitchenCommission.toFixed(2)} جنيه\nإجمالي رسوم الإدارة: ${(deliveryCommission + kitchenCommission).toFixed(2)} جنيه\n\nكل شركة وكل عربية:\n${deliveryLines}\n\nكل مطبخ:\n${kitchenLines}\n\nالنسبة المعروضة سبعة بالمئة من قيمة الطلبات المكتملة. تحويل المستحقات يظل مربوطاً بإعدادات التسوية المعتمدة`;

  const html = dailyReportHtml(day, totalOrders, totalValue, rows, kitchens).replace('</div></main>', `<p style="color:#59413d">إجمالي رسوم الإدارة المعروضة: ${(deliveryCommission + kitchenCommission).toFixed(2)} جنيه</p></div></main>`);

  const transaction = require('../utiles/transaction');
  await transaction(async db => {
    await db.query('INSERT INTO daily_reports (report_date,completed_count) VALUES (?,?)', [day, rows.reduce((sum, row) => sum + Number(row.completed_count), 0)]);
    for (const admin of adminsRows) {
      await db.query('INSERT INTO email_outbox (recipient,subject,body,html_body,dedupe_key) VALUES (?,?,?,?,?)', [admin.email, `تقرير التشغيل اليومي ${day}`, body, html, `delivery-report:${day}:${admin.id}`]);
      await db.query('INSERT IGNORE INTO notifications (user_id,type,title,body,dedupe_key) VALUES (?,?,?,?,?)', [admin.id, 'delivery_daily_report', 'تقرير التشغيل اليومي', `تم تجهيز تقرير ${day} بعدد ${totalOrders} طلب وإجمالي رسوم إدارة ${ (deliveryCommission + kitchenCommission).toFixed(2) } جنيه`, `delivery-report:${day}:${admin.id}`]);
    }
  });

  return { status: 'recorded', date: day, orders: totalOrders };
}

/**
 * Purges completed orders for fully-emailed daily reports.
 * Deletes completed orders within the report's Cairo day bounds, marks report as purged.
 * @returns {Promise<Object>} Result with count of purged reports.
 */
async function purgeReportedCompletedOrders() {
  if (process.env.PURGE_REPORTED_COMPLETED_ORDERS !== 'true') return { status: 'disabled' };

  const [reports] = await pool.query(
    `SELECT DATE_FORMAT(r.report_date,'%Y-%m-%d') AS day
     FROM daily_reports r
     WHERE purged_at IS NULL
       AND EXISTS (SELECT 1 FROM email_outbox e WHERE e.dedupe_key LIKE CONCAT('delivery-report:',r.report_date,':%'))
       AND NOT EXISTS (SELECT 1 FROM email_outbox e WHERE e.dedupe_key LIKE CONCAT('delivery-report:',r.report_date,':%') AND e.sent_at IS NULL)
     ORDER BY report_date ASC LIMIT 30`
  );

  for (const report of reports) {
    const day = report.day;
    const [start, end] = cairoUtcBounds(day);
    await pool.query("DELETE FROM orders WHERE status='completed' AND completed_at>=? AND completed_at<?", [start, end]);
    await pool.query('UPDATE daily_reports SET purged_at=UTC_TIMESTAMP(),emailed_at=UTC_TIMESTAMP() WHERE report_date=?', [day]);
  }

  return { status: 'done', reports: reports.length };
}

/**
 * Sends weekly product reminders to inactive chefs and customers.
 * Chefs with no new dishes in 14 days; customers with no orders in 30 days (capped at 1000).
 * @returns {Promise<void>}
 */
async function sendProductReminders() {
  const now = new Date();
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  const weekKey = monday.toISOString().slice(0, 10);

  const [chefs] = await pool.query(
    `SELECT DISTINCT u.id
     FROM users u
     JOIN kitchens k ON k.user_id=u.id
     LEFT JOIN dishes d ON d.kitchen_id=k.id AND d.created_at >= DATE_SUB(NOW(), INTERVAL 14 DAY)
     WHERE u.roles='chef' AND u.account_status='approved'
     GROUP BY u.id
     HAVING COUNT(d.id)=0`
  );

  await Promise.all(chefs.map(row => notify(row.id, 'catalog_reminder', 'حدّث قائمتك', 'أضف طبقاً جديداً أو حدّث قائمتك هذا الأسبوع', `catalog:${row.id}:${weekKey}`)));

  const [customers] = await pool.query(
    `SELECT u.id FROM users u
     WHERE u.roles='customer'
       AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id=u.id AND o.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY))
     LIMIT 1000`
  );

  await Promise.all(customers.map(row => notify(row.id, 'dish_reminder', 'جرب طبقاً جديداً', 'في أطباق جديدة تستحق التجربة', `dish:${row.id}:${weekKey}`)));
}

/**
 * Calculates and records commission settlements for kitchens and delivery.
 * Gated by COMMISSION_APPROVED, DELIVERY_COMMISSION_BASIS, and SETTLEMENT_CADENCE env vars.
 * @returns {Promise<Object>} Settlement result or status awaiting configuration.
 */
async function settlePeriod() {
  // Financial reminders are disabled until the owner has approved the delivery base and cadence.
  if (
    process.env.COMMISSION_APPROVED !== 'true' ||
    (process.env.DELIVERY_COMMISSION_BASIS !== 'order_total' && process.env.DELIVERY_COMMISSION_BASIS !== 'delivery_fee') ||
    !['daily','monthly'].includes(process.env.SETTLEMENT_CADENCE)
  ) {
    return {status:'awaiting_owner_configuration'};
  }

  const chefRate = Number(process.env.CHEF_COMMISSION_PERCENT);
  const deliveryRate = Number(process.env.DELIVERY_COMMISSION_PERCENT);
  if (chefRate !== 7 || deliveryRate !== 7) {
    throw new Error('commission_configuration_mismatch');
  }

  const today = new Date();
  const date = new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'}).format(today);
  const [year,month,day] = date.split('-').map(Number);

  if (process.env.SETTLEMENT_CADENCE === 'monthly' && day !== 1) return {status:'not_due'};

  const previous = new Date(Date.UTC(year,month-1,day));
  previous.setUTCDate(previous.getUTCDate()-1);
  const previousDate = previous.toISOString().slice(0,10);

  const periodStart = process.env.SETTLEMENT_CADENCE === 'daily' ? previousDate : new Date(Date.UTC(year,month-2,1)).toISOString().slice(0,10);
  const periodEnd = process.env.SETTLEMENT_CADENCE === 'daily' ? date : new Date(Date.UTC(year,month-1,1)).toISOString().slice(0,10);

  const [startUtc] = cairoUtcBounds(periodStart);
  const [endUtc] = cairoUtcBounds(periodEnd);

  const [kitchens] = await pool.query(
    'SELECT kitchen_id AS party_id,SUM(gross_amount) AS gross,SUM(delivery_fee_amount) AS fees FROM order_financial_events WHERE completed_at>=? AND completed_at<? GROUP BY kitchen_id',
    [startUtc,endUtc]
  );

  const [deliveries] = await pool.query(
    'SELECT delivery_id AS party_id,SUM(gross_amount) AS gross,SUM(delivery_fee_amount) AS fees FROM order_financial_events WHERE completed_at>=? AND completed_at<? AND delivery_id IS NOT NULL GROUP BY delivery_id',
    [startUtc,endUtc]
  );

  const transaction = require('../utiles/transaction');
  const {notify:insertNotification} = require('../utiles/notifications');

  for (const [type, rows] of [['kitchen',kitchens],['delivery',deliveries]]) {
    for (const row of rows) {
      const base = type === 'kitchen'
        ? Number(row.gross)
        : Number(process.env.DELIVERY_COMMISSION_BASIS === 'delivery_fee' ? row.fees : row.gross);
      const due = Number((base * 0.07).toFixed(2));
      const userId = type === 'delivery'
        ? row.party_id
        : (await pool.query('SELECT user_id FROM kitchens WHERE id=?',[row.party_id]))[0][0]?.user_id;
      if (!userId) continue;

      await transaction(async db => {
        await db.query(
          'INSERT INTO settlements (period_start,period_end,party_type,party_id,gross_amount,commission_amount) VALUES (?,?,?,?,?,?) ON DUPLICATE KEY UPDATE gross_amount=VALUES(gross_amount),commission_amount=VALUES(commission_amount)',
          [periodStart,periodEnd,type,row.party_id,Number(row.gross),due]
        );
        await insertNotification(
          db, userId, 'settlement', 'رسوم الإدارة للفترة',
          `إجمالي الطلبات المكتملة ${Number(row.gross).toFixed(2)} جنيه. رسوم الإدارة سبعة بالمئة وتساوي ${due.toFixed(2)} جنيه. رابط التحويل: ${payoutLink}`,
          'settlement', null, `settlement:${type}:${row.party_id}:${periodStart}`
        );
      });
    }
  }

  return {status:'recorded',start:periodStart,end:periodEnd};
}

/**
 * Creates a MySQL database backup using mysqldump.
 * @returns {Promise<string|'disabled'>} Path to backup file or 'disabled'.
 */
function backupDatabase() {
  if (process.env.BACKUP_ENABLED !== 'true' || !process.env.DB_NAME) return Promise.resolve('disabled');

  const dir = process.env.BACKUP_DIR || path.join(__dirname, '..', 'backups');
  fs.mkdirSync(dir, { recursive: true });

  const output = path.join(dir, `doq-${new Date().toISOString().slice(0,10)}.sql`);
  const temp = `${output}.${process.pid}.tmp`;

  const args = [
    '--host', process.env.DB_HOST || 'localhost',
    '--port', String(process.env.DB_PORT || 3306),
    '--user', process.env.DB_USER || 'root',
    process.env.DB_NAME
  ];

  return new Promise((resolve, reject) => {
    const child = spawn(process.env.MYSQLDUMP_BIN || 'mysqldump', args, {
      env: {...process.env, MYSQL_PWD: process.env.DB_PASSWORD || ''},
      stdio: ['ignore','pipe','pipe'],
      shell: false
    });
    let error = '';
    let settled = false;

    const fail = err => {
      if (settled) return;
      settled = true;
      try { fs.rmSync(temp, {force:true}) } catch {}
      reject(err);
    };

    let out;
    try { out = fs.createWriteStream(temp, {flags:'wx'}) } catch (err) { return fail(err); }

    child.stdout.pipe(out);
    child.stderr.on('data', b => { error += b.toString().slice(0,300); });
    child.on('error', fail);
    child.on('close', code => {
      out.end(() => {
        if (code !== 0) return fail(new Error('backup_exit_'+code));
        try { fs.renameSync(temp, output); settled = true; resolve(output); }
        catch (err) { fail(err); }
      });
    });
  });
}

/**
 * Runs all cron jobs once (with file lock to prevent overlap).
 * Order: reminders -> daily report -> settlement -> cleanup -> backup -> email flush -> purge.
 * @returns {Promise<Object>} Combined results or {status:'disabled'} if CRON_ENABLED !== 'true'.
 */
async function runOnce() {
  if (process.env.CRON_ENABLED !== 'true') return { status: 'disabled' };
  if (fs.existsSync(lockPath)) return;

  fs.writeFileSync(lockPath, String(process.pid), { flag: 'wx' });

  try {
    await sendProductReminders();
    await sendDailyDeliveryReport();
    await settlePeriod();
    await cleanupCompletedOrders();
    await backupDatabase();
    await require('../utiles/mailer').flushOutbox(200);
    await purgeReportedCompletedOrders();
  } finally {
    fs.rmSync(lockPath, { force: true });
  }
}

if (require.main === module) {
  runOnce()
    .then(() => pool.end())
    .catch(() => {
      console.error('cron_failed_database_or_backup');
      process.exitCode = 1;
      return pool.end();
    });
}

module.exports = {
  runOnce,
  cleanupCompletedOrders,
  sendProductReminders,
  sendDailyDeliveryReport,
  purgeReportedCompletedOrders,
  settlePeriod,
  backupDatabase,
  cairoUtcBounds,
  dailyReportHtml,
  nextDailyReportDate
};