import { DEFAULT_CURRENCY, formatQuantity } from './formatters.js';

export const RECEIPT_LANGUAGES = Object.freeze([
  { value: 'si', label: 'සිංහල' },
  { value: 'en', label: 'English' }
]);

const labels = Object.freeze({
  en: Object.freeze({
    storeFallback: 'Grocery Store',
    cashier: 'Cashier',
    billNumber: 'Bill number',
    date: 'Date',
    customer: 'Customer',
    walkIn: 'Walk-in',
    payment: 'Payment',
    item: 'Item',
    quantity: 'Quantity',
    unitPrice: 'Unit price',
    amount: 'Amount',
    subtotal: 'Subtotal',
    discount: 'Discount',
    tax: 'Tax',
    total: 'Total',
    paid: 'Paid',
    balance: 'Balance due',
    change: 'Your change',
    itemCount: 'Number of items',
    thankYou: 'Thank you, come again!'
  }),
  si: Object.freeze({
    storeFallback: 'සිල්ලර වෙළඳසැල',
    cashier: 'අයකැමි',
    billNumber: 'බිල් අංකය',
    date: 'දිනය',
    customer: 'පාරිභෝගිකයා',
    walkIn: 'සාමාන්‍ය පාරිභෝගිකයා',
    payment: 'ගෙවීම',
    item: 'භාණ්ඩය',
    quantity: 'ප්‍රමාණය',
    unitPrice: 'ඒකක මිල',
    amount: 'එකතුව',
    subtotal: 'උප එකතුව',
    discount: 'වට්ටම',
    tax: 'බදු',
    total: 'ගෙවිය යුතු මුදල',
    paid: 'ගෙවූ මුදල',
    balance: 'හිඟ මුදල',
    change: 'ඔබ ලැබිය යුතු ඉතිරි මුදල',
    itemCount: 'භාණ්ඩ සංඛ්‍යාව',
    thankYou: 'ස්තුතියි, නැවත එන්න!!'
  })
});

const paymentTranslations = Object.freeze({
  si: Object.freeze({
    Cash: 'මුදල්',
    Card: 'කාඩ්පත',
    'Bank Transfer': 'බැංකු මාරුව',
    'QR Payment': 'QR ගෙවීම',
    'Split Payment': 'බෙදා ගෙවීම',
    Paid: 'ගෙවා ඇත',
    Partial: 'අර්ධ වශයෙන් ගෙවා ඇත',
    Unpaid: 'නොගෙවූ',
    Refunded: 'ආපසු ගෙවන ලදී'
  })
});

export const normalizeReceiptLanguage = (language) => (language === 'en' ? 'en' : 'si');

export const getReceiptLabels = (language) => labels[normalizeReceiptLanguage(language)];

export const formatReceiptMoney = (value) => new Intl.NumberFormat('en-LK', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
}).format(Number(value || 0));

export const formatReceiptDateTime = (value) => {
  if (!value) {
    return '-';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  const pad = (part) => String(part).padStart(2, '0');
  const hours = date.getHours();
  const twelveHour = hours % 12 || 12;
  const period = hours >= 12 ? 'PM' : 'AM';

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(twelveHour)}:${pad(date.getMinutes())}${period}`;
};

export const getReceiptPaymentText = (invoice, language) => {
  const normalizedLanguage = normalizeReceiptLanguage(language);
  const methods = [...new Set((invoice.payments || [])
    .map((payment) => payment.paymentMethod)
    .filter(Boolean))];
  const paymentText = methods.length ? methods.join(' + ') : (invoice.paymentStatus || 'Paid');

  if (normalizedLanguage !== 'si') {
    return paymentText;
  }

  return methods.length
    ? methods.map((method) => paymentTranslations.si[method] || method).join(' + ')
    : (paymentTranslations.si[paymentText] || paymentText);
};

export const getReceiptItemCount = (invoice) => (invoice.items || []).length;

const escapeReceiptText = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

export const buildReceiptPrintDocument = (invoice, language = 'si') => {
  const receiptLanguage = normalizeReceiptLanguage(language);
  const receiptLabels = getReceiptLabels(receiptLanguage);
  const currencyCode = invoice.store?.currencyCode || DEFAULT_CURRENCY;
  const paidAmount = Number(invoice.paidAmount || 0);
  const totalAmount = Number(invoice.totalAmount || 0);
  const changeAmount = Math.max(paidAmount - totalAmount, 0);
  const metaRows = [
    [receiptLabels.cashier, invoice.cashier?.name || receiptLabels.cashier],
    [receiptLabels.billNumber, invoice.invoiceNumber || '-'],
    [receiptLabels.date, formatReceiptDateTime(invoice.saleDate)],
    ...(invoice.customer?.name ? [[receiptLabels.customer, invoice.customer.name]] : []),
    [receiptLabels.payment, getReceiptPaymentText(invoice, receiptLanguage)]
  ].map(([label, value]) => `
    <div class="meta-row">
      <strong>${escapeReceiptText(label)}</strong>
      <span>:&nbsp; ${escapeReceiptText(value)}</span>
    </div>
  `).join('');
  const receiptLines = (invoice.items || []).map((item) => `
    <div class="receipt-item">
      <strong class="item-name">${escapeReceiptText(item.productName)}</strong>
      <div class="item-values">
        <span>${escapeReceiptText(formatQuantity(item.quantity))}</span>
        <span>${escapeReceiptText(formatReceiptMoney(item.unitPrice))}</span>
        <strong>${escapeReceiptText(formatReceiptMoney(item.lineTotal))}</strong>
      </div>
    </div>
  `).join('');
  const totalRows = [
    [receiptLabels.subtotal, invoice.subtotalAmount, ''],
    [receiptLabels.discount, invoice.discountAmount, ''],
    [receiptLabels.tax, invoice.taxAmount, ''],
    [receiptLabels.total, totalAmount, 'grand-total'],
    [receiptLabels.paid, paidAmount, ''],
    [receiptLabels.balance, invoice.balanceAmount, '']
  ].map(([label, value, className]) => `
    <div${className ? ` class="${className}"` : ''}>
      <span>${escapeReceiptText(label)}</span>
      <strong>${escapeReceiptText(formatReceiptMoney(value))}</strong>
    </div>
  `).join('');

  return `
    <!doctype html>
    <html lang="${receiptLanguage}">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${escapeReceiptText(invoice.invoiceNumber || 'Receipt')}</title>
        <style>
          @page { size: 80mm auto; margin: 3mm; }
          * { box-sizing: border-box; }
          body {
            width: 74mm;
            margin: 0;
            color: #000;
            background: #fff;
            font-family: "Noto Sans Sinhala", "Iskoola Pota", Arial, sans-serif;
            font-size: 11px;
            line-height: 1.32;
          }
          .store { display: grid; gap: 1px; text-align: center; }
          .store strong { font-size: 17px; line-height: 1.2; }
          .store span { white-space: pre-line; }
          .meta {
            display: grid;
            gap: 2px;
            border-top: 1px solid #000;
            border-bottom: 1px solid #000;
            margin-top: 8px;
            padding: 6px 0;
          }
          .meta-row { display: grid; grid-template-columns: 24mm minmax(0, 1fr); text-align: left; }
          .meta-row span { overflow-wrap: anywhere; }
          .items { margin-top: 7px; }
          .item-head,
          .item-values { display: grid; grid-template-columns: 17mm 1fr 1fr; gap: 2mm; align-items: baseline; }
          .item-head {
            border: 1px solid #000;
            padding: 4px 2px;
            font-weight: 700;
            text-align: right;
          }
          .item-head span:first-child,
          .item-values span:first-child { text-align: center; }
          .receipt-item { border-bottom: 1px dotted #555; padding: 5px 2px; break-inside: avoid; }
          .item-name { display: block; margin-bottom: 2px; overflow-wrap: anywhere; }
          .item-values { text-align: right; font-variant-numeric: tabular-nums; }
          .totals { display: grid; gap: 3px; border-top: 1px solid #000; margin-top: 1px; padding-top: 6px; }
          .totals > div { display: grid; grid-template-columns: 1fr 28mm; gap: 4mm; text-align: right; }
          .totals .grand-total { border-top: 1px solid #000; margin-top: 2px; padding-top: 5px; font-size: 13px; }
          .change {
            display: grid;
            grid-template-columns: 1fr auto;
            gap: 4mm;
            align-items: center;
            border: 2px solid #000;
            margin-top: 8px;
            padding: 6px;
            font-size: 13px;
          }
          .change strong:last-child { font-size: 18px; font-variant-numeric: tabular-nums; }
          .footer { display: grid; gap: 3px; margin-top: 7px; text-align: center; }
          .footer p { margin: 0; white-space: pre-line; }
          .item-count { display: flex; justify-content: center; gap: 12px; }
          .thank-you { font-weight: 700; font-size: 12px; }
        </style>
      </head>
      <body>
        <main>
          <header class="store">
            <strong>${escapeReceiptText(invoice.store?.storeName || receiptLabels.storeFallback)}</strong>
            ${invoice.store?.address ? `<span>${escapeReceiptText(invoice.store.address)}</span>` : ''}
            ${invoice.store?.phone ? `<span>${escapeReceiptText(invoice.store.phone)}</span>` : ''}
          </header>
          <section class="meta">${metaRows}</section>
          <section class="items">
            <div class="item-head">
              <span>${escapeReceiptText(receiptLabels.quantity)}</span>
              <span>${escapeReceiptText(receiptLabels.unitPrice)} (${escapeReceiptText(currencyCode)})</span>
              <span>${escapeReceiptText(receiptLabels.amount)}</span>
            </div>
            ${receiptLines}
          </section>
          <section class="totals">${totalRows}</section>
          <section class="change">
            <strong>${escapeReceiptText(receiptLabels.change)}</strong>
            <strong>${escapeReceiptText(formatReceiptMoney(changeAmount))}</strong>
          </section>
          <footer class="footer">
            <div class="item-count"><span>${escapeReceiptText(receiptLabels.itemCount)}</span><strong>${getReceiptItemCount(invoice)}</strong></div>
            ${invoice.store?.receiptFooter ? `<p>${escapeReceiptText(invoice.store.receiptFooter)}</p>` : ''}
            <p class="thank-you">${escapeReceiptText(receiptLabels.thankYou)}</p>
          </footer>
        </main>
      </body>
    </html>
  `;
};
