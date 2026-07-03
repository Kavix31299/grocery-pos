import { useEffect, useMemo, useState } from 'react';
import PageHeader from '../components/PageHeader.jsx';
import { createResource, getResource } from '../api/resourcesApi.js';
import { DEFAULT_CURRENCY, formatCurrency, formatDateTime } from '../utils/formatters.js';

const paymentMethods = ['Cash', 'Card', 'Bank Transfer', 'QR Payment', 'Split Payment'];
const splitPaymentMethods = ['Cash', 'Card', 'Bank Transfer', 'QR Payment'];

const emptySplitPayment = {
  paymentMethod: 'Cash',
  amount: ''
};

const clampMoney = (value) => Math.max(Number(value || 0), 0);

const roundMoney = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const CashierPOS = () => {
  const [customerId, setCustomerId] = useState('');
  const [productQuery, setProductQuery] = useState('');
  const [productResults, setProductResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [cart, setCart] = useState([]);
  const [discountType, setDiscountType] = useState('amount');
  const [discountValue, setDiscountValue] = useState('');
  const [taxRate, setTaxRate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [paidAmount, setPaidAmount] = useState('');
  const [splitPayments, setSplitPayments] = useState([{ ...emptySplitPayment }]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [invoice, setInvoice] = useState(null);

  useEffect(() => {
    const trimmedQuery = productQuery.trim();

    if (trimmedQuery.length < 2) {
      setProductResults([]);
      setSearching(false);
      return undefined;
    }

    let ignore = false;
    const timeoutId = window.setTimeout(async () => {
      setSearching(true);
      setError('');

      try {
        const response = await getResource('/products', {
          search: trimmedQuery,
          isActive: true,
          limit: 8
        });

        if (!ignore) {
          setProductResults(response.data.products || []);
        }
      } catch (requestError) {
        if (!ignore) {
          setProductResults([]);
          setError(requestError.response?.data?.message || 'Product search failed');
        }
      } finally {
        if (!ignore) {
          setSearching(false);
        }
      }
    }, 250);

    return () => {
      ignore = true;
      window.clearTimeout(timeoutId);
    };
  }, [productQuery]);

  const subtotal = useMemo(() => roundMoney(cart.reduce((total, item) => (
    total + (item.quantity * Number(item.sellingPrice || 0))
  ), 0)), [cart]);

  const discountAmount = useMemo(() => {
    const rawDiscount = clampMoney(discountValue);
    const calculatedDiscount = discountType === 'percent'
      ? subtotal * (Math.min(rawDiscount, 100) / 100)
      : rawDiscount;

    return roundMoney(Math.min(calculatedDiscount, subtotal));
  }, [discountType, discountValue, subtotal]);

  const taxableAmount = useMemo(() => roundMoney(Math.max(subtotal - discountAmount, 0)), [
    discountAmount,
    subtotal
  ]);

  const taxAmount = useMemo(() => roundMoney(taxableAmount * (clampMoney(taxRate) / 100)), [
    taxRate,
    taxableAmount
  ]);

  const finalTotal = useMemo(() => roundMoney(taxableAmount + taxAmount), [
    taxAmount,
    taxableAmount
  ]);

  const splitPaidAmount = useMemo(() => roundMoney(splitPayments.reduce((total, payment) => (
    total + clampMoney(payment.amount)
  ), 0)), [splitPayments]);

  const receivedAmount = paymentMethod === 'Split Payment'
    ? splitPaidAmount
    : roundMoney(clampMoney(paidAmount));

  const balanceAmount = roundMoney(Math.max(finalTotal - receivedAmount, 0));
  const changeAmount = roundMoney(Math.max(receivedAmount - finalTotal, 0));

  const addProductToCart = (product) => {
    setError('');

    if (Number(product.currentStock || 0) <= 0) {
      setError(`${product.productName} is out of stock`);
      return;
    }

    setCart((current) => {
      const existingItem = current.find((item) => item.productId === product.productId);

      if (existingItem) {
        return current.map((item) => {
          if (item.productId !== product.productId) {
            return item;
          }

          const nextQuantity = Math.min(item.quantity + 1, Number(item.currentStock || 0));

          if (nextQuantity === item.quantity) {
            setError(`Only ${item.currentStock} units available for ${item.productName}`);
          }

          return {
            ...item,
            quantity: nextQuantity
          };
        });
      }

      return [
        ...current,
        {
          productId: product.productId,
          productName: product.productName,
          barcode: product.barcode,
          sku: product.sku,
          currentStock: Number(product.currentStock || 0),
          sellingPrice: Number(product.sellingPrice || 0),
          quantity: 1
        }
      ];
    });
  };

  const updateCartQuantity = (productId, quantity) => {
    const nextQuantity = Number(quantity);

    setCart((current) => current.map((item) => {
      if (item.productId !== productId) {
        return item;
      }

      return {
        ...item,
        quantity: Math.min(Math.max(nextQuantity || 1, 1), item.currentStock)
      };
    }));
  };

  const removeCartItem = (productId) => {
    setCart((current) => current.filter((item) => item.productId !== productId));
  };

  const updateSplitPayment = (index, field, value) => {
    setSplitPayments((current) => current.map((payment, paymentIndex) => (
      paymentIndex === index ? { ...payment, [field]: value } : payment
    )));
  };

  const addSplitPayment = () => {
    setSplitPayments((current) => [...current, { ...emptySplitPayment }]);
  };

  const removeSplitPayment = (index) => {
    setSplitPayments((current) => (
      current.length === 1 ? current : current.filter((payment, paymentIndex) => paymentIndex !== index)
    ));
  };

  const clearSale = () => {
    setCustomerId('');
    setProductQuery('');
    setProductResults([]);
    setCart([]);
    setDiscountValue('');
    setPaidAmount('');
    setSplitPayments([{ ...emptySplitPayment }]);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setInvoice(null);

    if (cart.length === 0) {
      setError('Add at least one product to the cart');
      setSubmitting(false);
      return;
    }

    if (receivedAmount <= 0 && finalTotal > 0) {
      setError('Enter a paid amount before completing the sale');
      setSubmitting(false);
      return;
    }

    const saleItems = cart.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.sellingPrice,
      lineTotal: roundMoney(item.quantity * item.sellingPrice)
    }));

    const paymentPayload = paymentMethod === 'Split Payment'
      ? {
        payments: splitPayments
          .filter((payment) => clampMoney(payment.amount) > 0)
          .map((payment) => ({
            paymentMethod: payment.paymentMethod,
            amount: roundMoney(clampMoney(payment.amount))
          }))
      }
      : {
        paymentMethod,
        paidAmount: receivedAmount
      };

    try {
      const response = await createResource('/sales', {
        customerId: customerId ? Number(customerId) : null,
        items: saleItems,
        subtotalAmount: subtotal,
        discountAmount,
        taxAmount,
        totalAmount: finalTotal,
        paidAmount: receivedAmount,
        balanceAmount,
        saleStatus: 'Completed',
        ...paymentPayload
      });

      setInvoice(response.data.invoice);
      clearSale();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Sale could not be completed');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  const handleProductSearchKeyDown = (event) => {
    if (event.key === 'Enter' && productResults[0]) {
      event.preventDefault();
      addProductToCart(productResults[0]);
    }
  };

  return (
    <section className="page-stack">
      <PageHeader
        eyebrow="Cashier"
        title="Cashier POS"
        description="Checkout, payment capture, invoice, and receipt printing."
      />
      <form className="pos-workspace" onSubmit={handleSubmit}>
        <section className="panel pos-search-panel">
          <div className="pos-search-row">
            <label>
              Product search
              <input
                autoComplete="off"
                onChange={(event) => setProductQuery(event.target.value)}
                onKeyDown={handleProductSearchKeyDown}
                placeholder="Name or barcode"
                type="search"
                value={productQuery}
              />
            </label>
            <label>
              Customer ID
              <input
                min="1"
                onChange={(event) => setCustomerId(event.target.value)}
                placeholder="Walk-in"
                type="number"
                value={customerId}
              />
            </label>
          </div>
          {error ? <p className="form-error">{error}</p> : null}
          <div className="product-results">
            {searching ? <p className="muted">Searching products...</p> : null}
            {!searching && productQuery.trim().length >= 2 && productResults.length === 0 ? (
              <p className="muted">No products found.</p>
            ) : null}
            {productResults.map((product) => (
              <button
                className="product-result"
                disabled={Number(product.currentStock || 0) <= 0}
                key={product.productId}
                onClick={() => addProductToCart(product)}
                type="button"
              >
                <span>
                  <strong>{product.productName}</strong>
                  <small>{product.barcode || product.sku || 'No barcode'}</small>
                </span>
                <span>{formatCurrency(product.sellingPrice)}</span>
                <span>{product.currentStock} in stock</span>
              </button>
            ))}
          </div>
        </section>

        <section className="panel cart-panel">
          <div className="panel-heading">
            <h2>Cart</h2>
            <span>{cart.length} items</span>
          </div>
          <div className="cart-table">
            <div className="cart-row cart-row--head">
              <span>Product</span>
              <span>Price</span>
              <span>Qty</span>
              <span>Total</span>
              <span />
            </div>
            {cart.length > 0 ? cart.map((item) => (
              <div className="cart-row" key={item.productId}>
                <span>
                  <strong>{item.productName}</strong>
                  <small>{item.barcode || item.sku || 'No barcode'}</small>
                </span>
                <span>{formatCurrency(item.sellingPrice)}</span>
                <input
                  aria-label={`Quantity for ${item.productName}`}
                  max={item.currentStock}
                  min="1"
                  onChange={(event) => updateCartQuantity(item.productId, event.target.value)}
                  type="number"
                  value={item.quantity}
                />
                <span>{formatCurrency(item.quantity * item.sellingPrice)}</span>
                <button
                  className="ghost-button cart-remove-button"
                  onClick={() => removeCartItem(item.productId)}
                  type="button"
                >
                  Remove
                </button>
              </div>
            )) : (
              <p className="muted cart-empty">Cart is empty.</p>
            )}
          </div>
        </section>

        <aside className="panel totals-panel">
          <h2>Payment</h2>
          <div className="totals-list">
            <div>
              <span>Subtotal</span>
              <strong>{formatCurrency(subtotal)}</strong>
            </div>
            <div>
              <span>Discount</span>
              <strong>{formatCurrency(discountAmount)}</strong>
            </div>
            <div>
              <span>Tax</span>
              <strong>{formatCurrency(taxAmount)}</strong>
            </div>
            <div className="totals-list__total">
              <span>Final total</span>
              <strong>{formatCurrency(finalTotal)}</strong>
            </div>
          </div>

          <div className="discount-grid">
            <label>
              Discount
              <input
                min="0"
                onChange={(event) => setDiscountValue(event.target.value)}
                step="0.01"
                type="number"
                value={discountValue}
              />
            </label>
            <label>
              Type
              <select value={discountType} onChange={(event) => setDiscountType(event.target.value)}>
                <option value="amount">Amount</option>
                <option value="percent">Percent</option>
              </select>
            </label>
            <label>
              Tax %
              <input
                min="0"
                onChange={(event) => setTaxRate(event.target.value)}
                step="0.01"
                type="number"
                value={taxRate}
              />
            </label>
          </div>

          <label>
            Payment method
            <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
              {paymentMethods.map((method) => (
                <option key={method}>{method}</option>
              ))}
            </select>
          </label>

          {paymentMethod === 'Split Payment' ? (
            <div className="split-payments">
              {splitPayments.map((payment, index) => (
                <div className="split-payment-row" key={`split-payment-${index}`}>
                  <select
                    value={payment.paymentMethod}
                    onChange={(event) => updateSplitPayment(index, 'paymentMethod', event.target.value)}
                  >
                    {splitPaymentMethods.map((method) => (
                      <option key={method}>{method}</option>
                    ))}
                  </select>
                  <input
                    min="0"
                    onChange={(event) => updateSplitPayment(index, 'amount', event.target.value)}
                    placeholder="Amount"
                    step="0.01"
                    type="number"
                    value={payment.amount}
                  />
                  <button className="ghost-button" onClick={() => removeSplitPayment(index)} type="button">
                    Remove
                  </button>
                </div>
              ))}
              <button className="ghost-button" onClick={addSplitPayment} type="button">
                Add payment
              </button>
            </div>
          ) : (
            <label>
              Paid amount
              <input
                min="0"
                onChange={(event) => setPaidAmount(event.target.value)}
                placeholder={finalTotal ? String(finalTotal.toFixed(2)) : '0.00'}
                step="0.01"
                type="number"
                value={paidAmount}
              />
            </label>
          )}

          <div className="payment-summary">
            <div>
              <span>Paid</span>
              <strong>{formatCurrency(receivedAmount)}</strong>
            </div>
            <div>
              <span>Balance</span>
              <strong>{formatCurrency(balanceAmount)}</strong>
            </div>
            <div>
              <span>Change</span>
              <strong>{formatCurrency(changeAmount)}</strong>
            </div>
          </div>

          <div className="pos-actions pos-actions--stacked">
            <button className="primary-button" disabled={submitting} type="submit">
              {submitting ? 'Completing...' : 'Complete sale'}
            </button>
            <button
              className="ghost-button"
              disabled={!invoice}
              onClick={handlePrintReceipt}
              type="button"
            >
              Print receipt
            </button>
          </div>
        </aside>
      </form>

      <section className="panel receipt-panel printable-receipt">
        <div className="panel-heading">
          <h2>Receipt</h2>
          {invoice ? <span>{invoice.invoiceNumber}</span> : null}
        </div>
        {invoice ? (
          <div className="receipt">
            <div className="receipt-store">
              <strong>{invoice.store?.storeName || 'Grocery Store'}</strong>
              {invoice.store?.address ? <span>{invoice.store.address}</span> : null}
              {invoice.store?.phone ? <span>{invoice.store.phone}</span> : null}
            </div>
            <div className="receipt-meta">
              <span>{invoice.invoiceNumber}</span>
              <span>{formatDateTime(invoice.saleDate)}</span>
              <span>{invoice.cashier?.name || 'Cashier'}</span>
            </div>
            <div className="receipt-lines">
              {invoice.items?.map((item) => (
                <div key={item.saleItemId}>
                  <span>{item.productName}</span>
                  <span>{item.quantity} x {formatCurrency(item.unitPrice, invoice.store?.currencyCode || DEFAULT_CURRENCY)}</span>
                  <strong>{formatCurrency(item.lineTotal, invoice.store?.currencyCode || DEFAULT_CURRENCY)}</strong>
                </div>
              ))}
            </div>
            <div className="receipt-totals">
              <div>
                <span>Subtotal</span>
                <strong>{formatCurrency(invoice.subtotalAmount, invoice.store?.currencyCode || DEFAULT_CURRENCY)}</strong>
              </div>
              <div>
                <span>Discount</span>
                <strong>{formatCurrency(invoice.discountAmount, invoice.store?.currencyCode || DEFAULT_CURRENCY)}</strong>
              </div>
              <div>
                <span>Tax</span>
                <strong>{formatCurrency(invoice.taxAmount, invoice.store?.currencyCode || DEFAULT_CURRENCY)}</strong>
              </div>
              <div>
                <span>Total</span>
                <strong>{formatCurrency(invoice.totalAmount, invoice.store?.currencyCode || DEFAULT_CURRENCY)}</strong>
              </div>
              <div>
                <span>Paid</span>
                <strong>{formatCurrency(invoice.paidAmount, invoice.store?.currencyCode || DEFAULT_CURRENCY)}</strong>
              </div>
              <div>
                <span>Balance</span>
                <strong>{formatCurrency(invoice.balanceAmount, invoice.store?.currencyCode || DEFAULT_CURRENCY)}</strong>
              </div>
            </div>
            {invoice.store?.receiptFooter ? (
              <p className="receipt-footer">{invoice.store.receiptFooter}</p>
            ) : null}
          </div>
        ) : (
          <p className="muted">Completed sale receipt appears here.</p>
        )}
      </section>
    </section>
  );
};

export default CashierPOS;
