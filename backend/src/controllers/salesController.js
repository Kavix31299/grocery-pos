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
  parsePositiveNumber,
  requireFields,
  sendItem,
  sendList,
  toCamelCase
} = require('../utils/controllerHelpers');

const SALE_STATUSES = ['Draft', 'Completed', 'Cancelled', 'Returned'];
const PAYMENT_STATUSES = ['Unpaid', 'Partial', 'Paid', 'Refunded'];
const PAYMENT_METHODS = ['Cash', 'Card', 'Bank Transfer', 'QR Payment', 'Split Payment'];

const SALE_SELECT = `
  SELECT
    s.*,
    c.customer_name,
    u.full_name AS cashier_name,
    u.username AS cashier_username
  FROM sales s
  LEFT JOIN customers c ON c.customer_id = s.customer_id
  JOIN users u ON u.user_id = s.cashier_id
`;

const ensureAllowedValue = (value, allowed, fieldName) => {
  if (!allowed.includes(value)) {
    throw createHttpError(400, `${fieldName} must be one of: ${allowed.join(', ')}`);
  }
};

const findSaleById = async (saleId) => {
  const saleResult = await query(`${SALE_SELECT} WHERE s.sale_id = $1`, [saleId]);

  if (!saleResult.rows[0]) {
    return null;
  }

  const itemsResult = await query(
    `
      SELECT
        si.*,
        p.product_name,
        p.barcode,
        p.sku
      FROM sale_items si
      JOIN products p ON p.product_id = si.product_id
      WHERE si.sale_id = $1
      ORDER BY si.sale_item_id ASC
    `,
    [saleId]
  );
  const paymentsResult = await query(
    `
      SELECT
        pay.*,
        u.full_name AS received_by_name,
        u.username AS received_by_username
      FROM payments pay
      JOIN users u ON u.user_id = pay.received_by
      WHERE pay.sale_id = $1
      ORDER BY pay.paid_at ASC, pay.payment_id ASC
    `,
    [saleId]
  );

  return {
    ...saleResult.rows[0],
    items: itemsResult.rows,
    payments: paymentsResult.rows
  };
};

const findInvoiceBySaleId = async (saleId) => {
  const sale = await findSaleById(saleId);

  if (!sale) {
    return null;
  }

  const settingsResult = await query(
    `
      SELECT
        store_name,
        address,
        phone,
        email,
        currency_code,
        tax_rate,
        receipt_footer,
        printer_enabled,
        printer_host,
        printer_port,
        printer_device_id,
        printer_use_ssl,
        printer_buffer
      FROM store_settings
      WHERE setting_id = 1
    `
  );
  const stockMovementsResult = await query(
    `
      SELECT
        sm.stock_movement_id,
        sm.product_id,
        p.product_name,
        sm.quantity_changed,
        sm.previous_stock,
        sm.new_stock,
        sm.created_at
      FROM stock_movements sm
      JOIN products p ON p.product_id = sm.product_id
      WHERE sm.reference_type = 'Sale'
        AND sm.reference_id = $1
      ORDER BY sm.stock_movement_id ASC
    `,
    [saleId]
  );

  return {
    store: settingsResult.rows[0] || null,
    invoiceNumber: sale.invoice_number,
    saleId: sale.sale_id,
    saleDate: sale.sale_date,
    customer: sale.customer_id ? {
      id: sale.customer_id,
      name: sale.customer_name
    } : null,
    cashier: {
      id: sale.cashier_id,
      name: sale.cashier_name,
      username: sale.cashier_username
    },
    subtotalAmount: sale.subtotal_amount,
    discountAmount: sale.discount_amount,
    taxAmount: sale.tax_amount,
    totalAmount: sale.total_amount,
    paidAmount: sale.paid_amount,
    balanceAmount: sale.balance_amount,
    paymentStatus: sale.payment_status,
    saleStatus: sale.sale_status,
    notes: sale.notes,
    items: sale.items,
    payments: sale.payments,
    stockMovements: stockMovementsResult.rows
  };
};

const listSales = async (req, res, next) => {
  try {
    const pagination = getPagination(req.query);
    const values = [];
    const filters = [];

    if (req.query.search) {
      values.push(`%${req.query.search.trim()}%`);
      filters.push(`s.invoice_number ILIKE $${values.length}`);
    }

    const customerId = parsePositiveInteger(req.query.customerId, 'customerId');

    if (customerId) {
      values.push(customerId);
      filters.push(`s.customer_id = $${values.length}`);
    }

    const cashierId = parsePositiveInteger(req.query.cashierId, 'cashierId');

    if (cashierId) {
      values.push(cashierId);
      filters.push(`s.cashier_id = $${values.length}`);
    }

    if (req.query.saleStatus) {
      ensureAllowedValue(req.query.saleStatus, SALE_STATUSES, 'saleStatus');
      values.push(req.query.saleStatus);
      filters.push(`s.sale_status = $${values.length}`);
    }

    if (req.query.paymentStatus) {
      ensureAllowedValue(req.query.paymentStatus, PAYMENT_STATUSES, 'paymentStatus');
      values.push(req.query.paymentStatus);
      filters.push(`s.payment_status = $${values.length}`);
    }

    if (req.query.dateFrom) {
      values.push(req.query.dateFrom);
      filters.push(`s.sale_date >= $${values.length}`);
    }

    if (req.query.dateTo) {
      values.push(req.query.dateTo);
      filters.push(`s.sale_date <= $${values.length}`);
    }

    const result = await query(
      `
        ${SALE_SELECT}
        ${filters.length ? `WHERE ${filters.join(' AND ')}` : ''}
        ORDER BY s.sale_date DESC, s.sale_id DESC
        ${appendPagination(values, pagination)}
      `,
      values
    );

    return sendList(res, 'sales', result.rows, pagination);
  } catch (error) {
    return next(mapDatabaseError(error));
  }
};

const getSale = async (req, res, next) => {
  try {
    const saleId = parsePositiveInteger(req.params.id, 'saleId');
    const sale = await findSaleById(saleId);

    if (!sale) {
      throw createHttpError(404, 'Sale not found');
    }

    return sendItem(res, 'sale', sale);
  } catch (error) {
    return next(mapDatabaseError(error));
  }
};

const getSaleInvoice = async (req, res, next) => {
  try {
    const saleId = parsePositiveInteger(req.params.id, 'saleId');
    const invoice = await findInvoiceBySaleId(saleId);

    if (!invoice) {
      throw createHttpError(404, 'Sale not found');
    }

    return res.json({
      invoice: toCamelCase(invoice)
    });
  } catch (error) {
    return next(mapDatabaseError(error));
  }
};

const derivePaymentStatus = (totalAmount, paidAmount) => {
  if (paidAmount <= 0) {
    return 'Unpaid';
  }

  if (paidAmount >= totalAmount) {
    return 'Paid';
  }

  return 'Partial';
};

const normalizeSaleItems = async (client, rawItems, reduceStock) => {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw createHttpError(400, 'At least one sale item is required');
  }

  const items = [];

  for (const [index, item] of rawItems.entries()) {
    requireFields(item, ['productId', 'quantity']);

    const productId = parsePositiveInteger(item.productId, `items[${index}].productId`);
    const productResult = await client.query(
      'SELECT product_id, product_name, selling_price, current_stock, is_active FROM products WHERE product_id = $1 FOR UPDATE',
      [productId]
    );
    const product = productResult.rows[0];

    if (!product) {
      throw createHttpError(400, `Product ${productId} does not exist`);
    }

    if (!product.is_active) {
      throw createHttpError(400, `Product ${product.product_name} is inactive and cannot be sold`);
    }

    const quantity = parsePositiveNumber(item.quantity, `items[${index}].quantity`);

    if (reduceStock && Number(product.current_stock) < quantity) {
      throw createHttpError(400, `Insufficient stock for ${product.product_name}`);
    }

    const unitPrice = item.unitPrice === undefined
      ? Number(product.selling_price)
      : parseNonNegativeNumber(item.unitPrice, `items[${index}].unitPrice`);
    const discountAmount = item.discountAmount === undefined
      ? 0
      : parseNonNegativeNumber(item.discountAmount, `items[${index}].discountAmount`);
    const taxAmount = item.taxAmount === undefined
      ? 0
      : parseNonNegativeNumber(item.taxAmount, `items[${index}].taxAmount`);
    const lineTotal = item.lineTotal === undefined
      ? (quantity * unitPrice) - discountAmount + taxAmount
      : parseNonNegativeNumber(item.lineTotal, `items[${index}].lineTotal`);

    if (lineTotal < 0) {
      throw createHttpError(400, `items[${index}].lineTotal must be greater than or equal to 0`);
    }

    items.push({
      product,
      productId,
      quantity,
      unitPrice,
      discountAmount,
      taxAmount,
      lineTotal
    });
  }

  return items;
};

const normalizePayments = (rawPayments, fallbackPayment, paidAmount, receivedBy, saleStatus) => {
  const payments = [];

  if (Array.isArray(rawPayments)) {
    for (const [index, payment] of rawPayments.entries()) {
      requireFields(payment, ['paymentMethod', 'amount']);
      ensureAllowedValue(payment.paymentMethod, PAYMENT_METHODS, `payments[${index}].paymentMethod`);

      const paymentStatus = payment.paymentStatus || 'Completed';
      const allowedPaymentRecordStatuses = ['Pending', 'Completed', 'Failed', 'Refunded'];
      ensureAllowedValue(paymentStatus, allowedPaymentRecordStatuses, `payments[${index}].paymentStatus`);

      if (saleStatus === 'Completed' && paymentStatus !== 'Completed') {
        throw createHttpError(400, `payments[${index}].paymentStatus must be Completed for completed sales`);
      }

      payments.push({
        paymentMethod: payment.paymentMethod,
        amount: parsePositiveNumber(payment.amount, `payments[${index}].amount`),
        paymentStatus,
        transactionReference: normalizeOptionalString(payment.transactionReference),
        paidAt: payment.paidAt || null,
        receivedBy: payment.receivedBy ? parsePositiveInteger(payment.receivedBy, `payments[${index}].receivedBy`) : receivedBy
      });
    }

    return payments;
  }

  if (paidAmount > 0) {
    const paymentMethod = fallbackPayment.paymentMethod || 'Cash';
    ensureAllowedValue(paymentMethod, PAYMENT_METHODS, 'paymentMethod');

    payments.push({
      paymentMethod,
      amount: paidAmount,
      paymentStatus: saleStatus === 'Completed' ? 'Completed' : 'Pending',
      transactionReference: normalizeOptionalString(fallbackPayment.transactionReference),
      paidAt: fallbackPayment.paidAt || null,
      receivedBy
    });
  }

  return payments;
};

const createSale = async (req, res, next) => {
  try {
    requireFields(req.body, ['items']);

    const saleStatus = req.body.saleStatus || 'Completed';
    ensureAllowedValue(saleStatus, SALE_STATUSES, 'saleStatus');
    const shouldReduceStock = saleStatus === 'Completed';

    const saleId = await withTransaction(async (client) => {
      const cashierId = req.body.cashierId
        ? parsePositiveInteger(req.body.cashierId, 'cashierId')
        : req.user.id;
      const customerId = req.body.customerId
        ? parsePositiveInteger(req.body.customerId, 'customerId')
        : null;

      if (customerId) {
        const customerResult = await client.query(
          'SELECT customer_id, is_active FROM customers WHERE customer_id = $1',
          [customerId]
        );

        if (!customerResult.rows[0]) {
          throw createHttpError(400, 'Customer does not exist');
        }

        if (!customerResult.rows[0].is_active) {
          throw createHttpError(400, 'Inactive customers cannot receive credit');
        }
      }

      const items = await normalizeSaleItems(client, req.body.items, shouldReduceStock);
      const itemSubtotal = items.reduce((total, item) => total + (item.quantity * item.unitPrice), 0);
      const itemDiscount = items.reduce((total, item) => total + item.discountAmount, 0);
      const itemTax = items.reduce((total, item) => total + item.taxAmount, 0);
      const subtotalAmount = req.body.subtotalAmount === undefined
        ? itemSubtotal
        : parseNonNegativeNumber(req.body.subtotalAmount, 'subtotalAmount');
      const discountAmount = req.body.discountAmount === undefined
        ? itemDiscount
        : parseNonNegativeNumber(req.body.discountAmount, 'discountAmount');
      const taxAmount = req.body.taxAmount === undefined
        ? itemTax
        : parseNonNegativeNumber(req.body.taxAmount, 'taxAmount');
      const totalAmount = req.body.totalAmount === undefined
        ? subtotalAmount - discountAmount + taxAmount
        : parseNonNegativeNumber(req.body.totalAmount, 'totalAmount');

      if (totalAmount < 0) {
        throw createHttpError(400, 'totalAmount must be greater than or equal to 0');
      }

      const rawPaidAmount = Array.isArray(req.body.payments)
        ? req.body.payments.reduce((total, payment) => total + Number(payment.amount || 0), 0)
        : req.body.paidAmount;
      const paidAmount = rawPaidAmount === undefined
        ? (saleStatus === 'Completed' ? totalAmount : 0)
        : parseNonNegativeNumber(rawPaidAmount, 'paidAmount');

      const balanceAmount = Math.max(totalAmount - paidAmount, 0);
      const paymentStatus = derivePaymentStatus(totalAmount, paidAmount);

      if (saleStatus === 'Completed' && balanceAmount > 0 && !customerId) {
        throw createHttpError(400, 'Select an active customer before placing a sale on credit');
      }

      const saleResult = await client.query(
        `
          INSERT INTO sales (
            invoice_number,
            customer_id,
            cashier_id,
            sale_date,
            subtotal_amount,
            discount_amount,
            tax_amount,
            total_amount,
            paid_amount,
            balance_amount,
            payment_status,
            sale_status,
            notes
          )
          VALUES ($1, $2, $3, COALESCE($4, CURRENT_TIMESTAMP), $5, $6, $7, $8, $9, $10, $11, $12, $13)
          RETURNING sale_id
        `,
        [
          normalizeOptionalString(req.body.invoiceNumber) || generateReferenceNumber('INV'),
          customerId,
          cashierId,
          req.body.saleDate || null,
          subtotalAmount,
          discountAmount,
          taxAmount,
          totalAmount,
          paidAmount,
          balanceAmount,
          paymentStatus,
          saleStatus,
          normalizeOptionalString(req.body.notes)
        ]
      );
      const newSaleId = saleResult.rows[0].sale_id;

      for (const item of items) {
        await client.query(
          `
            INSERT INTO sale_items (
              sale_id,
              product_id,
              quantity,
              unit_price,
              discount_amount,
              tax_amount,
              line_total
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `,
          [
            newSaleId,
            item.productId,
            item.quantity,
            item.unitPrice,
            item.discountAmount,
            item.taxAmount,
            item.lineTotal
          ]
        );

        if (shouldReduceStock) {
          const productResult = await client.query(
            'SELECT current_stock FROM products WHERE product_id = $1 FOR UPDATE',
            [item.productId]
          );
          const previousStock = Number(productResult.rows[0].current_stock);

          if (previousStock < item.quantity) {
            throw createHttpError(400, `Insufficient stock for ${item.product.product_name}`);
          }

          const newStock = previousStock - item.quantity;

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
              VALUES ($1, 'Sale', $2, $3, $4, 'Sale', $5, $6, $7)
            `,
            [
              item.productId,
              -item.quantity,
              previousStock,
              newStock,
              newSaleId,
              'Sale completed',
              cashierId
            ]
          );
        }
      }

      const payments = normalizePayments(req.body.payments, req.body, paidAmount, cashierId, saleStatus);

      for (const payment of payments) {
        await client.query(
          `
            INSERT INTO payments (
              sale_id,
              received_by,
              payment_method,
              amount,
              payment_status,
              transaction_reference,
              paid_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, CURRENT_TIMESTAMP))
          `,
          [
            newSaleId,
            payment.receivedBy,
            payment.paymentMethod,
            payment.amount,
            payment.paymentStatus,
            payment.transactionReference,
            payment.paidAt
          ]
        );
      }

      return newSaleId;
    });

    const sale = await findSaleById(saleId);
    const invoice = await findInvoiceBySaleId(saleId);

    return res.status(201).json({
      sale: toCamelCase(sale),
      invoice: toCamelCase(invoice)
    });
  } catch (error) {
    return next(mapDatabaseError(error, {
      unique: 'Invoice number already exists',
      foreignKey: 'Customer, cashier, payment receiver, or product does not exist'
    }));
  }
};

const addSalePayment = async (req, res, next) => {
  try {
    requireFields(req.body, ['paymentMethod', 'amount']);
    ensureAllowedValue(req.body.paymentMethod, PAYMENT_METHODS.filter((method) => method !== 'Split Payment'), 'paymentMethod');
    const saleId = parsePositiveInteger(req.params.id, 'saleId');
    const amount = parsePositiveNumber(req.body.amount, 'amount');

    await withTransaction(async (client) => {
      const saleResult = await client.query(
        `
          SELECT sale_id, customer_id, total_amount, paid_amount, balance_amount, payment_status, sale_status
          FROM sales
          WHERE sale_id = $1
          FOR UPDATE
        `,
        [saleId]
      );
      const sale = saleResult.rows[0];

      if (!sale) {
        throw createHttpError(404, 'Sale not found');
      }

      if (sale.sale_status !== 'Completed') {
        throw createHttpError(400, 'Payments can only be recorded for completed sales');
      }

      if (!sale.customer_id) {
        throw createHttpError(400, 'This sale is not assigned to a customer');
      }

      const currentBalance = Number(sale.balance_amount);

      if (currentBalance <= 0 || sale.payment_status === 'Paid') {
        throw createHttpError(400, 'This sale has no outstanding balance');
      }

      if (amount > currentBalance) {
        throw createHttpError(400, `Payment cannot exceed the outstanding balance of ${currentBalance.toFixed(2)}`);
      }

      const paidAmount = Number(sale.paid_amount) + amount;
      const balanceAmount = Math.max(Number(sale.total_amount) - paidAmount, 0);
      const paymentStatus = derivePaymentStatus(Number(sale.total_amount), paidAmount);

      await client.query(
        `
          INSERT INTO payments (
            sale_id,
            received_by,
            payment_method,
            amount,
            payment_status,
            transaction_reference
          )
          VALUES ($1, $2, $3, $4, 'Completed', $5)
        `,
        [
          saleId,
          req.user.id,
          req.body.paymentMethod,
          amount,
          normalizeOptionalString(req.body.transactionReference)
        ]
      );

      await client.query(
        `
          UPDATE sales
          SET paid_amount = $1,
              balance_amount = $2,
              payment_status = $3
          WHERE sale_id = $4
        `,
        [paidAmount, balanceAmount, paymentStatus, saleId]
      );
    });

    const sale = await findSaleById(saleId);
    const invoice = await findInvoiceBySaleId(saleId);

    return res.json({
      sale: toCamelCase(sale),
      invoice: toCamelCase(invoice)
    });
  } catch (error) {
    return next(mapDatabaseError(error, {
      foreignKey: 'Sale, payment receiver, or customer does not exist'
    }));
  }
};

const cancelSale = async (req, res, next) => {
  try {
    const saleId = parsePositiveInteger(req.params.id, 'saleId');

    const updatedSaleId = await withTransaction(async (client) => {
      const saleResult = await client.query(
        'SELECT sale_id, sale_status, cashier_id FROM sales WHERE sale_id = $1 FOR UPDATE',
        [saleId]
      );
      const sale = saleResult.rows[0];

      if (!sale) {
        throw createHttpError(404, 'Sale not found');
      }

      if (sale.sale_status === 'Cancelled') {
        return saleId;
      }

      if (sale.sale_status !== 'Completed') {
        await client.query(
          "UPDATE sales SET sale_status = 'Cancelled' WHERE sale_id = $1",
          [saleId]
        );
        return saleId;
      }

      const itemsResult = await client.query(
        'SELECT product_id, quantity FROM sale_items WHERE sale_id = $1',
        [saleId]
      );

      for (const item of itemsResult.rows) {
        const productResult = await client.query(
          'SELECT current_stock FROM products WHERE product_id = $1 FOR UPDATE',
          [item.product_id]
        );
        const previousStock = Number(productResult.rows[0].current_stock);
        const quantity = Number(item.quantity);
        const newStock = previousStock + quantity;

        await client.query(
          'UPDATE products SET current_stock = $1 WHERE product_id = $2',
          [newStock, item.product_id]
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
            VALUES ($1, 'Adjustment', $2, $3, $4, 'Sale', $5, $6, $7)
          `,
          [
            item.product_id,
            quantity,
            previousStock,
            newStock,
            saleId,
            'Sale cancelled',
            req.user.id
          ]
        );
      }

      await client.query(
        "UPDATE sales SET sale_status = 'Cancelled', payment_status = 'Refunded' WHERE sale_id = $1",
        [saleId]
      );

      return saleId;
    });

    const sale = await findSaleById(updatedSaleId);
    return sendItem(res, 'sale', sale);
  } catch (error) {
    return next(mapDatabaseError(error));
  }
};

module.exports = {
  addSalePayment,
  cancelSale,
  createSale,
  getSaleInvoice,
  getSale,
  listSales
};
