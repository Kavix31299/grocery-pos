const { countUsers, findUserById, toPublicUser } = require('../services/authService');
const { verifyToken } = require('../utils/jwt');
const { ROLES } = require('../utils/roles');

const getBearerToken = (req) => {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return null;
  }

  return header.slice(7);
};

const verifyAuthToken = async (req, res, next) => {
  try {
    const token = getBearerToken(req);

    if (!token) {
      return res.status(401).json({ message: 'Authentication token is required' });
    }

    const payload = verifyToken(token);
    const user = await findUserById(payload.userId);

    if (!user || !user.is_active) {
      return res.status(401).json({ message: 'Invalid or inactive user' });
    }

    req.user = toPublicUser(user);
    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

const optionalAuthToken = async (req, res, next) => {
  try {
    const token = getBearerToken(req);

    if (!token) {
      return next();
    }

    const payload = verifyToken(token);
    const user = await findUserById(payload.userId);

    if (user && user.is_active) {
      req.user = toPublicUser(user);
    }

    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

const checkUserRole = (...allowedRoles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication is required' });
  }

  if (req.user.role === ROLES.ADMIN || allowedRoles.includes(req.user.role)) {
    return next();
  }

  return res.status(403).json({ message: 'You do not have permission to access this resource' });
};

const allowFirstUserOrRole = (...allowedRoles) => async (req, res, next) => {
  try {
    const totalUsers = await countUsers();

    if (totalUsers === 0) {
      req.isFirstUser = true;
      return next();
    }

    return checkUserRole(...allowedRoles)(req, res, next);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  verifyAuthToken,
  optionalAuthToken,
  checkUserRole,
  allowFirstUserOrRole
};
