const { query } = require('../config/db');
const {
  buildUpdateQuery,
  createHttpError,
  mapDatabaseError,
  normalizeOptionalString,
  parseNonNegativeNumber,
  requireFields,
  sendItem
} = require('../utils/controllerHelpers');

const getStoreSettings = async (req, res, next) => {
  try {
    const result = await query('SELECT * FROM store_settings WHERE setting_id = 1');

    if (!result.rows[0]) {
      throw createHttpError(404, 'Store settings not found');
    }

    return sendItem(res, 'settings', result.rows[0]);
  } catch (error) {
    return next(mapDatabaseError(error));
  }
};

const createStoreSettings = async (req, res, next) => {
  try {
    requireFields(req.body, ['storeName']);

    const result = await query(
      `
        INSERT INTO store_settings (
          setting_id,
          store_name,
          address,
          phone,
          email,
          currency_code,
          tax_rate,
          receipt_footer
        )
        VALUES (1, $1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (setting_id) DO UPDATE SET
          store_name = EXCLUDED.store_name,
          address = EXCLUDED.address,
          phone = EXCLUDED.phone,
          email = EXCLUDED.email,
          currency_code = EXCLUDED.currency_code,
          tax_rate = EXCLUDED.tax_rate,
          receipt_footer = EXCLUDED.receipt_footer
        RETURNING *
      `,
      [
        normalizeOptionalString(req.body.storeName),
        normalizeOptionalString(req.body.address),
        normalizeOptionalString(req.body.phone),
        normalizeOptionalString(req.body.email),
        normalizeOptionalString(req.body.currencyCode) || 'LKR',
        req.body.taxRate === undefined ? 0 : parseNonNegativeNumber(req.body.taxRate, 'taxRate'),
        normalizeOptionalString(req.body.receiptFooter)
      ]
    );

    return sendItem(res, 'settings', result.rows[0]);
  } catch (error) {
    return next(mapDatabaseError(error));
  }
};

const updateStoreSettings = async (req, res, next) => {
  try {
    const update = buildUpdateQuery({
      table: 'store_settings',
      idColumn: 'setting_id',
      idValue: 1,
      fields: [
        { prop: 'storeName', column: 'store_name', transform: normalizeOptionalString },
        { prop: 'address', column: 'address', transform: normalizeOptionalString },
        { prop: 'phone', column: 'phone', transform: normalizeOptionalString },
        { prop: 'email', column: 'email', transform: normalizeOptionalString },
        { prop: 'currencyCode', column: 'currency_code', transform: normalizeOptionalString },
        { prop: 'taxRate', column: 'tax_rate', transform: (value) => parseNonNegativeNumber(value, 'taxRate') },
        { prop: 'receiptFooter', column: 'receipt_footer', transform: normalizeOptionalString }
      ],
      body: req.body
    });

    const result = await query(update.text, update.values);

    if (!result.rows[0]) {
      throw createHttpError(404, 'Store settings not found');
    }

    return sendItem(res, 'settings', result.rows[0]);
  } catch (error) {
    return next(mapDatabaseError(error));
  }
};

module.exports = {
  createStoreSettings,
  getStoreSettings,
  updateStoreSettings
};
