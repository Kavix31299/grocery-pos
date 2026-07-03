const toCamelCaseKey = (key) => key.replace(/_([a-z])/g, (_, char) => char.toUpperCase());

const toCamelCase = (value) => {
  if (Array.isArray(value)) {
    return value.map(toCamelCase);
  }

  if (!value || typeof value !== 'object' || value instanceof Date) {
    return value;
  }

  return Object.entries(value).reduce((result, [key, item]) => {
    result[toCamelCaseKey(key)] = toCamelCase(item);
    return result;
  }, {});
};

const createHttpError = (status, message, details) => {
  const error = new Error(message);
  error.status = status;

  if (details) {
    error.details = details;
  }

  return error;
};

const requireFields = (body, fields) => {
  const missingFields = fields.filter((field) => {
    const value = body[field];
    return value === undefined || value === null || value === '';
  });

  if (missingFields.length > 0) {
    throw createHttpError(400, 'Missing required fields', { fields: missingFields });
  }
};

const parsePositiveInteger = (value, fieldName) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    throw createHttpError(400, `${fieldName} must be a positive integer`);
  }

  return parsed;
};

const parseNonNegativeInteger = (value, fieldName) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 0) {
    throw createHttpError(400, `${fieldName} must be a non-negative integer`);
  }

  return parsed;
};

const parseNumber = (value, fieldName) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw createHttpError(400, `${fieldName} must be a valid number`);
  }

  return parsed;
};

const parseNonNegativeNumber = (value, fieldName) => {
  const parsed = parseNumber(value, fieldName);

  if (parsed === null) {
    return null;
  }

  if (parsed < 0) {
    throw createHttpError(400, `${fieldName} must be greater than or equal to 0`);
  }

  return parsed;
};

const parsePositiveNumber = (value, fieldName) => {
  const parsed = parseNumber(value, fieldName);

  if (parsed === null || parsed <= 0) {
    throw createHttpError(400, `${fieldName} must be greater than 0`);
  }

  return parsed;
};

const parseBoolean = (value, fieldName) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  throw createHttpError(400, `${fieldName} must be true or false`);
};

const getPagination = (query, defaultLimit = 50, maxLimit = 100) => {
  const page = parsePositiveInteger(query.page || 1, 'page') || 1;
  const requestedLimit = parsePositiveInteger(query.limit || defaultLimit, 'limit') || defaultLimit;
  const limit = Math.min(requestedLimit, maxLimit);

  return {
    page,
    limit,
    offset: (page - 1) * limit
  };
};

const appendPagination = (values, pagination) => {
  values.push(pagination.limit);
  const limitPlaceholder = `$${values.length}`;
  values.push(pagination.offset);
  const offsetPlaceholder = `$${values.length}`;

  return ` LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}`;
};

const getBodyValue = (body, prop, column) => {
  if (Object.prototype.hasOwnProperty.call(body, prop)) {
    return body[prop];
  }

  if (column && Object.prototype.hasOwnProperty.call(body, column)) {
    return body[column];
  }

  return undefined;
};

const normalizeOptionalString = (value) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized === '' ? null : normalized;
};

const buildUpdateQuery = ({
  table,
  idColumn,
  idValue,
  fields,
  body,
  returning = '*'
}) => {
  const values = [];
  const assignments = [];

  fields.forEach((field) => {
    const value = getBodyValue(body, field.prop, field.column);

    if (value !== undefined) {
      values.push(field.transform ? field.transform(value) : value);
      assignments.push(`${field.column} = $${values.length}`);
    }
  });

  if (assignments.length === 0) {
    throw createHttpError(400, 'No valid fields provided for update');
  }

  values.push(idValue);

  return {
    text: `
      UPDATE ${table}
      SET ${assignments.join(', ')}
      WHERE ${idColumn} = $${values.length}
      RETURNING ${returning}
    `,
    values
  };
};

const mapDatabaseError = (error, messages = {}) => {
  if (error.code === '23505') {
    return createHttpError(409, messages.unique || 'A record with these details already exists');
  }

  if (error.code === '23503') {
    return createHttpError(400, messages.foreignKey || 'Referenced record does not exist');
  }

  if (error.code === '23514') {
    return createHttpError(400, messages.check || 'Request violates a database constraint');
  }

  if (error.code === '23502') {
    return createHttpError(400, messages.notNull || 'Missing required database field');
  }

  return error;
};

const sendList = (res, key, rows, pagination) => res.json({
  [key]: toCamelCase(rows),
  meta: pagination ? {
    page: pagination.page,
    limit: pagination.limit,
    count: rows.length
  } : undefined
});

const sendItem = (res, key, row, status = 200) => res.status(status).json({
  [key]: toCamelCase(row)
});

module.exports = {
  appendPagination,
  buildUpdateQuery,
  createHttpError,
  getBodyValue,
  getPagination,
  mapDatabaseError,
  normalizeOptionalString,
  parseBoolean,
  parseNonNegativeInteger,
  parseNonNegativeNumber,
  parseNumber,
  parsePositiveInteger,
  parsePositiveNumber,
  requireFields,
  sendItem,
  sendList,
  toCamelCase
};
