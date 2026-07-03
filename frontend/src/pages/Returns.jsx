import { useEffect, useMemo, useState } from 'react';
import DataTable from '../components/DataTable.jsx';
import PageHeader from '../components/PageHeader.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { createResource, getResource, updateResource } from '../api/resourcesApi.js';
import { formatCurrency, formatDateTime } from '../utils/formatters.js';

const emptyReturnItem = {
  saleItemId: '',
  productId: '',
  quantity: 1,
  unitRefundAmount: ''
};

const returnStatusOptions = ['Pending', 'Completed', 'Rejected'];

const toNumber = (value) => Math.max(Number(value || 0), 0);

const Returns = () => {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [editingReturn, setEditingReturn] = useState(null);
  const [statusForm, setStatusForm] = useState('Completed');
  const [form, setForm] = useState({
    returnNumber: '',
    saleId: '',
    customerId: '',
    returnStatus: 'Completed',
    reason: ''
  });
  const [items, setItems] = useState([{ ...emptyReturnItem }]);

  const requestParams = useMemo(() => (
    search.trim() ? { search: search.trim() } : {}
  ), [search]);

  const totalRefundAmount = useMemo(() => items.reduce((total, item) => (
    total + (toNumber(item.quantity) * toNumber(item.unitRefundAmount))
  ), 0), [items]);

  const loadRows = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await getResource('/returns', requestParams);
      setRows(response.data.returns || []);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not load returns');
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
        const response = await getResource('/returns', requestParams);

        if (!ignore) {
          setRows(response.data.returns || []);
        }
      } catch (requestError) {
        if (!ignore) {
          setError(requestError.response?.data?.message || 'Could not load returns');
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

  const updateForm = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value
    }));
  };

  const updateItem = (index, field, value) => {
    setItems((current) => current.map((item, itemIndex) => (
      itemIndex === index ? { ...item, [field]: value } : item
    )));
  };

  const addItem = () => setItems((current) => [...current, { ...emptyReturnItem }]);

  const removeItem = (index) => {
    setItems((current) => (
      current.length === 1 ? current : current.filter((item, itemIndex) => itemIndex !== index)
    ));
  };

  const resetForm = () => {
    setForm({
      returnNumber: '',
      saleId: '',
      customerId: '',
      returnStatus: 'Completed',
      reason: ''
    });
    setItems([{ ...emptyReturnItem }]);
  };

  const submitReturn = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');

    try {
      const returnItems = items
        .filter((item) => Number(item.quantity) > 0 && (item.saleItemId || item.productId))
        .map((item) => ({
          saleItemId: item.saleItemId ? Number(item.saleItemId) : undefined,
          productId: item.productId ? Number(item.productId) : undefined,
          quantity: Number(item.quantity),
          unitRefundAmount: toNumber(item.unitRefundAmount),
          lineRefundAmount: toNumber(item.quantity) * toNumber(item.unitRefundAmount)
        }));

      await createResource('/returns', {
        returnNumber: form.returnNumber || undefined,
        saleId: Number(form.saleId),
        customerId: form.customerId ? Number(form.customerId) : null,
        returnStatus: form.returnStatus,
        reason: form.reason || null,
        totalRefundAmount,
        items: returnItems
      });

      setMessage('Return added');
      resetForm();
      await loadRows();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not save return');
    } finally {
      setSaving(false);
    }
  };

  const startStatusEdit = (row) => {
    setEditingReturn(row);
    setStatusForm(row.returnStatus);
    setMessage('');
    setError('');
  };

  const submitStatusEdit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');

    try {
      await updateResource(`/returns/${editingReturn.returnId}/status`, {
        returnStatus: statusForm
      });
      setMessage('Return status updated');
      setEditingReturn(null);
      await loadRows();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not update return status');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { key: 'returnNumber', label: 'Return No.' },
    { key: 'invoiceNumber', label: 'Invoice' },
    { key: 'customerName', label: 'Customer' },
    { key: 'returnDate', label: 'Date', render: (row) => formatDateTime(row.returnDate) },
    { key: 'totalRefundAmount', label: 'Refund', render: (row) => formatCurrency(row.totalRefundAmount) },
    {
      key: 'returnStatus',
      label: 'Status',
      render: (row) => <StatusBadge tone="info">{row.returnStatus}</StatusBadge>
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <button className="ghost-button" onClick={() => startStatusEdit(row)} type="button">
          Edit
        </button>
      )
    }
  ];

  return (
    <section className="page-stack">
      <PageHeader
        eyebrow="Sales"
        title="Returns"
        description="Create customer returns and update return processing status."
        actions={(
          <input
            className="search-input"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search return number"
            type="search"
            value={search}
          />
        )}
      />
      <div className="management-grid">
        <form className="panel management-form" onSubmit={editingReturn ? submitStatusEdit : submitReturn}>
          <div className="panel-heading">
            <h2>{editingReturn ? 'Edit Return Status' : 'Add Returns'}</h2>
            {editingReturn ? (
              <button className="ghost-button" onClick={() => setEditingReturn(null)} type="button">
                Cancel
              </button>
            ) : null}
          </div>
          {error ? <p className="form-error">{error}</p> : null}
          {message ? <p className="form-success">{message}</p> : null}
          {editingReturn ? (
            <>
              <p className="muted">{editingReturn.returnNumber}</p>
              <label>
                Return status
                <select value={statusForm} onChange={(event) => setStatusForm(event.target.value)}>
                  {returnStatusOptions.map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
              </label>
            </>
          ) : (
            <>
              <div className="management-form-grid">
                <label>
                  Return number
                  <input value={form.returnNumber} onChange={(event) => updateForm('returnNumber', event.target.value)} />
                </label>
                <label>
                  Sale ID
                  <input min="1" required type="number" value={form.saleId} onChange={(event) => updateForm('saleId', event.target.value)} />
                </label>
                <label>
                  Customer ID
                  <input min="1" type="number" value={form.customerId} onChange={(event) => updateForm('customerId', event.target.value)} />
                </label>
                <label>
                  Status
                  <select value={form.returnStatus} onChange={(event) => updateForm('returnStatus', event.target.value)}>
                    {returnStatusOptions.map((status) => (
                      <option key={status}>{status}</option>
                    ))}
                  </select>
                </label>
                <label className="field-full">
                  Reason
                  <textarea rows="2" value={form.reason} onChange={(event) => updateForm('reason', event.target.value)} />
                </label>
              </div>
              <div className="line-items">
                {items.map((item, index) => (
                  <div className="return-item-row" key={`return-item-${index}`}>
                    <input placeholder="Sale item ID" min="1" type="number" value={item.saleItemId} onChange={(event) => updateItem(index, 'saleItemId', event.target.value)} />
                    <input placeholder="Product ID" min="1" type="number" value={item.productId} onChange={(event) => updateItem(index, 'productId', event.target.value)} />
                    <input placeholder="Qty" min="1" required type="number" value={item.quantity} onChange={(event) => updateItem(index, 'quantity', event.target.value)} />
                    <input placeholder="Refund each" min="0" required step="0.01" type="number" value={item.unitRefundAmount} onChange={(event) => updateItem(index, 'unitRefundAmount', event.target.value)} />
                    <button className="ghost-button" onClick={() => removeItem(index)} type="button">Remove</button>
                  </div>
                ))}
              </div>
              <button className="ghost-button" onClick={addItem} type="button">
                Add item
              </button>
              <div className="totals-list">
                <div><span>Total refund</span><strong>{formatCurrency(totalRefundAmount)}</strong></div>
              </div>
            </>
          )}
          <div className="form-footer">
            <button className="primary-button" disabled={saving} type="submit">
              {saving ? 'Saving...' : editingReturn ? 'Save status' : 'Add Return'}
            </button>
          </div>
        </form>
        <section className="panel management-table">
          {loading ? <p className="muted">Loading returns...</p> : <DataTable columns={columns} rows={rows} />}
        </section>
      </div>
    </section>
  );
};

export default Returns;
