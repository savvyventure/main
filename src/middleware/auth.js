// Authentication middleware
// "Middleware" is a function that runs BEFORE a route handler.
// These check whether a user is logged in and redirect them if not.

// Requires the user to be logged in
function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/auth/login');
  }
  next();
}

// Redirects logged-in users away from login/signup pages
function redirectIfAuth(req, res, next) {
  if (req.session.user) {
    return res.redirect('/');
  }
  next();
}

module.exports = { requireAuth, redirectIfAuth };
