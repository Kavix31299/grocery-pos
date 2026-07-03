const { query } = require('../config/db');
const { generateReferenceNumber } = require('../utils/referenceNumbers');
const { withTransaction } = require('../utils/transactions');
const {
  appendPagination,
  createHttpError,
  getPagination,
  mapDatabaseError,
  normalizeOptionalString,
  parseNonNegativeNumber,
  parsePositiveInteger,
  requireFields,
  sendItem,
  sendList,
  toCamelCase
} = require('../utils/controllerHelpers');

const RETURN_STATUSES = ['Pending', 'Completed', 'Rejected'];

const RETURN_SELECT = `
  SELECT
    r.*,
    s.invoice_number,
    c.customer_name,
    u.full_name AS processed_by_name,
    u.username AS processed_by_username
  FROM returns r
  JOIN sales s ON s.sale_id = r.sale_id
  LEFT JOIN customers c ON c.customer_id = r.customer_id
  JOIN users u ON u.user_id = r.processed_by
`;

const ensureAllowedStatus = (value, allowed, fieldName) => {
  if (!allowed.includes(value)) {
    throw createHttpError(400, `${fieldName} must be one of: ${allowed.join(', ')}`);
  }
};

const findReturnById = async (returnId) => {
  const returnResult = await query(`${RETURN_SELECT} WHERE r.return_id = $1`, [returnId]);

  if (!returnResult.rows[0]) {
    return null;
  }

  const itemsResult = await query(
    `
      SELECT
        ri.*,
        p.product_name,
        p.barcode,
        p.sku
      FROM return_items ri
      JOIN products p ON p.product_id = ri.product_id
      WHERE ri.return_id = $1
      ORDER BY ri.return_item_id ASC
    `,
    [returnId]
  );

  return {
    ...returnResult.rows[0],
    items: itemsResult.rows
  };
};

const listReturns = async (req, res, next) => {
  try {
    const pagination = getPagination(req.query);
    const values = [];
    const filters = [];

    if (req.query.search) {
      values.push(`%${req.query.search.trim()}%`);
      filters.push(`r.return_number ILIKE $${values.length}`);
    }

    const saleId = parsePositiveInteger(req.query.saleId, 'saleId');

    if (saleId) {
      values.push(saleId);
      filters.push(`r.sale_id = $${values.length}`);
    }

    const customerId = parsePositiveInteger(req.query.customerId, 'customerId');

    if (customerId) {
      values.push(customerId);
      filters.push(`r.customer_id = $${values.length}`);
    }

    if (req.query.status) {
      ensureAllowedStatus(req.query.status, RETURN_STATUSES, 'status');
      values.push(req.query.status);
      filters.push(`r.return_status = $${values.length}`);
    }

    if (req.query.dateFrom) {
      values.push(req.query.dateFrom);
      filters.push(`r.return_date >= $${values.length}`);
    }

    if (req.query.dateTo) {
      values.push(req.query.dateTo);
      filters.push(`r.return_date <= $${values.length}`);
    }

    const result = await query(
      `
        ${RETURN_SELECT}
        ${filters.length ? `WHERE ${filters.join(' AND ')}` : ''}
        ORDER BY r.return_date DESC, r.return_id DESC
        ${appendPagination(values, pagination)}
      `,
      values
    );

    return sendList(res, 'returns', result.rows, pagination);
  } catch (error) {
    return next(mapDatabaseError(error));
  }
};

const getReturn = async (req, res, next) => {
  try {
    const returnId = parsePositiveInteger(req.params.id, 'returnId');
    const saleReturn = await findReturnById(returnId);

    if (!saleReturn) {
      throw createHttpError(404, 'Return not found');
    }

    return sendItem(res, 'return', saleReturn);
  } catch (error) {
    return next(mapDatabaseError(error));
  }
};

const normalizeReturnItems = async (client, saleId, rawItems) => {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw createHttpError(400, 'At least one return item is required');
  }

  const items = [];

  for (const [index, item] of rawItems.entries()) {
    requireFields(item, ['quantity']);

    let saleItem = null;

    if (item.saleItemId) {
      const saleItemResult = await client.query(
        `
          SELECT
            si.sale_item_id,
            si.product_id,
            si.unit_price,
            p.product_name
          FROM sale_items si
          JOIN products p ON p.product_id = si.product_id
          WHERE si.sale_item_id = $1
            AND si.sale_id = $2
        `,
        [
          parsePositiveInteger(item.saleItemId, `items[${index}].saleItemId`),
          saleId
        ]
      );
      saleItem = saleItemResult.rows[0];

      if (!saleItem) {
        throw createHttpError(400, `Sale item ${item.saleItemId} does not belong to this sale`);
      }
    }

    if (!saleItem && !item.productId) {
      throw createHttpError(400, `items[${index}].productId is required when saleItemId is not provided`);
    }

    const productId = saleItem
      ? Number(saleItem.product_id)
      : parsePositiveInteger(item.productId, `items[${index}].productId`);
    const quantity = parsePositiveInteger(item.quantity, `items[${index}].quantity`);
    const unitRefundAmount = item.unitRefundAmount === undefined
      ? Number(saleItem ? saleItem.unit_price : 0)
      : parseNonNegativeNumber(item.unitRefundAmount, `items[${index}].unitRefundAmount`);
    const lineRefundAmount = item.lineRefundAmount === undefined
      ? quantity * unitRefundAmount
      : parseNonNegativeNumber(item.lineRefundAmount, `items[${index}].lineRefundAmount`);

    if (!saleItem && item.unitRefundAmount === undefined) {
      throw createHttpError(400, `items[${index}].unitRefundAmount is required when saleItemId is not provided`);
    }

    items.push({
      saleItemId: saleItem ? Number(saleItem.sale_item_id) : null,
      productId,
      quantity,
      unitRefundAmount,
      lineRefundAmount
    });
  }

  return items;
};

const applyReturnStock = async (client, returnId, items, userId, multiplier = 1) => {
  for (const item of items) {
    const productResult = await client.query(
      'SELECT current_stock FROM products WHERE product_id = $1 FOR UPDATE',
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
      throw createHttpError(400, `Product ${item.productId} does not have enough stock to reverse this return`);
    }

    await client.query(
      'UPDATE products SET current_stock = $1 WHERE product_id = $2',
      [newStock, item.productId]
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
        VALUES ($1, 'Return', $2, $3, $4, 'Return', $5, $6, $7)
      `,
      [
        item.productId,
        quantityChanged,
        previousStock,
        newStock,
        returnId,
        multiplier > 0 ? 'Return completed' : 'Return stock reversed',
        userId
      ]
    );
  }
};

const createReturn = async (req, res, next) => {
  try {
    requireFields(req.body, ['saleId', 'items']);

    const returnStatus = req.body.returnStatus || 'Completed';
    ensureAllowedStatus(returnStatus, RETURN_STATUSES, 'returnStatus');

    const returnId = await withTransaction(async (client) => {
      const saleId = parsePositiveInteger(req.body.saleId, 'saleId');
      const saleResult = await client.query(
        'SELECT sale_id, customer_id, total_amount FROM sales WHERE sale_id = $1 FOR UPDATE',
        [saleId]
      );
      const sale = saleResult.rows[0];

      if (!sale) {
        throw createHttpError(400, 'Sale does not exist');
      }

      const items = await normalizeReturnItems(client, saleId, req.body.items);
      const itemRefundAmount = items.reduce((total, item) => total + item.lineRefundAmount, 0);
      const totalRefundAmount = req.body.totalRefundAmount === undefined
        ? itemRefundAmount
        : parseNonNegativeNumber(req.body.totalRefundAmount, 'totalRefundAmount');
      const processedBy = req.body.processedBy
        ? parsePositiveInteger(req.body.processedBy, 'processedBy')
        : req.user.id;

      const returnResult = await client.query(
        `
          INSERT INTO returns (
            return_number,
            sale_id,
            customer_id,
            processed_by,
            return_date,
            reason,
            total_refund_amount,
            return_status
          )
          VALUES ($1, $2, $3, $4, COALESCE($5, CURRENT_TIMESTAMP), $6, $7, $8)
          RETURNING return_id
        `,
        [
          normalizeOptionalString(req.body.returnNumber) || generateReferenceNumber('RET'),
          saleId,
          req.body.customerId ? parsePositiveInteger(req.body.customerId, 'customerId') : sale.customer_id,
          processedBy,
          req.body.returnDate || null,
          normalizeOptionalString(req.body.reason),
          totalRefundAmount,
          returnStatus
        ]
      );
      const newReturnId = returnResult.rows[0].return_id;

      for (const item of items) {
        await client.query(
          `
            INSERT INTO return_items (
              return_id,
              sale_item_id,
              product_id,
              quantity,
              unit_refund_amount,
              line_refund_amount
            )
            VALUES ($1, $2, $3, $4, $5, $6)
          `,
          [
            newReturnId,
            item.saleItemId,
            item.productId,
            item.quantity,
            item.unitRefundAmount,
            item.lineRefundAmount
          ]
        );
      }

      if (returnStatus === 'Completed') {
        await applyReturnStock(client, newReturnId, items, processedBy, 1);

        const salePaymentStatus = Number(totalRefundAmount) >= Number(sale.total_amount)
          ? 'Refunded'
          : null;

        await client.query(
          `
            UPDATE sales
            SET sale_status = 'Returned',
                payment_status = COALESCE($1, payment_status)
            WHERE sale_id = $2
          `,
          [salePaymentStatus, saleId]
        );
      }

      return newReturnId;
    });

    const saleReturn = await findReturnById(returnId);
    return res.status(201).json({ return: toCamelCase(saleReturn) });
  } catch (error) {
    return next(mapDatabaseError(error, {
      unique: 'Return number already exists',
      foreignKey: 'Sale, customer, processor, sale item, or product does not exist'
    }));
  }
};

const updateReturnStatus = async (req, res, next) => {
  try {
    requireFields(req.body, ['returnStatus']);
    ensureAllowedStatus(req.body.returnStatus, RETURN_STATUSES, 'returnStatus');

    const returnId = parsePositiveInteger(req.params.id, 'returnId');

    const updatedReturnId = await withTransaction(async (client) => {
      const returnResult = await client.query(
        'SELECT * FROM returns WHERE return_id = $1 FOR UPDATE',
        [returnId]
      );
      const saleReturn = returnResult.rows[0];

      if (!saleReturn) {
        throw createHttpError(404, 'Return not found');
      }

      if (saleReturn.return_status === req.body.returnStatus) {
        return returnId;
      }

      const itemResult = await client.query(
        'SELECT product_id, quantity FROM return_items WHERE return_id = $1',
        [returnId]
      );
      const items = itemResult.rows.map((item) => ({
        productId: item.product_id,
        quantity: Number(item.quantity)
      }));

      if (saleReturn.return_status !== 'Completed' && req.body.returnStatus === 'Completed') {
        await applyReturnStock(client, returnId, items, req.user.id, 1);
      }

      if (saleReturn.return_status === 'Completed' && req.body.returnStatus !== 'Completed') {
        await applyReturnStock(client, returnId, items, req.user.id, -1);
      }

      await client.query(
        'UPDATE returns SET return_status = $1 WHERE return_id = $2',
        [req.body.returnStatus, returnId]
      );

      return returnId;
    });

    const saleReturn = await findReturnById(updatedReturnId);
    return sendItem(res, 'return', saleReturn);
  } catch (error) {
    return next(mapDatabaseError(error));
  }
};

module.exports = {
  createReturn,
  getReturn,
  listReturns,
  updateReturnStatus
};
