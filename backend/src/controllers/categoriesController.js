const { query } = require('../config/db');
const {
  appendPagination,
  buildUpdateQuery,
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

const listCategories = async (req, res, next) => {
  try {
    const pagination = getPagination(req.query);
    const values = [];
    const filters = [];

    if (req.query.search) {
      values.push(`%${req.query.search.trim()}%`);
      filters.push(`(category_name ILIKE $${values.length} OR description ILIKE $${values.length})`);
    }

    const isActive = parseBoolean(req.query.isActive, 'isActive');

    if (isActive !== null) {
      values.push(isActive);
      filters.push(`is_active = $${values.length}`);
    }

    const sql = `
      SELECT *
      FROM categories
      ${filters.length ? `WHERE ${filters.join(' AND ')}` : ''}
      ORDER BY category_name ASC
      ${appendPagination(values, pagination)}
    `;
    const result = await query(sql, values);

    return sendList(res, 'categories', result.rows, pagination);
  } catch (error) {
    return next(mapDatabaseError(error));
  }
};

const getCategory = async (req, res, next) => {
  try {
    const categoryId = parsePositiveInteger(req.params.id, 'categoryId');
    const result = await query(
      'SELECT * FROM categories WHERE category_id = $1',
      [categoryId]
    );

    if (!result.rows[0]) {
      throw createHttpError(404, 'Category not found');
    }

    return sendItem(res, 'category', result.rows[0]);
  } catch (error) {
    return next(mapDatabaseError(error));
  }
};

const createCategory = async (req, res, next) => {
  try {
    requireFields(req.body, ['categoryName']);

    const isActive = req.body.isActive === undefined
      ? true
      : parseBoolean(req.body.isActive, 'isActive');

    const result = await query(
      `
        INSERT INTO categories (category_name, description, is_active)
        VALUES ($1, $2, $3)
        RETURNING *
      `,
      [
        normalizeOptionalString(req.body.categoryName),
        normalizeOptionalString(req.body.description),
        isActive
      ]
    );

    return sendItem(res, 'category', result.rows[0], 201);
  } catch (error) {
    return next(mapDatabaseError(error, {
      unique: 'Category name already exists'
    }));
  }
};

const updateCategory = async (req, res, next) => {
  try {
    const categoryId = parsePositiveInteger(req.params.id, 'categoryId');
    const update = buildUpdateQuery({
      table: 'categories',
      idColumn: 'category_id',
      idValue: categoryId,
      fields: [
        { prop: 'categoryName', column: 'category_name', transform: normalizeOptionalString },
        { prop: 'description', column: 'description', transform: normalizeOptionalString },
        { prop: 'isActive', column: 'is_active', transform: (value) => parseBoolean(value, 'isActive') }
      ],
      body: req.body
    });

    const result = await query(update.text, update.values);

    if (!result.rows[0]) {
      throw createHttpError(404, 'Category not found');
    }

    return sendItem(res, 'category', result.rows[0]);
  } catch (error) {
    return next(mapDatabaseError(error, {
      unique: 'Category name already exists'
    }));
  }
};

const deleteCategory = async (req, res, next) => {
  try {
    const categoryId = parsePositiveInteger(req.params.id, 'categoryId');
    const result = await query(
      'UPDATE categories SET is_active = FALSE WHERE category_id = $1 RETURNING *',
      [categoryId]
    );

    if (!result.rows[0]) {
      throw createHttpError(404, 'Category not found');
    }

    return sendItem(res, 'category', result.rows[0]);
  } catch (error) {
    return next(mapDatabaseError(error));
  }
};

module.exports = {
  createCategory,
  deleteCategory,
  getCategory,
  listCategories,
  updateCategory
};
