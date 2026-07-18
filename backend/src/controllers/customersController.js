const { query } = require('../config/db');
const { withTransaction } = require('../utils/transactions');
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
  parsePositiveNumber,
  requireFields,
  sendItem,
  sendList,
  toCamelCase
} = require('../utils/controllerHelpers');

const PAYMENT_METHODS = ['Cash', 'Card', 'Bank Transfer', 'QR Payment'];

const listCustomers = async (req, res, next) => {
  try {
    const pagination = getPagination(req.query);
    const values = [];
    const filters = [];

    if (req.query.search) {
      values.push(`%${req.query.search.trim()}%`);
      filters.push(`
        (
          c.customer_name ILIKE $${values.length}
          OR c.phone ILIKE $${values.length}
          OR c.email ILIKE $${values.length}
        )
      `);
    }

    const isActive = parseBoolean(req.query.isActive, 'isActive');

    if (isActive !== null) {
      values.push(isActive);
      filters.push(`c.is_active = $${values.length}`);
    }

    const result = await query(
      `
        SELECT
          c.*,
          COALESCE(credit.credit_sales_count, 0) AS credit_sales_count,
          COALESCE(credit.credit_balance, 0) AS credit_balance,
          credit.oldest_credit_at,
          credit.latest_credit_at
        FROM customers c
        LEFT JOIN LATERAL (
          SELECT
            COUNT(s.sale_id) AS credit_sales_count,
            SUM(s.balance_amount) AS credit_balance,
            MIN(s.sale_date) AS oldest_credit_at,
            MAX(s.sale_date) AS latest_credit_at
          FROM sales s
          WHERE s.customer_id = c.customer_id
            AND s.sale_status = 'Completed'
            AND s.balance_amount > 0
        ) credit ON TRUE
        ${filters.length ? `WHERE ${filters.join(' AND ')}` : ''}
        ORDER BY c.customer_name ASC
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
    const result = await query(
      `
        SELECT
          c.*,
          COALESCE(credit.credit_sales_count, 0) AS credit_sales_count,
          COALESCE(credit.credit_balance, 0) AS credit_balance,
          credit.oldest_credit_at,
          credit.latest_credit_at
        FROM customers c
        LEFT JOIN LATERAL (
          SELECT
            COUNT(s.sale_id) AS credit_sales_count,
            SUM(s.balance_amount) AS credit_balance,
            MIN(s.sale_date) AS oldest_credit_at,
            MAX(s.sale_date) AS latest_credit_at
          FROM sales s
          WHERE s.customer_id = c.customer_id
            AND s.sale_status = 'Completed'
            AND s.balance_amount > 0
        ) credit ON TRUE
        WHERE c.customer_id = $1
      `,
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

const addCustomerPayment = async (req, res, next) => {
  try {
    requireFields(req.body, ['paymentMethod', 'amount']);
    const customerId = parsePositiveInteger(req.params.id, 'customerId');
    const amount = parsePositiveNumber(req.body.amount, 'amount');

    if (!PAYMENT_METHODS.includes(req.body.paymentMethod)) {
      throw createHttpError(400, `paymentMethod must be one of: ${PAYMENT_METHODS.join(', ')}`);
    }

    const result = await withTransaction(async (client) => {
      const customerResult = await client.query(
        'SELECT customer_id, customer_name FROM customers WHERE customer_id = $1 FOR UPDATE',
        [customerId]
      );

      if (!customerResult.rows[0]) {
        throw createHttpError(404, 'Customer not found');
      }

      const salesResult = await client.query(
        `
          SELECT sale_id, invoice_number, total_amount, paid_amount, balance_amount
          FROM sales
          WHERE customer_id = $1
            AND sale_status = 'Completed'
            AND balance_amount > 0
          ORDER BY sale_date ASC, sale_id ASC
          FOR UPDATE
        `,
        [customerId]
      );
      const outstandingSales = salesResult.rows;
      const totalBalance = outstandingSales.reduce((total, sale) => (
        total + Number(sale.balance_amount)
      ), 0);

      if (totalBalance <= 0) {
        throw createHttpError(400, 'This customer has no outstanding credit balance');
      }

      if (amount > totalBalance) {
        throw createHttpError(400, `Payment cannot exceed the customer credit balance of ${totalBalance.toFixed(2)}`);
      }

      let remainingAmount = amount;
      const allocations = [];

      for (const sale of outstandingSales) {
        if (remainingAmount <= 0) {
          break;
        }

        const currentBalance = Number(sale.balance_amount);
        const allocatedAmount = Math.min(remainingAmount, currentBalance);
        const paidAmount = Number(sale.paid_amount) + allocatedAmount;
        const balanceAmount = Math.max(Number(sale.total_amount) - paidAmount, 0);
        const paymentStatus = balanceAmount <= 0 ? 'Paid' : 'Partial';

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
            sale.sale_id,
            req.user.id,
            req.body.paymentMethod,
            allocatedAmount,
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
          [paidAmount, balanceAmount, paymentStatus, sale.sale_id]
        );

        allocations.push({
          sale_id: sale.sale_id,
          invoice_number: sale.invoice_number,
          amount: allocatedAmount,
          balance_amount: balanceAmount,
          payment_status: paymentStatus
        });
        remainingAmount -= allocatedAmount;
      }

      return {
        customer_id: customerId,
        customer_name: customerResult.rows[0].customer_name,
        amount,
        credit_balance: Math.max(totalBalance - amount, 0),
        allocations
      };
    });

    return res.json({ payment: toCamelCase(result) });
  } catch (error) {
    return next(mapDatabaseError(error, {
      foreignKey: 'Customer, sale, or payment receiver does not exist'
    }));
  }
};

module.exports = {
  addCustomerPayment,
  createCustomer,
  deleteCustomer,
  getCustomer,
  listCustomers,
  updateCustomer
};
