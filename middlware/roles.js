module.exports = (...allowed) => (req, res, next) => {
  if (!req.user || !allowed.includes(req.user.roles)) return res.status(403).json({status:'error',message:'مش مسموح لحسابك بالعملية دي'});
  next();
};
