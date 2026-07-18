import { useEffect, useMemo, useRef, useState } from 'react';
import PageHeader from '../components/PageHeader.jsx';
import { createResource, getResource } from '../api/resourcesApi.js';
import {
  DEFAULT_CURRENCY,
  formatCurrency,
  formatDateTime,
  formatQuantity
} from '../utils/formatters.js';
import {
  isEpsonPrinterConfigured,
  printReceiptWithEpson
} from '../utils/epsonReceiptPrinter.js';

const paymentMethods = ['Cash', 'Card', 'Bank Transfer', 'QR Payment', 'Split Payment'];
const splitPaymentMethods = ['Cash', 'Card', 'Bank Transfer', 'QR Payment'];
const billCategories = [
  { value: 'sellingPrice', label: 'Selling' },
  { value: 'retailPrice', label: 'Retail' },
  { value: 'wholesalePrice', label: 'Wholesale' }
];
const quantityStep = '0.01';
const minimumQuantity = 0.01;

const emptySplitPayment = {
  paymentMethod: 'Cash',
  amount: ''
};

const clampMoney = (value) => Math.max(Number(value || 0), 0);

const roundMoney = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const roundQuantity = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 1000) / 1000;

const getCartItemId = (productId, unitPrice) => `${productId}-${unitPrice.toFixed(2)}`;

const getProductCode = (product) => product.barcode || product.sku || 'No code';

const getBillCategoryPrice = (product, billCategory) => (
  Number(product?.[billCategory] ?? product?.sellingPrice ?? 0)
);

const getBillCategoryLabel = (billCategory) => (
  billCategories.find((category) => category.value === billCategory)?.label || 'Selling'
);

const escapeReceiptText = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const buildReceiptPrintDocument = (invoice) => {
  const currencyCode = invoice.store?.currencyCode || DEFAULT_CURRENCY;
  const paidAmount = Number(invoice.paidAmount || 0);
  const totalAmount = Number(invoice.totalAmount || 0);
  const changeAmount = Math.max(paidAmount - totalAmount, 0);
  const receiptLines = (invoice.items || []).map((item) => `
    <div class="receipt-line">
      <span>${escapeReceiptText(item.productName)}</span>
      <span>${escapeReceiptText(formatQuantity(item.quantity))} x ${escapeReceiptText(formatCurrency(item.unitPrice, currencyCode))}</span>
      <strong>${escapeReceiptText(formatCurrency(item.lineTotal, currencyCode))}</strong>
    </div>
  `).join('');

  return `
    <!doctype html>
    <html>
      <head>
        <title>${escapeReceiptText(invoice.invoiceNumber || 'Receipt')}</title>
        <style>
          @page {
            size: 80mm auto;
            margin: 4mm;
          }

          * {
            box-sizing: border-box;
          }

          body {
            width: 72mm;
            margin: 0;
            color: #111;
            font-family: Arial, Helvetica, sans-serif;
            font-size: 12px;
            line-height: 1.35;
          }

          .store,
          .meta,
          .footer {
            display: grid;
            gap: 2px;
            text-align: center;
          }

          .store strong {
            font-size: 16px;
          }

          .meta {
            margin-top: 10px;
            color: #333;
          }

          .receipt-lines {
            display: grid;
            gap: 7px;
            border-top: 1px dashed #444;
            border-bottom: 1px dashed #444;
            margin: 12px 0;
            padding: 10px 0;
          }

          .receipt-line {
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto auto;
            gap: 8px;
            align-items: start;
          }

          .receipt-line span:first-child {
            overflow-wrap: anywhere;
          }

          .totals {
            display: grid;
            gap: 5px;
          }

          .totals div {
            display: flex;
            justify-content: space-between;
            gap: 12px;
          }

          .totals .grand-total {
            border-top: 1px solid #222;
            margin-top: 4px;
            padding-top: 6px;
            font-size: 14px;
          }

          .footer {
            margin-top: 12px;
          }
        </style>
      </head>
      <body>
        <main>
          <section class="store">
            <strong>${escapeReceiptText(invoice.store?.storeName || 'Grocery Store')}</strong>
            ${invoice.store?.address ? `<span>${escapeReceiptText(invoice.store.address)}</span>` : ''}
            ${invoice.store?.phone ? `<span>${escapeReceiptText(invoice.store.phone)}</span>` : ''}
          </section>

          <section class="meta">
            <span>${escapeReceiptText(invoice.invoiceNumber)}</span>
            <span>${escapeReceiptText(formatDateTime(invoice.saleDate))}</span>
            <span>Customer: ${escapeReceiptText(invoice.customer?.name || 'Walk-in')}</span>
            <span>${escapeReceiptText(invoice.cashier?.name || 'Cashier')}</span>
            <span>Payment: ${escapeReceiptText(invoice.paymentStatus || 'Paid')}</span>
          </section>

          <section class="receipt-lines">
            ${receiptLines}
          </section>

          <section class="totals">
            <div><span>Subtotal</span><strong>${escapeReceiptText(formatCurrency(invoice.subtotalAmount, currencyCode))}</strong></div>
            <div><span>Discount</span><strong>${escapeReceiptText(formatCurrency(invoice.discountAmount, currencyCode))}</strong></div>
            <div><span>Tax</span><strong>${escapeReceiptText(formatCurrency(invoice.taxAmount, currencyCode))}</strong></div>
            <div class="grand-total"><span>Total</span><strong>${escapeReceiptText(formatCurrency(totalAmount, currencyCode))}</strong></div>
            <div><span>Paid</span><strong>${escapeReceiptText(formatCurrency(paidAmount, currencyCode))}</strong></div>
            <div><span>Balance</span><strong>${escapeReceiptText(formatCurrency(invoice.balanceAmount, currencyCode))}</strong></div>
            <div><span>Change</span><strong>${escapeReceiptText(formatCurrency(changeAmount, currencyCode))}</strong></div>
          </section>

          ${invoice.store?.receiptFooter ? `<p class="footer">${escapeReceiptText(invoice.store.receiptFooter)}</p>` : ''}
        </main>
      </body>
    </html>
  `;
};

const CashierPOS = () => {
  const productSearchRef = useRef(null);
  const quantityInputRef = useRef(null);
  const priceInputRef = useRef(null);
  const [customerId, setCustomerId] = useState('');
  const [customers, setCustomers] = useState([]);
  const [productQuery, setProductQuery] = useState('');
  const [productResults, setProductResults] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [billCategory, setBillCategory] = useState('sellingPrice');
  const [quantityInput, setQuantityInput] = useState('1');
  const [priceInput, setPriceInput] = useState('');
  const [searching, setSearching] = useState(false);
  const [cart, setCart] = useState([]);
  const [discountType, setDiscountType] = useState('amount');
  const [discountValue, setDiscountValue] = useState('');
  const [taxRate, setTaxRate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [isCreditSale, setIsCreditSale] = useState(false);
  const [paidAmount, setPaidAmount] = useState('');
  const [splitPayments, setSplitPayments] = useState([{ ...emptySplitPayment }]);
  const [submitting, setSubmitting] = useState(false);
  const [printingReceipt, setPrintingReceipt] = useState(false);
  const [printMessage, setPrintMessage] = useState('');
  const [printError, setPrintError] = useState('');
  const [error, setError] = useState('');
  const [invoice, setInvoice] = useState(null);

  useEffect(() => {
    let ignore = false;

    const loadCustomers = async () => {
      try {
        const response = await getResource('/customers', { isActive: true, limit: 100 });

        if (!ignore) {
          setCustomers(response.data.customers || []);
        }
      } catch (requestError) {
        if (!ignore) {
          setCustomers([]);
          setError(requestError.response?.data?.message || 'Customers could not be loaded');
        }
      }
    };

    loadCustomers();

    return () => {
      ignore = true;
    };
  }, []);

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
  const selectedCustomer = customers.find((customer) => String(customer.customerId) === customerId) || null;

  const selectProduct = (product) => {
    setError('');
    setSelectedProduct(product);
    setQuantityInput('1');
    setPriceInput(String(getBillCategoryPrice(product, billCategory).toFixed(2)));

    window.requestAnimationFrame(() => {
      quantityInputRef.current?.focus();
      quantityInputRef.current?.select();
    });
  };

  const handleBillCategoryChange = (value) => {
    setBillCategory(value);

    if (selectedProduct) {
      setPriceInput(String(getBillCategoryPrice(selectedProduct, value).toFixed(2)));
    }
  };

  const addProductToCart = (product, requestedQuantity = 1, requestedUnitPrice = product.sellingPrice) => {
    setError('');

    const quantity = roundQuantity(requestedQuantity);
    const hasUnitPrice = requestedUnitPrice !== undefined && requestedUnitPrice !== null && requestedUnitPrice !== '';
    const unitPrice = roundMoney(requestedUnitPrice);
    const availableStock = Number(product.currentStock || 0);

    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError('Enter a quantity greater than 0');
      return false;
    }

    if (!hasUnitPrice || !Number.isFinite(unitPrice) || unitPrice < 0) {
      setError('Enter a valid price');
      return false;
    }

    if (availableStock <= 0) {
      setError(`${product.productName} is out of stock`);
      return false;
    }

    const cartItemId = getCartItemId(product.productId, unitPrice);
    const existingItem = cart.find((item) => item.cartItemId === cartItemId);
    const currentProductQuantity = cart.reduce((total, item) => (
      item.productId === product.productId ? total + item.quantity : total
    ), 0);
    const nextQuantity = roundQuantity((existingItem?.quantity || 0) + quantity);
    const nextProductQuantity = roundQuantity(currentProductQuantity + quantity);

    if (nextProductQuantity > availableStock) {
      setError(`Only ${formatQuantity(availableStock)} available for ${product.productName}`);
      return false;
    }

    setCart((current) => {
      const existingItem = current.find((item) => item.cartItemId === cartItemId);

      if (existingItem) {
        return current.map((item) => (
          item.cartItemId === cartItemId
            ? { ...item, quantity: nextQuantity }
            : item
        ));
      }

      return [
        ...current,
        {
          cartItemId,
          productId: product.productId,
          productName: product.productName,
          barcode: product.barcode,
          sku: product.sku,
          currentStock: Number(product.currentStock || 0),
          sellingPrice: unitPrice,
          quantity
        }
      ];
    });

    return true;
  };

  const addSelectedProductToCart = () => {
    if (!selectedProduct) {
      setError('Select a product first');
      return;
    }

    const added = addProductToCart(selectedProduct, quantityInput, priceInput);

    if (added) {
      setProductQuery('');
      setProductResults([]);
      setSelectedProduct(null);
      setQuantityInput('1');
      setPriceInput('');
      productSearchRef.current?.focus();
    }
  };

  const updateCartQuantity = (cartItemId, quantity) => {
    const nextQuantity = roundQuantity(quantity);

    if (!Number.isFinite(nextQuantity) || nextQuantity <= 0) {
      return;
    }

    setCart((current) => current.map((item) => {
      if (item.cartItemId !== cartItemId) {
        return item;
      }

      return {
        ...item,
        quantity: Math.min(Math.max(nextQuantity, minimumQuantity), item.currentStock)
      };
    }));
  };

  const removeCartItem = (cartItemId) => {
    setCart((current) => current.filter((item) => item.cartItemId !== cartItemId));
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
    setSelectedProduct(null);
    setQuantityInput('1');
    setPriceInput('');
    setCart([]);
    setDiscountValue('');
    setPaymentMethod('Cash');
    setIsCreditSale(false);
    setPaidAmount('');
    setSplitPayments([{ ...emptySplitPayment }]);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setPrintMessage('');
    setPrintError('');
    setInvoice(null);

    if (cart.length === 0) {
      setError('Add at least one product to the cart');
      setSubmitting(false);
      return;
    }

    if (cart.some((item) => Number(item.quantity) <= 0)) {
      setError('Every cart item needs a quantity greater than 0');
      setSubmitting(false);
      return;
    }

    if (isCreditSale && !customerId) {
      setError('Select a registered customer before placing a sale on credit');
      setSubmitting(false);
      return;
    }

    if (!isCreditSale && receivedAmount < finalTotal) {
      setError('Enter the full paid amount or enable customer credit');
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

      if (customerId) {
        try {
          const customerResponse = await getResource(`/customers/${customerId}`);
          const updatedCustomer = customerResponse.data.customer;
          setCustomers((current) => current.map((customer) => (
            customer.customerId === updatedCustomer.customerId ? updatedCustomer : customer
          )));
        } catch {
          // The sale is already complete; the balance will refresh on the next page load.
        }
      }

      clearSale();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Sale could not be completed');
    } finally {
      setSubmitting(false);
    }
  };

  const printBrowserReceipt = () => {
    const printWindow = window.open('', 'receipt-print', 'width=420,height=640');

    if (!printWindow) {
      window.print();
      return;
    }

    printWindow.document.open();
    printWindow.document.write(buildReceiptPrintDocument(invoice));
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const handlePrintReceipt = async () => {
    if (!invoice) {
      return;
    }

    setPrintingReceipt(true);
    setPrintMessage('');
    setPrintError('');

    if (!isEpsonPrinterConfigured(invoice.store)) {
      printBrowserReceipt();
      setPrintingReceipt(false);
      return;
    }

    try {
      await printReceiptWithEpson(invoice);
      setPrintMessage('Receipt sent to Epson printer');
    } catch (receiptError) {
      setPrintError(`${receiptError.message}. Browser receipt opened instead.`);
      printBrowserReceipt();
    } finally {
      setPrintingReceipt(false);
    }
  };

  const handleProductSearchKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();

      if (selectedProduct) {
        quantityInputRef.current?.focus();
        quantityInputRef.current?.select();
        return;
      }

      if (productResults[0]) {
        selectProduct(productResults[0]);
      }
    }
  };

  const handleQuantityKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      priceInputRef.current?.focus();
      priceInputRef.current?.select();
    }
  };

  const handlePriceKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      addSelectedProductToCart();
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
          <div className="pos-entry-grid">
            <label className="pos-item-field">
              Item code or name
              <input
                autoComplete="off"
                onChange={(event) => {
                  setProductQuery(event.target.value);
                  setSelectedProduct(null);
                  setQuantityInput('1');
                  setPriceInput('');
                }}
                onKeyDown={handleProductSearchKeyDown}
                placeholder="Barcode, SKU, or product name"
                ref={productSearchRef}
                type="search"
                value={productQuery}
              />
            </label>
            <label>
              Bill category
              <select value={billCategory} onChange={(event) => handleBillCategoryChange(event.target.value)}>
                {billCategories.map((category) => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Quantity
              <input
                disabled={!selectedProduct}
                min={quantityStep}
                onChange={(event) => setQuantityInput(event.target.value)}
                onKeyDown={handleQuantityKeyDown}
                ref={quantityInputRef}
                step={quantityStep}
                type="number"
                value={quantityInput}
              />
            </label>
            <label>
              Price
              <input
                disabled={!selectedProduct}
                min="0"
                onChange={(event) => setPriceInput(event.target.value)}
                onKeyDown={handlePriceKeyDown}
                ref={priceInputRef}
                step="0.01"
                type="number"
                value={priceInput}
              />
            </label>
            <button
              className="primary-button pos-add-item-button"
              disabled={!selectedProduct}
              onClick={addSelectedProductToCart}
              type="button"
            >
              Add item
            </button>
            <label>
              Customer
              <select onChange={(event) => setCustomerId(event.target.value)} value={customerId}>
                <option value="">Walk-in customer</option>
                {customers.map((customer) => (
                  <option key={customer.customerId} value={customer.customerId}>
                    {customer.customerName}{customer.phone ? ` - ${customer.phone}` : ''}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {error ? <p className="form-error">{error}</p> : null}
          {selectedProduct ? (
            <div className="selected-product-summary">
              <span>
                <strong>{selectedProduct.productName}</strong>
                <small>{getProductCode(selectedProduct)} - {getBillCategoryLabel(billCategory)}</small>
              </span>
              <span>{formatCurrency(getBillCategoryPrice(selectedProduct, billCategory))}</span>
              <span>{formatQuantity(selectedProduct.currentStock)} in stock</span>
            </div>
          ) : null}
          <div className="product-results">
            {searching ? <p className="muted">Searching products...</p> : null}
            {!searching && productQuery.trim().length >= 2 && productResults.length === 0 ? (
              <p className="muted">No products found.</p>
            ) : null}
            {productResults.map((product) => (
              <button
                className={`product-result${selectedProduct?.productId === product.productId ? ' product-result--selected' : ''}`}
                disabled={Number(product.currentStock || 0) <= 0}
                key={product.productId}
                onClick={() => selectProduct(product)}
                type="button"
              >
                <span>
                  <strong>{product.productName}</strong>
                  <small>{getProductCode(product)}</small>
                </span>
                <span>{formatCurrency(getBillCategoryPrice(product, billCategory))}</span>
                <span>{formatQuantity(product.currentStock)} in stock</span>
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
              <div className="cart-row" key={item.cartItemId}>
                <span>
                  <strong>{item.productName}</strong>
                  <small>{item.barcode || item.sku || 'No barcode'}</small>
                </span>
                <span>{formatCurrency(item.sellingPrice)}</span>
                <input
                  aria-label={`Quantity for ${item.productName}`}
                  max={item.currentStock}
                  min={quantityStep}
                  onChange={(event) => updateCartQuantity(item.cartItemId, event.target.value)}
                  step={quantityStep}
                  type="number"
                  value={item.quantity}
                />
                <span>{formatCurrency(item.quantity * item.sellingPrice)}</span>
                <button
                  className="ghost-button cart-remove-button"
                  onClick={() => removeCartItem(item.cartItemId)}
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

          <label className={`credit-sale-option${isCreditSale ? ' credit-sale-option--active' : ''}`}>
            <input
              checked={isCreditSale}
              onChange={(event) => setIsCreditSale(event.target.checked)}
              type="checkbox"
            />
            <span>
              <strong>Customer credit</strong>
              <small>Allow full or partial payment and keep the balance due.</small>
            </span>
          </label>

          {isCreditSale ? (
            <div className="credit-customer-summary">
              {selectedCustomer ? (
                <>
                  <span>Credit customer</span>
                  <strong>{selectedCustomer.customerName}</strong>
                  <small>Existing balance: {formatCurrency(selectedCustomer.creditBalance)}</small>
                </>
              ) : (
                <strong>Select a registered customer above.</strong>
              )}
            </div>
          ) : null}

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
              {isCreditSale ? 'Amount paid now (optional)' : 'Paid amount'}
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
              <span>{isCreditSale ? 'Credit due' : 'Balance'}</span>
              <strong>{formatCurrency(balanceAmount)}</strong>
            </div>
            <div>
              <span>Change</span>
              <strong>{formatCurrency(changeAmount)}</strong>
            </div>
          </div>

          <div className="pos-actions pos-actions--stacked">
            <button className="primary-button" disabled={submitting} type="submit">
              {submitting ? 'Completing...' : isCreditSale ? 'Complete credit sale' : 'Complete sale'}
            </button>
            <button
              className="ghost-button"
              disabled={!invoice || printingReceipt}
              onClick={handlePrintReceipt}
              type="button"
            >
              {printingReceipt ? 'Printing...' : 'Print receipt'}
            </button>
          </div>
          {printMessage ? <p className="form-success">{printMessage}</p> : null}
          {printError ? <p className="form-error">{printError}</p> : null}
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
              <span>Customer: {invoice.customer?.name || 'Walk-in'}</span>
              <span>{invoice.cashier?.name || 'Cashier'}</span>
              <span>Payment: {invoice.paymentStatus}</span>
            </div>
            <div className="receipt-lines">
              {invoice.items?.map((item) => (
                <div key={item.saleItemId}>
                  <span>{item.productName}</span>
                  <span>{formatQuantity(item.quantity)} x {formatCurrency(item.unitPrice, invoice.store?.currencyCode || DEFAULT_CURRENCY)}</span>
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
