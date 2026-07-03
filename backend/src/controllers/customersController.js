const { query } = require('../config/db');
const {
  appendPagination,
  buildUpdateQuery,
  createHttpError,
  getPagination,
  mapDatabaseError,
  normalizeOptionalString,
  parseBoolean,
  parseNonNegativeInteger,
  parsePositiveInteger,
  requireFields,
  sendItem,
  sendList
} = require('../utils/controllerHelpers');

const listCustomers = async (req, res, next) => {
  try {
    const pagination = getPagination(req.query);
    const values = [];
    const filters = [];

    if (req.query.search) {
      values.push(`%${req.query.search.trim()}%`);
      filters.push(`
        (
          customer_name ILIKE $${values.length}
          OR phone ILIKE $${values.length}
          OR email ILIKE $${values.length}
        )
      `);
    }

    const isActive = parseBoolean(req.query.isActive, 'isActive');

    if (isActive !== null) {
      values.push(isActive);
      filters.push(`is_active = $${values.length}`);
    }

    const result = await query(
      `
        SELECT *
        FROM customers
        ${filters.length ? `WHERE ${filters.join(' AND ')}` : ''}
        ORDER BY customer_name ASC
        ${appendPagination(values, pagination)}
      `,
      values
    );

    return sendList(res, 'customers', result.rows, pagination);
  } catch (error) {
    return next(mapDatabaseError(error));
  }
};

const getCustomer = async (req, res, next) => {
  try {
    const customerId = parsePositiveInteger(req.params.id, 'customerId');
    const result = await query('SELECT * FROM customers WHERE customer_id = $1', [customerId]);

    if (!result.rows[0]) {
      throw createHttpError(404, 'Customer not found');
    }

    return sendItem(res, 'customer', result.rows[0]);
  } catch (error) {
    return next(mapDatabaseError(error));
  }
};

const createCustomer = async (req, res, next) => {
  try {
    requireFields(req.body, ['customerName']);

    const isActive = req.body.isActive === undefined
      ? true
      : parseBoolean(req.body.isActive, 'isActive');

    const result = await query(
      `
        INSERT INTO customers (
          customer_name,
          phone,
          email,
          address,
          loyalty_points,
          is_active
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `,
      [
        normalizeOptionalString(req.body.customerName),
        normalizeOptionalString(req.body.phone),
        normalizeOptionalString(req.body.email),
        normalizeOptionalString(req.body.address),
        req.body.loyaltyPoints === undefined ? 0 : parseNonNegativeInteger(req.body.loyaltyPoints, 'loyaltyPoints'),
        isActive
      ]
    );

    return sendItem(res, 'customer', result.rows[0], 201);
  } catch (error) {
    return next(mapDatabaseError(error, {
      unique: 'Customer phone or email already exists'
    }));
  }
};

const updateCustomer = async (req, res, next) => {
  try {
    const customerId = parsePositiveInteger(req.params.id, 'customerId');
    const update = buildUpdateQuery({
      table: 'customers',
      idColumn: 'customer_id',
      idValue: customerId,
      fields: [
        { prop: 'customerName', column: 'customer_name', transform: normalizeOptionalString },
        { prop: 'phone', column: 'phone', transform: normalizeOptionalString },
        { prop: 'email', column: 'email', transform: normalizeOptionalString },
        { prop: 'address', column: 'address', transform: normalizeOptionalString },
        { prop: 'loyaltyPoints', column: 'loyalty_points', transform: (value) => parseNonNegativeInteger(value, 'loyaltyPoints') },
        { prop: 'isActive', column: 'is_active', transform: (value) => parseBoolean(value, 'isActive') }
      ],
      body: req.body
    });

    const result = await query(update.text, update.values);

    if (!result.rows[0]) {
      throw createHttpError(404, 'Customer not found');
    }

    return sendItem(res, 'customer', result.rows[0]);
  } catch (error) {
    return next(mapDatabaseError(error, {
      unique: 'Customer phone or email already exists'
    }));
  }
};

const deleteCustomer = async (req, res, next) => {
  try {
    const customerId = parsePositiveInteger(req.params.id, 'customerId');
    const result = await query(
      'UPDATE customers SET is_active = FALSE WHERE customer_id = $1 RETURNING *',
      [customerId]
    );

    if (!result.rows[0]) {
      throw createHttpError(404, 'Customer not found');
    }

    return sendItem(res, 'customer', result.rows[0]);
  } catch (error) {
    return next(mapDatabaseError(error));
  }
};

module.exports = {
  createCustomer,
  deleteCustomer,
  getCustomer,
  listCustomers,
  updateCustomer
};
