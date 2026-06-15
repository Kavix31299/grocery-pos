const bcrypt = require('bcrypt');
const { query } = require('../config/db');

const USER_SELECT = `
  SELECT
    u.user_id,
    u.role_id,
    r.role_name,
    u.full_name,
    u.username,
    u.email,
    u.password_hash,
    u.phone,
    u.is_active,
    u.last_login_at,
    u.created_at,
    u.updated_at
  FROM users u
  JOIN roles r ON r.role_id = u.role_id
`;

const toPublicUser = (user) => ({
  id: user.user_id,
  role: user.role_name,
  fullName: user.full_name,
  username: user.username,
  email: user.email,
  phone: user.phone,
  isActive: user.is_active,
  lastLoginAt: user.last_login_at,
  createdAt: user.created_at,
  updatedAt: user.updated_at
});

const countUsers = async () => {
  const result = await query('SELECT COUNT(*)::integer AS total FROM users');
  return result.rows[0].total;
};

const findRoleByName = async (roleName) => {
  const result = await query(
    'SELECT role_id, role_name FROM roles WHERE role_name = $1',
    [roleName]
  );

  return result.rows[0] || null;
};

const findUserById = async (userId) => {
  const result = await query(`${USER_SELECT} WHERE u.user_id = $1`, [userId]);
  return result.rows[0] || null;
};

const findUserByLogin = async (login) => {
  const normalizedLogin = login.trim().toLowerCase();

  const result = await query(
    `${USER_SELECT} WHERE LOWER(u.username) = $1 OR LOWER(u.email) = $1`,
    [normalizedLogin]
  );

  return result.rows[0] || null;
};

const createUser = async ({
  fullName,
  username,
  email,
  password,
  phone,
  roleName
}) => {
  const role = await findRoleByName(roleName);

  if (!role) {
    const error = new Error('Invalid role');
    error.status = 400;
    throw error;
  }

  const passwordHash = await bcrypt.hash(password, Number(process.env.BCRYPT_SALT_ROUNDS || 12));

  try {
    const result = await query(
      `
        INSERT INTO users (
          role_id,
          full_name,
          username,
          email,
          password_hash,
          phone
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING user_id
      `,
      [
        role.role_id,
        fullName.trim(),
        username.trim(),
        email.trim().toLowerCase(),
        passwordHash,
        phone ? phone.trim() : null
      ]
    );

    return findUserById(result.rows[0].user_id);
  } catch (error) {
    if (error.code === '23505') {
      const conflict = new Error('Username or email already exists');
      conflict.status = 409;
      throw conflict;
    }

    throw error;
  }
};

const updateLastLogin = async (userId) => {
  await query(
    'UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE user_id = $1',
    [userId]
  );
};

module.exports = {
  countUsers,
  createUser,
  findUserById,
  findUserByLogin,
  toPublicUser,
  updateLastLogin
};
