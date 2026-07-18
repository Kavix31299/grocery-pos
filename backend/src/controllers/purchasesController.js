const { query } = require('../config/db');
const { withTransaction } = require('../utils/transactions');
const { generateReferenceNumber } = require('../utils/referenceNumbers');
const {
  appendPagination,
  createHttpError,
  getPagination,
  mapDatabaseError,
  normalizeOptionalString,
  parseNonNegativeNumber,
  parsePositiveInteger,
  parsePositiveNumber,
  requireFields,
  sendItem,
  sendList,
  toCamelCase
} = require('../utils/controllerHelpers');

const PURCHASE_STATUSES = ['Ordered', 'Received', 'Cancelled'];

const PURCHASE_SELECT = `
  SELECT
    p.*,
    s.supplier_name,
    u.full_name AS received_by_name,
    u.username AS received_by_username
  FROM purchases p
  JOIN suppliers s ON s.supplier_id = p.supplier_id
  JOIN users u ON u.user_id = p.received_by
`;

const ensureAllowedStatus = (value, allowed, fieldName) => {
  if (!allowed.includes(value)) {
    throw createHttpError(400, `${fieldName} must be one of: ${allowed.join(', ')}`);
  }
};

const findPurchaseById = async (purchaseId) => {
  const purchaseResult = await query(
    `${PURCHASE_SELECT} WHERE p.purchase_id = $1`,
    [purchaseId]
  );

  if (!purchaseResult.rows[0]) {
    return null;
  }

  const itemsResult = await query(
    `
      SELECT
        pi.*,
        pr.product_name,
        pr.barcode,
        pr.sku
      FROM purchase_items pi
      JOIN products pr ON pr.product_id = pi.product_id
      WHERE pi.purchase_id = $1
      ORDER BY pi.purchase_item_id ASC
    `,
    [purchaseId]
  );

  return {
    ...purchaseResult.rows[0],
    items: itemsResult.rows
  };
};

const listPurchases = async (req, res, next) => {
  try {
    const pagination = getPagination(req.query);
    const values = [];
    const filters = [];

    if (req.query.search) {
      values.push(`%${req.query.search.trim()}%`);
      filters.push(`p.purchase_number ILIKE $${values.length}`);
    }

    const supplierId = parsePositiveInteger(req.query.supplierId, 'supplierId');

    if (supplierId) {
      values.push(supplierId);
      filters.push(`p.supplier_id = $${values.length}`);
    }

    if (req.query.status) {
      ensureAllowedStatus(req.query.status, PURCHASE_STATUSES, 'status');
      values.push(req.query.status);
      filters.push(`p.purchase_status = $${values.length}`);
    }

    if (req.query.dateFrom) {
      values.push(req.query.dateFrom);
      filters.push(`p.purchase_date >= $${values.length}`);
    }

    if (req.query.dateTo) {
      values.push(req.query.dateTo);
      filters.push(`p.purchase_date <= $${values.length}`);
    }

    const result = await query(
      `
        ${PURCHASE_SELECT}
        ${filters.length ? `WHERE ${filters.join(' AND ')}` : ''}
        ORDER BY p.purchase_date DESC, p.purchase_id DESC
        ${appendPagination(values, pagination)}
      `,
      values
    );

    return sendList(res, 'purchases', result.rows, pagination);
  } catch (error) {
    return next(mapDatabaseError(error));
  }
};

const getPurchase = async (req, res, next) => {
  try {
    const purchaseId = parsePositiveInteger(req.params.id, 'purchaseId');
    const purchase = await findPurchaseById(purchaseId);

    if (!purchase) {
      throw createHttpError(404, 'Purchase not found');
    }

    return sendItem(res, 'purchase', purchase);
  } catch (error) {
    return next(mapDatabaseError(error));
  }
};

const normalizePurchaseItems = async (client, rawItems) => {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw createHttpError(400, 'At least one purchase item is required');
  }

  const items = [];

  for (const [index, item] of rawItems.entries()) {
    requireFields(item, ['productId', 'quantity']);

    const productId = parsePositiveInteger(item.productId, `items[${index}].productId`);
    const productResult = await client.query(
      'SELECT product_id, product_name, cost_price, current_stock FROM products WHERE product_id = $1 FOR UPDATE',
      [productId]
    );
    const product = productResult.rows[0];

    if (!product) {
      throw createHttpError(400, `Product ${productId} does not exist`);
    }

    const quantity = parsePositiveNumber(item.quantity, `items[${index}].quantity`);
    const unitCost = item.unitCost === undefined
      ? Number(product.cost_price)
      : parseNonNegativeNumber(item.unitCost, `items[${index}].unitCost`);
    const lineTotal = item.lineTotal === undefined
      ? quantity * unitCost
      : parseNonNegativeNumber(item.lineTotal, `items[${index}].lineTotal`);

    items.push({
      product,
      productId,
      batchNumber: normalizeOptionalString(item.batchNumber),
      quantity,
      unitCost,
      lineTotal,
      manufacturedDate: item.manufacturedDate || null,
      expiryDate: item.expiryDate || null
    });
  }

  return items;
};

const applyPurchaseStock = async (client, purchaseId, items, userId, multiplier = 1) => {
  for (const item of items) {
    const productResult = await client.query(
      'SELECT product_id, current_stock FROM products WHERE product_id = $1 FOR UPDATE',
      [item.productId]
    );
    const product = productResult.rows[0];

    if (!product) {
      throw createHttpError(400, `Product ${item.productId} does not exist`);
    }

    const previousStock = Number(product.current_stock);
    const quantityChanged = item.quantity * multiplier;
    const newStock = previousStock + quantityChanged;

    if (newStock < 0) {
      throw createHttpError(400, `Product ${item.productId} does not have enough stock to reverse this purchase`);
    }

    await client.query(
      'UPDATE products SET current_stock = $1, cost_price = $2 WHERE product_id = $3',
      [newStock, item.unitCost, item.productId]
    );

    await client.query(
      `
        INSERT INTO stock_movements (
          product_id,
          movement_type,
          quantity_changed,
          previous_stock,
          new_stock,
          reference_type,
          reference_id,
          notes,
          created_by
        )
        VALUES ($1, 'Purchase', $2, $3, $4, 'Purchase', $5, $6, $7)
      `,
      [
        item.productId,
        quantityChanged,
        previousStock,
        newStock,
        multiplier > 0 ? purchaseId : purchaseId,
        multiplier > 0 ? 'Purchase received' : 'Purchase stock reversed',
        userId
      ]
    );
  }
};

const createPurchase = async (req, res, next) => {
  try {
    requireFields(req.body, ['supplierId', 'items']);

    const purchaseStatus = req.body.purchaseStatus || 'Received';
    ensureAllowedStatus(purchaseStatus, PURCHASE_STATUSES, 'purchaseStatus');

    const purchaseId = await withTransaction(async (client) => {
      const items = await normalizePurchaseItems(client, req.body.items);
      const itemSubtotal = items.reduce((total, item) => total + item.lineTotal, 0);
      const subtotalAmount = req.body.subtotalAmount === undefined
        ? itemSubtotal
        : parseNonNegativeNumber(req.body.subtotalAmount, 'subtotalAmount');
      const discountAmount = req.body.discountAmount === undefined
        ? 0
        : parseNonNegativeNumber(req.body.discountAmount, 'discountAmount');
      const taxAmount = req.body.taxAmount === undefined
        ? 0
        : parseNonNegativeNumber(req.body.taxAmount, 'taxAmount');
      const totalAmount = req.body.totalAmount === undefined
        ? subtotalAmount - discountAmount + taxAmount
        : parseNonNegativeNumber(req.body.totalAmount, 'totalAmount');
      const amountPaid = req.body.amountPaid === undefined
        ? 0
        : parseNonNegativeNumber(req.body.amountPaid, 'amountPaid');
      const balanceAmount = req.body.balanceAmount === undefined
        ? Math.max(totalAmount - amountPaid, 0)
        : parseNonNegativeNumber(req.body.balanceAmount, 'balanceAmount');
      const receivedBy = req.body.receivedBy
        ? parsePositiveInteger(req.body.receivedBy, 'receivedBy')
        : req.user.id;

      const purchaseResult = await client.query(
        `
          INSERT INTO purchases (
            purchase_number,
            supplier_id,
            received_by,
            purchase_date,
            subtotal_amount,
            discount_amount,
            tax_amount,
            total_amount,
            amount_paid,
            balance_amount,
            purchase_status,
            notes
          )
          VALUES ($1, $2, $3, COALESCE($4, CURRENT_TIMESTAMP), $5, $6, $7, $8, $9, $10, $11, $12)
          RETURNING purchase_id
        `,
        [
          normalizeOptionalString(req.body.purchaseNumber) || generateReferenceNumber('PUR'),
          parsePositiveInteger(req.body.supplierId, 'supplierId'),
          receivedBy,
          req.body.purchaseDate || null,
          subtotalAmount,
          discountAmount,
          taxAmount,
          totalAmount,
          amountPaid,
          balanceAmount,
          purchaseStatus,
          normalizeOptionalString(req.body.notes)
        ]
      );
      const newPurchaseId = purchaseResult.rows[0].purchase_id;

      for (const item of items) {
        await client.query(
          `
            INSERT INTO purchase_items (
              purchase_id,
              product_id,
              batch_number,
              quantity,
              unit_cost,
              line_total,
              manufactured_date,
              expiry_date
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `,
          [
            newPurchaseId,
            item.productId,
            item.batchNumber,
            item.quantity,
            item.unitCost,
            item.lineTotal,
            item.manufacturedDate,
            item.expiryDate
          ]
        );
      }

      if (purchaseStatus === 'Received') {
        await applyPurchaseStock(client, newPurchaseId, items, receivedBy, 1);
      }

      return newPurchaseId;
    });

    const purchase = await findPurchaseById(purchaseId);
    return res.status(201).json({ purchase: toCamelCase(purchase) });
  } catch (error) {
    return next(mapDatabaseError(error, {
      unique: 'Purchase number already exists',
      foreignKey: 'Supplier, receiver, or product does not exist'
    }));
  }
};

const updatePurchaseStatus = async (req, res, next) => {
  try {
    requireFields(req.body, ['purchaseStatus']);
    ensureAllowedStatus(req.body.purchaseStatus, PURCHASE_STATUSES, 'purchaseStatus');

    const purchaseId = parsePositiveInteger(req.params.id, 'purchaseId');

    const updatedPurchaseId = await withTransaction(async (client) => {
      const purchaseResult = await client.query(
        'SELECT * FROM purchases WHERE purchase_id = $1 FOR UPDATE',
        [purchaseId]
      );
      const purchase = purchaseResult.rows[0];

      if (!purchase) {
        throw createHttpError(404, 'Purchase not found');
      }

      if (purchase.purchase_status === req.body.purchaseStatus) {
        return purchaseId;
      }

      const itemResult = await client.query(
        'SELECT product_id, quantity, unit_cost FROM purchase_items WHERE purchase_id = $1',
        [purchaseId]
      );
      const items = itemResult.rows.map((item) => ({
        productId: item.product_id,
        quantity: Number(item.quantity),
        unitCost: Number(item.unit_cost)
      }));

      if (purchase.purchase_status !== 'Received' && req.body.purchaseStatus === 'Received') {
        await applyPurchaseStock(client, purchaseId, items, req.user.id, 1);
      }

      if (purchase.purchase_status === 'Received' && req.body.purchaseStatus === 'Cancelled') {
        await applyPurchaseStock(client, purchaseId, items, req.user.id, -1);
      }

      await client.query(
        'UPDATE purchases SET purchase_status = $1 WHERE purchase_id = $2',
        [req.body.purchaseStatus, purchaseId]
      );

      return purchaseId;
    });

    const purchase = await findPurchaseById(updatedPurchaseId);
    return sendItem(res, 'purchase', purchase);
  } catch (error) {
    return next(mapDatabaseError(error));
  }
};

module.exports = {
  createPurchase,
  getPurchase,
  listPurchases,
  updatePurchaseStatus
};
