const jwt = require('jsonwebtoken');

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('JWT_SECRET is not configured');
  }

  return secret;
};

const signToken = (user) => jwt.sign(
  {
    userId: user.user_id,
    role: user.role_name
  },
  getJwtSecret(),
  {
    expiresIn: process.env.JWT_EXPIRES_IN || '1d'
  }
);

const verifyToken = (token) => jwt.verify(token, getJwtSecret());

module.exports = {
  signToken,
  verifyToken
};
