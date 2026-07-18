import { useEffect, useMemo, useState } from 'react';
import DataTable from '../components/DataTable.jsx';
import PageHeader from '../components/PageHeader.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { createResource, getResource } from '../api/resourcesApi.js';
import { formatCurrency, formatDateTime } from '../utils/formatters.js';

const paymentMethods = ['Cash', 'Card', 'Bank Transfer', 'QR Payment'];

const getPaymentTone = (status) => {
  if (status === 'Paid') {
    return 'success';
  }

  if (status === 'Unpaid') {
    return 'danger';
  }

  return 'info';
};

const Sales = () => {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [paymentSale, setPaymentSale] = useState(null);
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    paymentMethod: 'Cash',
    transactionReference: ''
  });

  const requestParams = useMemo(() => (
    search.trim() ? { search: search.trim() } : {}
  ), [search]);

  const loadRows = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await getResource('/sales', requestParams);
      setRows(response.data.sales || []);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not load sales');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;

    const load = async () => {
      setLoading(true);
      setError('');

      try {
        const response = await getResource('/sales', requestParams);

        if (!ignore) {
          setRows(response.data.sales || []);
        }
      } catch (requestError) {
        if (!ignore) {
          setError(requestError.response?.data?.message || 'Could not load sales');
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      ignore = true;
    };
  }, [requestParams]);

  const startPayment = (sale) => {
    setPaymentSale(sale);
    setPaymentForm({
      amount: String(Number(sale.balanceAmount).toFixed(2)),
      paymentMethod: 'Cash',
      transactionReference: ''
    });
    setError('');
    setMessage('');
  };

  const submitPayment = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');

    try {
      await createResource(`/sales/${paymentSale.saleId}/payments`, {
        amount: Number(paymentForm.amount),
        paymentMethod: paymentForm.paymentMethod,
        transactionReference: paymentForm.transactionReference || null
      });
      setMessage(`Payment recorded for ${paymentSale.invoiceNumber}`);
      setPaymentSale(null);
      await loadRows();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not record payment');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { key: 'invoiceNumber', label: 'Invoice' },
    { key: 'customerName', label: 'Customer', render: (row) => row.customerName || 'Walk-in' },
    { key: 'cashierName', label: 'Cashier' },
    { key: 'saleDate', label: 'Date', render: (row) => formatDateTime(row.saleDate) },
    { key: 'totalAmount', label: 'Total', render: (row) => formatCurrency(row.totalAmount) },
    { key: 'paidAmount', label: 'Paid', render: (row) => formatCurrency(row.paidAmount) },
    { key: 'balanceAmount', label: 'Credit due', render: (row) => formatCurrency(row.balanceAmount) },
    {
      key: 'paymentStatus',
      label: 'Payment',
      render: (row) => (
        <StatusBadge tone={getPaymentTone(row.paymentStatus)}>{row.paymentStatus}</StatusBadge>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => Number(row.balanceAmount) > 0 && row.saleStatus === 'Completed' ? (
        <button className="ghost-button" onClick={() => startPayment(row)} type="button">
          Record payment
        </button>
      ) : '-'
    }
  ];

  return (
    <section className="page-stack">
      <PageHeader
        eyebrow="POS"
        title="Sales & Credit"
        description="Invoices, customer credit balances, and payment collection history."
        actions={(
          <input
            className="search-input"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search invoice number"
            type="search"
            value={search}
          />
        )}
      />

      {paymentSale ? (
        <form className="panel credit-payment-form" onSubmit={submitPayment}>
          <div className="panel-heading">
            <div>
              <h2>Record credit payment</h2>
              <span>{paymentSale.invoiceNumber} · {paymentSale.customerName}</span>
            </div>
            <button className="ghost-button" onClick={() => setPaymentSale(null)} type="button">
              Cancel
            </button>
          </div>
          <div className="credit-payment-grid">
            <label>
              Amount
              <input
                max={paymentSale.balanceAmount}
                min="0.01"
                onChange={(event) => setPaymentForm((current) => ({ ...current, amount: event.target.value }))}
                required
                step="0.01"
                type="number"
                value={paymentForm.amount}
              />
            </label>
            <label>
              Payment method
              <select
                onChange={(event) => setPaymentForm((current) => ({ ...current, paymentMethod: event.target.value }))}
                value={paymentForm.paymentMethod}
              >
                {paymentMethods.map((method) => <option key={method}>{method}</option>)}
              </select>
            </label>
            <label>
              Reference
              <input
                onChange={(event) => setPaymentForm((current) => ({ ...current, transactionReference: event.target.value }))}
                placeholder="Optional"
                value={paymentForm.transactionReference}
              />
            </label>
            <div className="credit-payment-balance">
              <span>Outstanding</span>
              <strong>{formatCurrency(paymentSale.balanceAmount)}</strong>
            </div>
          </div>
          <div className="form-footer">
            <button className="primary-button" disabled={saving} type="submit">
              {saving ? 'Recording...' : 'Record payment'}
            </button>
          </div>
        </form>
      ) : null}

      {error ? <p className="form-error">{error}</p> : null}
      {message ? <p className="form-success">{message}</p> : null}

      <section className="panel management-table">
        {loading ? (
          <p className="muted">Loading sales...</p>
        ) : (
          <DataTable columns={columns} rows={rows} emptyLabel="No sales found" />
        )}
      </section>
    </section>
  );
};

export default Sales;
