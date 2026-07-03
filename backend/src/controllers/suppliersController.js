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

const listSuppliers = async (req, res, next) => {
  try {
    const pagination = getPagination(req.query);
    const values = [];
    const filters = [];

    if (req.query.search) {
      values.push(`%${req.query.search.trim()}%`);
      filters.push(`
        (
          supplier_name ILIKE $${values.length}
          OR contact_person ILIKE $${values.length}
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
        FROM suppliers
        ${filters.length ? `WHERE ${filters.join(' AND ')}` : ''}
        ORDER BY supplier_name ASC
        ${appendPagination(values, pagination)}
      `,
      values
    );

    return sendList(res, 'suppliers', result.rows, pagination);
  } catch (error) {
    return next(mapDatabaseError(error));
  }
};

const getSupplier = async (req, res, next) => {
  try {
    const supplierId = parsePositiveInteger(req.params.id, 'supplierId');
    const result = await query('SELECT * FROM suppliers WHERE supplier_id = $1', [supplierId]);

    if (!result.rows[0]) {
      throw createHttpError(404, 'Supplier not found');
    }

    return sendItem(res, 'supplier', result.rows[0]);
  } catch (error) {
    return next(mapDatabaseError(error));
  }
};

const createSupplier = async (req, res, next) => {
  try {
    requireFields(req.body, ['supplierName']);

    const isActive = req.body.isActive === undefined
      ? true
      : parseBoolean(req.body.isActive, 'isActive');

    const result = await query(
      `
        INSERT INTO suppliers (
          supplier_name,
          contact_person,
          phone,
          email,
          address,
          is_active
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `,
      [
        normalizeOptionalString(req.body.supplierName),
        normalizeOptionalString(req.body.contactPerson),
        normalizeOptionalString(req.body.phone),
        normalizeOptionalString(req.body.email),
        normalizeOptionalString(req.body.address),
        isActive
      ]
    );

    return sendItem(res, 'supplier', result.rows[0], 201);
  } catch (error) {
    return next(mapDatabaseError(error, {
      unique: 'Supplier email already exists'
    }));
  }
};

const updateSupplier = async (req, res, next) => {
  try {
    const supplierId = parsePositiveInteger(req.params.id, 'supplierId');
    const update = buildUpdateQuery({
      table: 'suppliers',
      idColumn: 'supplier_id',
      idValue: supplierId,
      fields: [
        { prop: 'supplierName', column: 'supplier_name', transform: normalizeOptionalString },
        { prop: 'contactPerson', column: 'contact_person', transform: normalizeOptionalString },
        { prop: 'phone', column: 'phone', transform: normalizeOptionalString },
        { prop: 'email', column: 'email', transform: normalizeOptionalString },
        { prop: 'address', column: 'address', transform: normalizeOptionalString },
        { prop: 'isActive', column: 'is_active', transform: (value) => parseBoolean(value, 'isActive') }
      ],
      body: req.body
    });

    const result = await query(update.text, update.values);

    if (!result.rows[0]) {
      throw createHttpError(404, 'Supplier not found');
    }

    return sendItem(res, 'supplier', result.rows[0]);
  } catch (error) {
    return next(mapDatabaseError(error, {
      unique: 'Supplier email already exists'
    }));
  }
};

const deleteSupplier = async (req, res, next) => {
  try {
    const supplierId = parsePositiveInteger(req.params.id, 'supplierId');
    const result = await query(
      'UPDATE suppliers SET is_active = FALSE WHERE supplier_id = $1 RETURNING *',
      [supplierId]
    );

    if (!result.rows[0]) {
      throw createHttpError(404, 'Supplier not found');
    }

    return sendItem(res, 'supplier', result.rows[0]);
  } catch (error) {
    return next(mapDatabaseError(error));
  }
};

module.exports = {
  createSupplier,
  deleteSupplier,
  getSupplier,
  listSuppliers,
  updateSupplier
};
