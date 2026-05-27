function requireAuth(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ success: false, message: 'Unauthorized. Please log in.' });
  }
  return res.redirect('/');
}

function requireAdmin(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === 'Admin') {
    return next();
  }
  return res.status(403).json({ success: false, message: 'Admin access required.' });
}

module.exports = { requireAuth, requireAdmin };