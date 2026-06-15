const bcrypt = require('bcrypt');
const {
  countUsers,
  createUser,
  findUserByLogin,
  findUserById,
  toPublicUser,
  updateLastLogin
} = require('../services/authService');
const { signToken } = require('../utils/jwt');
const { ROLES, ROLE_ACCESS, isValidRole } = require('../utils/roles');

const requiredFields = ['fullName', 'username', 'email', 'password'];

const missingRequiredFields = (body) => requiredFields.filter((field) => !body[field]);

const register = async (req, res, next) => {
  try {
    const missingFields = missingRequiredFields(req.body);

    if (missingFields.length > 0) {
      return res.status(400).json({
        message: 'Missing required fields',
        fields: missingFields
      });
    }

    if (req.body.password.length < 8) {
      return res.status(400).json({
        message: 'Password must be at least 8 characters long'
      });
    }

    const totalUsers = await countUsers();
    const requestedRole = req.body.role || ROLES.CASHIER;
    const roleName = totalUsers === 0 ? ROLES.ADMIN : requestedRole;

    if (!isValidRole(roleName)) {
      return res.status(400).json({
        message: 'Role must be Admin, Manager, or Cashier'
      });
    }

    if (totalUsers > 0 && (!req.user || req.user.role !== ROLES.ADMIN)) {
      return res.status(403).json({
        message: 'Only Admin users can register new users'
      });
    }

    const user = await createUser({
      fullName: req.body.fullName,
      username: req.body.username,
      email: req.body.email,
      password: req.body.password,
      phone: req.body.phone,
      roleName
    });

    return res.status(201).json({
      message: 'User registered successfully',
      user: toPublicUser(user)
    });
  } catch (error) {
    return next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { login: loginName, password } = req.body;

    if (!loginName || !password) {
      return res.status(400).json({
        message: 'Login and password are required'
      });
    }

    const user = await findUserByLogin(loginName);

    if (!user || !user.is_active) {
      return res.status(401).json({
        message: 'Invalid login credentials'
      });
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatches) {
      return res.status(401).json({
        message: 'Invalid login credentials'
      });
    }

    await updateLastLogin(user.user_id);
    const refreshedUser = await findUserById(user.user_id);
    const publicUser = toPublicUser(refreshedUser);
    const token = signToken(refreshedUser);

    return res.json({
      message: 'Login successful',
      token,
      user: publicUser,
      access: ROLE_ACCESS[publicUser.role] || []
    });
  } catch (error) {
    return next(error);
  }
};

const getProfile = async (req, res) => res.json({
  user: req.user,
  access: ROLE_ACCESS[req.user.role] || []
});

module.exports = {
  register,
  login,
  getProfile
};
