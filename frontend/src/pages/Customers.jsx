import { useMemo, useRef, useState } from 'react';
import DataTable from '../components/DataTable.jsx';
import ManagementPage from './ManagementPage.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { createResource, getResource } from '../api/resourcesApi.js';
import { formatCurrency, formatDateTime, formatQuantity } from '../utils/formatters.js';

const paymentTone = (status) => {
  if (status === 'Paid') {
    return 'success';
  }

  if (status === 'Unpaid') {
    return 'danger';
  }

  return 'info';
};

const Customers = () => {
  const recordsRef = useRef(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [sales, setSales] = useState([]);
  const [invoice, setInvoice] = useState(null);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [loadingInvoice, setLoadingInvoice] = useState(false);
  const [recordsError, setRecordsError] = useState('');
  const [paymentMessage, setPaymentMessage] = useState('');
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [customerPayment, setCustomerPayment] = useState({
    amount: '',
    paymentMethod: 'Cash',
    transactionReference: ''
  });

  const summary = useMemo(() => sales.reduce((totals, sale) => ({
    totalAmount: totals.totalAmount + Number(sale.totalAmount || 0),
    paidAmount: totals.paidAmount + Number(sale.paidAmount || 0),
    balanceAmount: totals.balanceAmount + (
      sale.saleStatus === 'Completed' ? Number(sale.balanceAmount || 0) : 0
    )
  }), {
    totalAmount: 0,
    paidAmount: 0,
    balanceAmount: 0
  }), [sales]);

  const loadInvoice = async (saleId) => {
    setLoadingInvoice(true);
    setRecordsError('');

    try {
      const response = await getResource(`/sales/${saleId}/invoice`);
      setInvoice(response.data.invoice);
    } catch (requestError) {
      setInvoice(null);
      setRecordsError(requestError.response?.data?.message || 'Could not load bill details');
    } finally {
      setLoadingInvoice(false);
    }
  };

  const selectCustomer = async (customer) => {
    setSelectedCustomer(customer);
    setSales([]);
    setInvoice(null);
    setLoadingRecords(true);
    setRecordsError('');
    setPaymentMessage('');
    setShowPaymentForm(false);

    window.requestAnimationFrame(() => {
      recordsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    try {
      const response = await getResource('/sales', {
        customerId: customer.customerId,
        limit: 100
      });
      const customerSales = response.data.sales || [];
      setSales(customerSales);

      if (customerSales[0]) {
        await loadInvoice(customerSales[0].saleId);
      }
    } catch (requestError) {
      setRecordsError(requestError.response?.data?.message || 'Could not load customer records');
    } finally {
      setLoadingRecords(false);
    }
  };

  const openPaymentForm = () => {
    setCustomerPayment({
      amount: String(summary.balanceAmount.toFixed(2)),
      paymentMethod: 'Cash',
      transactionReference: ''
    });
    setRecordsError('');
    setPaymentMessage('');
    setShowPaymentForm(true);
  };

  const submitCustomerPayment = async (event) => {
    event.preventDefault();
    setSavingPayment(true);
    setRecordsError('');
    setPaymentMessage('');

    try {
      const response = await createResource(`/customers/${selectedCustomer.customerId}`, {
        amount: Number(customerPayment.amount),
        paymentMethod: customerPayment.paymentMethod,
        transactionReference: customerPayment.transactionReference || null
      });
      const payment = response.data.payment;
      const salesResponse = await getResource('/sales', {
        customerId: selectedCustomer.customerId,
        limit: 100
      });
      const customerSales = salesResponse.data.sales || [];
      const allocationCount = payment.allocations?.length || 0;

      setSales(customerSales);
      setSelectedCustomer((current) => ({
        ...current,
        creditBalance: payment.creditBalance
      }));
      setPaymentMessage(
        `${formatCurrency(payment.amount)} received and applied to ${allocationCount} ${allocationCount === 1 ? 'bill' : 'bills'}.`
      );
      setShowPaymentForm(false);

      const billToRefresh = customerSales.find((sale) => sale.saleId === invoice?.saleId)
        || customerSales[0];

      if (billToRefresh) {
        await loadInvoice(billToRefresh.saleId);
      } else {
        setInvoice(null);
      }
    } catch (requestError) {
      setRecordsError(requestError.response?.data?.message || 'Could not record customer payment');
    } finally {
      setSavingPayment(false);
    }
  };

  const saleColumns = [
    {
      key: 'invoiceNumber',
      label: 'Invoice',
      render: (row) => (
        <button className="link-button" onClick={() => loadInvoice(row.saleId)} type="button">
          {row.invoiceNumber}
        </button>
      )
    },
    { key: 'saleDate', label: 'Date', render: (row) => formatDateTime(row.saleDate) },
    { key: 'cashierName', label: 'Cashier' },
    { key: 'totalAmount', label: 'Total', render: (row) => formatCurrency(row.totalAmount) },
    { key: 'paidAmount', label: 'Paid', render: (row) => formatCurrency(row.paidAmount) },
    { key: 'balanceAmount', label: 'Credit due', render: (row) => formatCurrency(row.balanceAmount) },
    {
      key: 'paymentStatus',
      label: 'Payment',
      render: (row) => (
        <StatusBadge tone={paymentTone(row.paymentStatus)}>{row.paymentStatus}</StatusBadge>
      )
    },
    {
      key: 'saleStatus',
      label: 'Sale status',
      render: (row) => <StatusBadge tone="neutral">{row.saleStatus}</StatusBadge>
    }
  ];

  const itemColumns = [
    { key: 'productName', label: 'Product' },
    { key: 'barcode', label: 'Barcode', render: (row) => row.barcode || row.sku || '-' },
    { key: 'quantity', label: 'Quantity', render: (row) => formatQuantity(row.quantity) },
    { key: 'unitPrice', label: 'Unit price', render: (row) => formatCurrency(row.unitPrice) },
    { key: 'lineTotal', label: 'Line total', render: (row) => formatCurrency(row.lineTotal) }
  ];

  const paymentColumns = [
    { key: 'paidAt', label: 'Paid at', render: (row) => formatDateTime(row.paidAt) },
    { key: 'paymentMethod', label: 'Method' },
    { key: 'amount', label: 'Amount', render: (row) => formatCurrency(row.amount) },
    { key: 'receivedByName', label: 'Received by' },
    { key: 'transactionReference', label: 'Reference', render: (row) => row.transactionReference || '-' },
    {
      key: 'paymentStatus',
      label: 'Status',
      render: (row) => <StatusBadge tone="success">{row.paymentStatus}</StatusBadge>
    }
  ];

  return (
    <div className="customer-page-stack">
      <ManagementPage
        eyebrow="Sales"
        title="Customers"
        description="Customer profiles, loyalty points, outstanding credit, and bill history."
        endpoint="/customers"
        dataKey="customers"
        idKey="customerId"
        createRoles={['Admin', 'Manager', 'Cashier']}
        fields={[
          { name: 'customerName', label: 'Customer name', required: true },
          { name: 'phone', label: 'Phone', type: 'tel' },
          { name: 'email', label: 'Email', type: 'email' },
          { name: 'loyaltyPoints', label: 'Loyalty points', type: 'number', valueType: 'integer', min: 0, defaultValue: 0 },
          { name: 'isActive', label: 'Active', type: 'checkbox', defaultValue: true },
          { name: 'address', label: 'Address', type: 'textarea', fullWidth: true }
        ]}
        columns={[
          { key: 'customerName', label: 'Customer' },
          { key: 'phone', label: 'Phone' },
          { key: 'email', label: 'Email' },
          { key: 'loyaltyPoints', label: 'Points' },
          { key: 'creditSalesCount', label: 'Credit sales' },
          {
            key: 'creditBalance',
            label: 'Credit due',
            render: (row) => formatCurrency(row.creditBalance)
          },
          {
            key: 'oldestCreditAt',
            label: 'Oldest credit',
            render: (row) => row.oldestCreditAt ? formatDateTime(row.oldestCreditAt) : '-'
          },
          {
            key: 'isActive',
            label: 'Status',
            render: (row) => (
              <StatusBadge tone={row.isActive ? 'success' : 'neutral'}>
                {row.isActive ? 'Active' : 'Inactive'}
              </StatusBadge>
            )
          }
        ]}
        renderRowActions={(row) => (
          <button className="ghost-button" onClick={() => selectCustomer(row)} type="button">
            Records
          </button>
        )}
      />

      {selectedCustomer ? (
        <section className="customer-records-section" ref={recordsRef}>
          <div className="panel customer-records-heading">
            <div>
              <p className="eyebrow">Customer account</p>
              <h2>{selectedCustomer.customerName}</h2>
              <p>{selectedCustomer.phone || 'No phone'}{selectedCustomer.email ? ` · ${selectedCustomer.email}` : ''}</p>
            </div>
            <div className="customer-record-actions">
              {summary.balanceAmount > 0 ? (
                <button className="primary-button" onClick={openPaymentForm} type="button">
                  Receive payment
                </button>
              ) : null}
              <button className="ghost-button" onClick={() => setSelectedCustomer(null)} type="button">
                Close records
              </button>
            </div>
          </div>

          <div className="customer-summary-grid">
            <div className="stat-card">
              <span>Bills</span>
              <strong>{sales.length}</strong>
            </div>
            <div className="stat-card">
              <span>Total purchases</span>
              <strong>{formatCurrency(summary.totalAmount)}</strong>
            </div>
            <div className="stat-card">
              <span>Total paid</span>
              <strong>{formatCurrency(summary.paidAmount)}</strong>
            </div>
            <div className="stat-card customer-credit-stat">
              <span>Credit due</span>
              <strong>{formatCurrency(summary.balanceAmount)}</strong>
            </div>
          </div>

          {showPaymentForm ? (
            <form className="panel customer-account-payment" onSubmit={submitCustomerPayment}>
              <div className="panel-heading">
                <div>
                  <h2>Receive customer payment</h2>
                  <span>Applied to the oldest outstanding bills first.</span>
                </div>
                <button className="ghost-button" onClick={() => setShowPaymentForm(false)} type="button">
                  Cancel
                </button>
              </div>
              <div className="customer-account-payment-grid">
                <label>
                  Amount
                  <input
                    max={summary.balanceAmount}
                    min="0.01"
                    onChange={(event) => setCustomerPayment((current) => ({ ...current, amount: event.target.value }))}
                    required
                    step="0.01"
                    type="number"
                    value={customerPayment.amount}
                  />
                </label>
                <label>
                  Payment method
                  <select
                    onChange={(event) => setCustomerPayment((current) => ({ ...current, paymentMethod: event.target.value }))}
                    value={customerPayment.paymentMethod}
                  >
                    {['Cash', 'Card', 'Bank Transfer', 'QR Payment'].map((method) => (
                      <option key={method}>{method}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Reference
                  <input
                    onChange={(event) => setCustomerPayment((current) => ({ ...current, transactionReference: event.target.value }))}
                    placeholder="Optional"
                    value={customerPayment.transactionReference}
                  />
                </label>
                <div className="credit-payment-balance">
                  <span>Customer credit due</span>
                  <strong>{formatCurrency(summary.balanceAmount)}</strong>
                </div>
              </div>
              <div className="form-footer">
                <button className="primary-button" disabled={savingPayment} type="submit">
                  {savingPayment ? 'Recording...' : 'Receive payment'}
                </button>
              </div>
            </form>
          ) : null}

          {recordsError ? <p className="form-error">{recordsError}</p> : null}
          {paymentMessage ? <p className="form-success">{paymentMessage}</p> : null}

          <section className="panel customer-sales-history">
            <div className="panel-heading">
              <h2>Bill history</h2>
              <span>{sales.length} records</span>
            </div>
            {loadingRecords ? (
              <p className="muted">Loading customer records...</p>
            ) : (
              <DataTable columns={saleColumns} rows={sales} emptyLabel="No bills found for this customer" />
            )}
          </section>

          {loadingInvoice ? (
            <section className="panel"><p className="muted">Loading bill details...</p></section>
          ) : invoice ? (
            <section className="panel customer-bill-details">
              <div className="panel-heading customer-bill-heading">
                <div>
                  <p className="eyebrow">Bill details</p>
                  <h2>{invoice.invoiceNumber}</h2>
                  <span>{formatDateTime(invoice.saleDate)} · {invoice.cashier?.name}</span>
                </div>
                <StatusBadge tone={paymentTone(invoice.paymentStatus)}>{invoice.paymentStatus}</StatusBadge>
              </div>

              <DataTable columns={itemColumns} rows={invoice.items || []} emptyLabel="No bill items found" />

              <div className="customer-bill-summary">
                <div><span>Subtotal</span><strong>{formatCurrency(invoice.subtotalAmount)}</strong></div>
                <div><span>Discount</span><strong>{formatCurrency(invoice.discountAmount)}</strong></div>
                <div><span>Tax</span><strong>{formatCurrency(invoice.taxAmount)}</strong></div>
                <div><span>Total</span><strong>{formatCurrency(invoice.totalAmount)}</strong></div>
                <div><span>Paid</span><strong>{formatCurrency(invoice.paidAmount)}</strong></div>
                <div className="customer-bill-due"><span>Credit due</span><strong>{formatCurrency(invoice.balanceAmount)}</strong></div>
              </div>

              <div className="customer-payment-history">
                <div className="panel-heading">
                  <h3>Payment history</h3>
                  <span>{invoice.payments?.length || 0} payments</span>
                </div>
                <DataTable columns={paymentColumns} rows={invoice.payments || []} emptyLabel="No payments recorded for this bill" />
              </div>
            </section>
          ) : null}
        </section>
      ) : null}
    </div>
  );
};

export default Customers;
