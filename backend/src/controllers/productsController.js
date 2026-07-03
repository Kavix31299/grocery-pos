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
  parseNonNegativeNumber,
  parsePositiveInteger,
  requireFields,
  sendItem,
  sendList
} = require('../utils/controllerHelpers');

const PRODUCT_SELECT = `
  SELECT
    p.*,
    c.category_name,
    s.supplier_name
  FROM products p
  JOIN categories c ON c.category_id = p.category_id
  LEFT JOIN suppliers s ON s.supplier_id = p.supplier_id
`;

const parseNullablePositiveInteger = (value, fieldName) => {
  if (value === null || value === '') {
    return null;
  }

  return parsePositiveInteger(value, fieldName);
};

const findProductById = async (productId) => {
  const result = await query(
    `${PRODUCT_SELECT} WHERE p.product_id = $1`,
    [productId]
  );

  return result.rows[0] || null;
};

const listProducts = async (req, res, next) => {
  try {
    const pagination = getPagination(req.query);
    const values = [];
    const filters = [];

    if (req.query.search) {
      values.push(`%${req.query.search.trim()}%`);
      filters.push(`
        (
          p.product_name ILIKE $${values.length}
          OR p.barcode ILIKE $${values.length}
          OR p.sku ILIKE $${values.length}
        )
      `);
    }

    const categoryId = parsePositiveInteger(req.query.categoryId, 'categoryId');

    if (categoryId) {
      values.push(categoryId);
      filters.push(`p.category_id = $${values.length}`);
    }

    const supplierId = parsePositiveInteger(req.query.supplierId, 'supplierId');

    if (supplierId) {
      values.push(supplierId);
      filters.push(`p.supplier_id = $${values.length}`);
    }

    const isActive = parseBoolean(req.query.isActive, 'isActive');

    if (isActive !== null) {
      values.push(isActive);
      filters.push(`p.is_active = $${values.length}`);
    }

    if (parseBoolean(req.query.lowStock, 'lowStock') === true) {
      filters.push('p.current_stock > 0 AND p.current_stock <= p.reorder_level');
    }

    if (parseBoolean(req.query.outOfStock, 'outOfStock') === true) {
      filters.push('p.current_stock = 0');
    }

    const result = await query(
      `
        ${PRODUCT_SELECT}
        ${filters.length ? `WHERE ${filters.join(' AND ')}` : ''}
        ORDER BY p.product_name ASC
        ${appendPagination(values, pagination)}
      `,
      values
    );

    return sendList(res, 'products', result.rows, pagination);
  } catch (error) {
    return next(mapDatabaseError(error));
  }
};

const getProduct = async (req, res, next) => {
  try {
    const productId = parsePositiveInteger(req.params.id, 'productId');
    const product = await findProductById(productId);

    if (!product) {
      throw createHttpError(404, 'Product not found');
    }

    return sendItem(res, 'product', product);
  } catch (error) {
    return next(mapDatabaseError(error));
  }
};

const createProduct = async (req, res, next) => {
  try {
    requireFields(req.body, ['categoryId', 'productName', 'barcode']);

    const result = await query(
      `
        INSERT INTO products (
          category_id,
          supplier_id,
          product_name,
          barcode,
          sku,
          description,
          unit,
          cost_price,
          selling_price,
          current_stock,
          reorder_level,
          is_active
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING product_id
      `,
      [
        parsePositiveInteger(req.body.categoryId, 'categoryId'),
        parseNullablePositiveInteger(req.body.supplierId, 'supplierId'),
        normalizeOptionalString(req.body.productName),
        normalizeOptionalString(req.body.barcode),
        normalizeOptionalString(req.body.sku),
        normalizeOptionalString(req.body.description),
        normalizeOptionalString(req.body.unit) || 'pcs',
        req.body.costPrice === undefined ? 0 : parseNonNegativeNumber(req.body.costPrice, 'costPrice'),
        req.body.sellingPrice === undefined ? 0 : parseNonNegativeNumber(req.body.sellingPrice, 'sellingPrice'),
        req.body.currentStock === undefined ? 0 : parseNonNegativeInteger(req.body.currentStock, 'currentStock'),
        req.body.reorderLevel === undefined ? 0 : parseNonNegativeInteger(req.body.reorderLevel, 'reorderLevel'),
        req.body.isActive === undefined ? true : parseBoolean(req.body.isActive, 'isActive')
      ]
    );

    const product = await findProductById(result.rows[0].product_id);
    return sendItem(res, 'product', product, 201);
  } catch (error) {
    return next(mapDatabaseError(error, {
      unique: 'Product barcode or SKU already exists',
      foreignKey: 'Category or supplier does not exist'
    }));
  }
};

const updateProduct = async (req, res, next) => {
  try {
    const productId = parsePositiveInteger(req.params.id, 'productId');
    const update = buildUpdateQuery({
      table: 'products',
      idColumn: 'product_id',
      idValue: productId,
      fields: [
        { prop: 'categoryId', column: 'category_id', transform: (value) => parsePositiveInteger(value, 'categoryId') },
        { prop: 'supplierId', column: 'supplier_id', transform: (value) => parseNullablePositiveInteger(value, 'supplierId') },
        { prop: 'productName', column: 'product_name', transform: normalizeOptionalString },
        { prop: 'barcode', column: 'barcode', transform: normalizeOptionalString },
        { prop: 'sku', column: 'sku', transform: normalizeOptionalString },
        { prop: 'description', column: 'description', transform: normalizeOptionalString },
        { prop: 'unit', column: 'unit', transform: normalizeOptionalString },
        { prop: 'costPrice', column: 'cost_price', transform: (value) => parseNonNegativeNumber(value, 'costPrice') },
        { prop: 'sellingPrice', column: 'selling_price', transform: (value) => parseNonNegativeNumber(value, 'sellingPrice') },
        { prop: 'currentStock', column: 'current_stock', transform: (value) => parseNonNegativeInteger(value, 'currentStock') },
        { prop: 'reorderLevel', column: 'reorder_level', transform: (value) => parseNonNegativeInteger(value, 'reorderLevel') },
        { prop: 'isActive', column: 'is_active', transform: (value) => parseBoolean(value, 'isActive') }
      ],
      body: req.body,
      returning: 'product_id'
    });

    const result = await query(update.text, update.values);

    if (!result.rows[0]) {
      throw createHttpError(404, 'Product not found');
    }

    const product = await findProductById(result.rows[0].product_id);
    return sendItem(res, 'product', product);
  } catch (error) {
    return next(mapDatabaseError(error, {
      unique: 'Product barcode or SKU already exists',
      foreignKey: 'Category or supplier does not exist'
    }));
  }
};

const deleteProduct = async (req, res, next) => {
  try {
    const productId = parsePositiveInteger(req.params.id, 'productId');
    const result = await query(
      'UPDATE products SET is_active = FALSE WHERE product_id = $1 RETURNING product_id',
      [productId]
    );

    if (!result.rows[0]) {
      throw createHttpError(404, 'Product not found');
    }

    const product = await findProductById(result.rows[0].product_id);
    return sendItem(res, 'product', product);
  } catch (error) {
    return next(mapDatabaseError(error));
  }
};

module.exports = {
  createProduct,
  deleteProduct,
  getProduct,
  listProducts,
  updateProduct
};
