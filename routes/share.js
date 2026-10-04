const router = require('express').Router();
const pool = require('../database/pool');
router.get('/dish/:token', async (req,res) => {
  const [rows] = await pool.query('SELECT dish_id FROM dish_referrals WHERE token=? LIMIT 1', [req.params.token]);
  if (!rows.length) return res.redirect('/');
  res.cookie('doq_referral', req.params.token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 30*24*60*60*1000 });
  return res.redirect(`/auth?ref=${encodeURIComponent(req.params.token)}`);
});
module.exports = router;
