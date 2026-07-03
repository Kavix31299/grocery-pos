const { query } = require('../config/db');
const {
  appendPagination,
  buildUpdateQuery,
  createHttpError,
  getPagination,
  mapDatabaseError,
  normalizeOptionalString,
  parsePositiveInteger,
  parsePositiveNumber,
  requireFields,
  sendItem,
  sendList
} = require('../utils/controllerHelpers');

const EXPENSE_SELECT = `
  SELECT
    e.*,
    u.full_name AS recorded_by_name,
    u.username AS recorded_by_username
  FROM expenses e
  JOIN users u ON u.user_id = e.recorded_by
`;

const findExpenseById = async (expenseId) => {
  const result = await query(`${EXPENSE_SELECT} WHERE e.expense_id = $1`, [expenseId]);
  return result.rows[0] || null;
};

const listExpenses = async (req, res, next) => {
  try {
    const pagination = getPagination(req.query);
    const values = [];
    const filters = [];

    if (req.query.category) {
      values.push(req.query.category.trim());
      filters.push(`e.expense_category = $${values.length}`);
    }

    if (req.query.dateFrom) {
      values.push(req.query.dateFrom);
      filters.push(`e.expense_date >= $${values.length}`);
    }

    if (req.query.dateTo) {
      values.push(req.query.dateTo);
      filters.push(`e.expense_date <= $${values.length}`);
    }

    const recordedBy = parsePositiveInteger(req.query.recordedBy, 'recordedBy');

    if (recordedBy) {
      values.push(recordedBy);
      filters.push(`e.recorded_by = $${values.length}`);
    }

    const result = await query(
      `
        ${EXPENSE_SELECT}
        ${filters.length ? `WHERE ${filters.join(' AND ')}` : ''}
        ORDER BY e.expense_date DESC, e.expense_id DESC
        ${appendPagination(values, pagination)}
      `,
      values
    );

    return sendList(res, 'expenses', result.rows, pagination);
  } catch (error) {
    return next(mapDatabaseError(error));
  }
};

const getExpense = async (req, res, next) => {
  try {
    const expenseId = parsePositiveInteger(req.params.id, 'expenseId');
    const expense = await findExpenseById(expenseId);

    if (!expense) {
      throw createHttpError(404, 'Expense not found');
    }

    return sendItem(res, 'expense', expense);
  } catch (error) {
    return next(mapDatabaseError(error));
  }
};

const createExpense = async (req, res, next) => {
  try {
    requireFields(req.body, ['expenseCategory', 'description', 'amount']);

    const result = await query(
      `
        INSERT INTO expenses (
          expense_category,
          description,
          amount,
          expense_date,
          recorded_by
        )
        VALUES ($1, $2, $3, COALESCE($4, CURRENT_DATE), $5)
        RETURNING expense_id
      `,
      [
        normalizeOptionalString(req.body.expenseCategory),
        normalizeOptionalString(req.body.description),
        parsePositiveNumber(req.body.amount, 'amount'),
        req.body.expenseDate || null,
        req.body.recordedBy ? parsePositiveInteger(req.body.recordedBy, 'recordedBy') : req.user.id
      ]
    );

    const expense = await findExpenseById(result.rows[0].expense_id);
    return sendItem(res, 'expense', expense, 201);
  } catch (error) {
    return next(mapDatabaseError(error, {
      foreignKey: 'Recorded-by user does not exist'
    }));
  }
};

const updateExpense = async (req, res, next) => {
  try {
    const expenseId = parsePositiveInteger(req.params.id, 'expenseId');
    const update = buildUpdateQuery({
      table: 'expenses',
      idColumn: 'expense_id',
      idValue: expenseId,
      fields: [
        { prop: 'expenseCategory', column: 'expense_category', transform: normalizeOptionalString },
        { prop: 'description', column: 'description', transform: normalizeOptionalString },
        { prop: 'amount', column: 'amount', transform: (value) => parsePositiveNumber(value, 'amount') },
        { prop: 'expenseDate', column: 'expense_date' },
        { prop: 'recordedBy', column: 'recorded_by', transform: (value) => parsePositiveInteger(value, 'recordedBy') }
      ],
      body: req.body,
      returning: 'expense_id'
    });

    const result = await query(update.text, update.values);

    if (!result.rows[0]) {
      throw createHttpError(404, 'Expense not found');
    }

    const expense = await findExpenseById(result.rows[0].expense_id);
    return sendItem(res, 'expense', expense);
  } catch (error) {
    return next(mapDatabaseError(error, {
      foreignKey: 'Recorded-by user does not exist'
    }));
  }
};

const deleteExpense = async (req, res, next) => {
  try {
    const expenseId = parsePositiveInteger(req.params.id, 'expenseId');
    const result = await query(
      'DELETE FROM expenses WHERE expense_id = $1 RETURNING *',
      [expenseId]
    );

    if (!result.rows[0]) {
      throw createHttpError(404, 'Expense not found');
    }

    return sendItem(res, 'expense', result.rows[0]);
  } catch (error) {
    return next(mapDatabaseError(error));
  }
};

module.exports = {
  createExpense,
  deleteExpense,
  getExpense,
  listExpenses,
  updateExpense
};
