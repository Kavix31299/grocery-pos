const { query } = require('../config/db');
const {
  createUser,
  toPublicUser
} = require('../services/authService');
const { isValidRole } = require('../utils/roles');
const {
  appendPagination,
  createHttpError,
  getPagination,
  mapDatabaseError,
  normalizeOptionalString,
  parseBoolean,
  parsePositiveInteger,
  requireFields,
  sendItem,
  sendList
} = require('../utils/controllerHelpers');

const USER_SELECT = `
  SELECT
    u.user_id,
    u.role_id,
    r.role_name,
    u.full_name,
    u.username,
    u.email,
    u.phone,
    u.is_active,
    u.last_login_at,
    u.created_at,
    u.updated_at
  FROM users u
  JOIN roles r ON r.role_id = u.role_id
`;

const findPublicUserById = async (userId) => {
  const result = await query(`${USER_SELECT} WHERE u.user_id = $1`, [userId]);
  return result.rows[0] || null;
};

const listUsers = async (req, res, next) => {
  try {
    const pagination = getPagination(req.query);
    const values = [];
    const filters = [];

    if (req.query.search) {
      values.push(`%${req.query.search.trim()}%`);
      filters.push(`
        (
          u.full_name ILIKE $${values.length}
          OR u.username ILIKE $${values.length}
          OR u.email ILIKE $${values.length}
        )
      `);
    }

    if (req.query.role) {
      if (!isValidRole(req.query.role)) {
        throw createHttpError(400, 'Role must be Admin, Manager, or Cashier');
      }

      values.push(req.query.role);
      filters.push(`r.role_name = $${values.length}`);
    }

    const isActive = parseBoolean(req.query.isActive, 'isActive');

    if (isActive !== null) {
      values.push(isActive);
      filters.push(`u.is_active = $${values.length}`);
    }

    const result = await query(
      `
        ${USER_SELECT}
        ${filters.length ? `WHERE ${filters.join(' AND ')}` : ''}
        ORDER BY u.created_at DESC
        ${appendPagination(values, pagination)}
      `,
      values
    );

    return sendList(res, 'users', result.rows, pagination);
  } catch (error) {
    return next(mapDatabaseError(error));
  }
};

const getUser = async (req, res, next) => {
  try {
    const userId = parsePositiveInteger(req.params.id, 'userId');
    const user = await findPublicUserById(userId);

    if (!user) {
      throw createHttpError(404, 'User not found');
    }

    return sendItem(res, 'user', user);
  } catch (error) {
    return next(mapDatabaseError(error));
  }
};

const createManagedUser = async (req, res, next) => {
  try {
    requireFields(req.body, ['fullName', 'username', 'email', 'password', 'role']);

    if (req.body.password.length < 8) {
      throw createHttpError(400, 'Password must be at least 8 characters long');
    }

    if (!isValidRole(req.body.role)) {
      throw createHttpError(400, 'Role must be Admin, Manager, or Cashier');
    }

    const user = await createUser({
      fullName: req.body.fullName,
      username: req.body.username,
      email: req.body.email,
      password: req.body.password,
      phone: req.body.phone,
      roleName: req.body.role
    });

    return res.status(201).json({
      user: toPublicUser(user)
    });
  } catch (error) {
    return next(mapDatabaseError(error, {
      unique: 'Username or email already exists'
    }));
  }
};

const updateUser = async (req, res, next) => {
  try {
    const userId = parsePositiveInteger(req.params.id, 'userId');
    const values = [];
    const assignments = [];

    const addField = (column, value) => {
      values.push(value);
      assignments.push(`${column} = $${values.length}`);
    };

    if (req.body.fullName !== undefined) {
      addField('full_name', normalizeOptionalString(req.body.fullName));
    }

    if (req.body.username !== undefined) {
      addField('username', normalizeOptionalString(req.body.username));
    }

    if (req.body.email !== undefined) {
      addField('email', normalizeOptionalString(req.body.email));
    }

    if (req.body.phone !== undefined) {
      addField('phone', normalizeOptionalString(req.body.phone));
    }

    if (req.body.isActive !== undefined) {
      addField('is_active', parseBoolean(req.body.isActive, 'isActive'));
    }

    if (req.body.role !== undefined) {
      if (!isValidRole(req.body.role)) {
        throw createHttpError(400, 'Role must be Admin, Manager, or Cashier');
      }

      values.push(req.body.role);
      assignments.push(`role_id = (SELECT role_id FROM roles WHERE role_name = $${values.length})`);
    }

    if (assignments.length === 0) {
      throw createHttpError(400, 'No valid fields provided for update');
    }

    values.push(userId);
    const result = await query(
      `
        UPDATE users
        SET ${assignments.join(', ')}
        WHERE user_id = $${values.length}
        RETURNING user_id
      `,
      values
    );

    if (!result.rows[0]) {
      throw createHttpError(404, 'User not found');
    }

    const user = await findPublicUserById(result.rows[0].user_id);
    return sendItem(res, 'user', user);
  } catch (error) {
    return next(mapDatabaseError(error, {
      unique: 'Username or email already exists'
    }));
  }
};

const deactivateUser = async (req, res, next) => {
  try {
    const userId = parsePositiveInteger(req.params.id, 'userId');
    const result = await query(
      'UPDATE users SET is_active = FALSE WHERE user_id = $1 RETURNING user_id',
      [userId]
    );

    if (!result.rows[0]) {
      throw createHttpError(404, 'User not found');
    }

    const user = await findPublicUserById(result.rows[0].user_id);
    return sendItem(res, 'user', user);
  } catch (error) {
    return next(mapDatabaseError(error));
  }
};

module.exports = {
  createManagedUser,
  deactivateUser,
  getUser,
  listUsers,
  updateUser
};
