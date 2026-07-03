export const DEFAULT_CURRENCY = 'LKR';
export const DEFAULT_LOCALE = 'en-LK';

export const formatCurrency = (value, currency = DEFAULT_CURRENCY) => new Intl.NumberFormat(DEFAULT_LOCALE, {
  style: 'currency',
  currency
}).format(Number(value || 0));

export const formatDate = (value) => {
  if (!value) {
    return 'Not set';
  }

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium'
  }).format(new Date(value));
};

export const formatDateTime = (value) => {
  if (!value) {
    return 'Not set';
  }

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
};
