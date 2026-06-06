const jwt = require("jsonwebtoken");

module.exports = function auth(req, res, next) {
  const authHeader = req.headers.authorization;
  let token = null;

  if (authHeader) {
    token = authHeader.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : authHeader;
  } else if (req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }


  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 🔥 IMPORTANT: normalize user id ONCE
    const userId =
      decoded._id ||
      decoded.id ||
      decoded.userId;

    if (!userId) {
      return res.status(401).json({ error: "Invalid token payload" });
    }

    // ✅ STANDARDIZE USER OBJECT
    req.user = {
      _id: userId,
      email: decoded.email
    };

    // ✅ BACKWARD COMPATIBILITY
    req.userId = userId;

    next();
  } catch (err) {
    console.error("JWT verification failed:", err);
    return res.status(401).json({ error: "Invalid token" });
  }
};
