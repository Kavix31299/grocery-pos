const { query } = require('../config/db');
const {
  buildUpdateQuery,
  createHttpError,
  mapDatabaseError,
  normalizeOptionalString,
  parseBoolean,
  parseNonNegativeNumber,
  parsePositiveInteger,
  requireFields,
  sendItem
} = require('../utils/controllerHelpers');

const parsePrinterPort = (value) => {
  const port = parsePositiveInteger(value, 'printerPort');

  if (port > 65535) {
    throw createHttpError(400, 'printerPort must be between 1 and 65535');
  }

  return port;
};

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
          receipt_footer,
          printer_enabled,
          printer_host,
          printer_port,
          printer_device_id,
          printer_use_ssl,
          printer_buffer
        )
        VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (setting_id) DO UPDATE SET
          store_name = EXCLUDED.store_name,
          address = EXCLUDED.address,
          phone = EXCLUDED.phone,
          email = EXCLUDED.email,
          currency_code = EXCLUDED.currency_code,
          tax_rate = EXCLUDED.tax_rate,
          receipt_footer = EXCLUDED.receipt_footer,
          printer_enabled = EXCLUDED.printer_enabled,
          printer_host = EXCLUDED.printer_host,
          printer_port = EXCLUDED.printer_port,
          printer_device_id = EXCLUDED.printer_device_id,
          printer_use_ssl = EXCLUDED.printer_use_ssl,
          printer_buffer = EXCLUDED.printer_buffer
        RETURNING *
      `,
      [
        normalizeOptionalString(req.body.storeName),
        normalizeOptionalString(req.body.address),
        normalizeOptionalString(req.body.phone),
        normalizeOptionalString(req.body.email),
        normalizeOptionalString(req.body.currencyCode) || 'LKR',
        req.body.taxRate === undefined ? 0 : parseNonNegativeNumber(req.body.taxRate, 'taxRate'),
        normalizeOptionalString(req.body.receiptFooter),
        req.body.printerEnabled === undefined ? false : parseBoolean(req.body.printerEnabled, 'printerEnabled'),
        normalizeOptionalString(req.body.printerHost),
        req.body.printerPort === undefined ? 8008 : parsePrinterPort(req.body.printerPort),
        normalizeOptionalString(req.body.printerDeviceId) || 'local_printer',
        req.body.printerUseSsl === undefined ? false : parseBoolean(req.body.printerUseSsl, 'printerUseSsl'),
        req.body.printerBuffer === undefined ? false : parseBoolean(req.body.printerBuffer, 'printerBuffer')
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
        { prop: 'receiptFooter', column: 'receipt_footer', transform: normalizeOptionalString },
        { prop: 'printerEnabled', column: 'printer_enabled', transform: (value) => parseBoolean(value, 'printerEnabled') },
        { prop: 'printerHost', column: 'printer_host', transform: normalizeOptionalString },
        { prop: 'printerPort', column: 'printer_port', transform: parsePrinterPort },
        { prop: 'printerDeviceId', column: 'printer_device_id', transform: (value) => normalizeOptionalString(value) || 'local_printer' },
        { prop: 'printerUseSsl', column: 'printer_use_ssl', transform: (value) => parseBoolean(value, 'printerUseSsl') },
        { prop: 'printerBuffer', column: 'printer_buffer', transform: (value) => parseBoolean(value, 'printerBuffer') }
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
