import { DEFAULT_CURRENCY, formatQuantity } from '../utils/formatters.js';
import {
  formatReceiptDateTime,
  formatReceiptMoney,
  getReceiptItemCount,
  getReceiptLabels,
  getReceiptPaymentText,
  normalizeReceiptLanguage
} from '../utils/receipt.js';

const Receipt = ({ invoice, language = 'si' }) => {
  const receiptLanguage = normalizeReceiptLanguage(language);
  const labels = getReceiptLabels(receiptLanguage);
  const currencyCode = invoice.store?.currencyCode || DEFAULT_CURRENCY;
  const paidAmount = Number(invoice.paidAmount || 0);
  const totalAmount = Number(invoice.totalAmount || 0);
  const changeAmount = Math.max(paidAmount - totalAmount, 0);

  const metaRows = [
    [labels.cashier, invoice.cashier?.name || labels.cashier],
    [labels.billNumber, invoice.invoiceNumber || '-'],
    [labels.date, formatReceiptDateTime(invoice.saleDate)],
    ...(invoice.customer?.name ? [[labels.customer, invoice.customer.name]] : []),
    [labels.payment, getReceiptPaymentText(invoice, receiptLanguage)]
  ];
  const totalRows = [
    [labels.subtotal, invoice.subtotalAmount, ''],
    [labels.discount, invoice.discountAmount, ''],
    [labels.tax, invoice.taxAmount, ''],
    [labels.total, totalAmount, 'receipt-total-row--grand'],
    [labels.paid, paidAmount, ''],
    [labels.balance, invoice.balanceAmount, '']
  ];

  return (
    <div
      className={`receipt receipt--${receiptLanguage}`}
      data-no-translate="true"
      lang={receiptLanguage}
    >
      <header className="receipt-store">
        <strong>{invoice.store?.storeName || labels.storeFallback}</strong>
        {invoice.store?.address ? <span>{invoice.store.address}</span> : null}
        {invoice.store?.phone ? <span>{invoice.store.phone}</span> : null}
      </header>

      <section className="receipt-meta">
        {metaRows.map(([label, value]) => (
          <div className="receipt-meta-row" key={label}>
            <strong>{label}</strong>
            <span>:&nbsp; {value}</span>
          </div>
        ))}
      </section>

      <section className="receipt-items">
        <div className="receipt-item-head">
          <span>{labels.quantity}</span>
          <span>{labels.unitPrice} ({currencyCode})</span>
          <span>{labels.amount}</span>
        </div>
        {invoice.items?.map((item) => (
          <div className="receipt-item" key={item.saleItemId}>
            <strong className="receipt-item-name">{item.productName}</strong>
            <div className="receipt-item-values">
              <span>{formatQuantity(item.quantity)}</span>
              <span>{formatReceiptMoney(item.unitPrice)}</span>
              <strong>{formatReceiptMoney(item.lineTotal)}</strong>
            </div>
          </div>
        ))}
      </section>

      <section className="receipt-totals">
        {totalRows.map(([label, value, className]) => (
          <div className={className} key={label}>
            <span>{label}</span>
            <strong>{formatReceiptMoney(value)}</strong>
          </div>
        ))}
      </section>

      <section className="receipt-change">
        <strong>{labels.change}</strong>
        <strong>{formatReceiptMoney(changeAmount)}</strong>
      </section>

      <footer className="receipt-footer">
        <div className="receipt-item-count">
          <span>{labels.itemCount}</span>
          <strong>{getReceiptItemCount(invoice)}</strong>
        </div>
        {invoice.store?.receiptFooter ? <p>{invoice.store.receiptFooter}</p> : null}
        <p className="receipt-thank-you">{labels.thankYou}</p>
      </footer>
    </div>
  );
};

export default Receipt;
