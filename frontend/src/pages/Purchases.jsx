import { useEffect, useMemo, useState } from 'react';
import DataTable from '../components/DataTable.jsx';
import PageHeader from '../components/PageHeader.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { createResource, getResource, updateResource } from '../api/resourcesApi.js';
import { formatCurrency, formatDateTime } from '../utils/formatters.js';

const emptyPurchaseItem = {
  productId: '',
  quantity: 1,
  unitCost: '',
  batchNumber: '',
  manufacturedDate: '',
  expiryDate: ''
};

const purchaseStatusOptions = ['Ordered', 'Received', 'Cancelled'];

const toNumber = (value) => Math.max(Number(value || 0), 0);

const Purchases = () => {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [editingPurchase, setEditingPurchase] = useState(null);
  const [statusForm, setStatusForm] = useState('Received');
  const [form, setForm] = useState({
    purchaseNumber: '',
    supplierId: '',
    purchaseStatus: 'Received',
    amountPaid: '',
    discountAmount: '',
    taxAmount: '',
    notes: ''
  });
  const [items, setItems] = useState([{ ...emptyPurchaseItem }]);

  const requestParams = useMemo(() => (
    search.trim() ? { search: search.trim() } : {}
  ), [search]);

  const subtotal = useMemo(() => items.reduce((total, item) => (
    total + (toNumber(item.quantity) * toNumber(item.unitCost))
  ), 0), [items]);
  const discountAmount = Math.min(toNumber(form.discountAmount), subtotal);
  const taxAmount = toNumber(form.taxAmount);
  const totalAmount = Math.max(subtotal - discountAmount + taxAmount, 0);
  const balanceAmount = Math.max(totalAmount - toNumber(form.amountPaid), 0);

  const loadRows = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await getResource('/purchases', requestParams);
      setRows(response.data.purchases || []);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not load purchases');
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
        const response = await getResource('/purchases', requestParams);

        if (!ignore) {
          setRows(response.data.purchases || []);
        }
      } catch (requestError) {
        if (!ignore) {
          setError(requestError.response?.data?.message || 'Could not load purchases');
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

  const addItem = () => setItems((current) => [...current, { ...emptyPurchaseItem }]);

  const removeItem = (index) => {
    setItems((current) => (
      current.length === 1 ? current : current.filter((item, itemIndex) => itemIndex !== index)
    ));
  };

  const resetForm = () => {
    setForm({
      purchaseNumber: '',
      supplierId: '',
      purchaseStatus: 'Received',
      amountPaid: '',
      discountAmount: '',
      taxAmount: '',
      notes: ''
    });
    setItems([{ ...emptyPurchaseItem }]);
  };

  const submitPurchase = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');

    try {
      const purchaseItems = items
        .filter((item) => item.productId && Number(item.quantity) > 0)
        .map((item) => ({
          productId: Number(item.productId),
          quantity: Number(item.quantity),
          unitCost: toNumber(item.unitCost),
          lineTotal: toNumber(item.quantity) * toNumber(item.unitCost),
          batchNumber: item.batchNumber || null,
          manufacturedDate: item.manufacturedDate || null,
          expiryDate: item.expiryDate || null
        }));

      await createResource('/purchases', {
        purchaseNumber: form.purchaseNumber || undefined,
        supplierId: Number(form.supplierId),
        purchaseStatus: form.purchaseStatus,
        subtotalAmount: subtotal,
        discountAmount,
        taxAmount,
        totalAmount,
        amountPaid: toNumber(form.amountPaid),
        balanceAmount,
        notes: form.notes || null,
        items: purchaseItems
      });

      setMessage('Purchase added');
      resetForm();
      await loadRows();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not save purchase');
    } finally {
      setSaving(false);
    }
  };

  const startStatusEdit = (row) => {
    setEditingPurchase(row);
    setStatusForm(row.purchaseStatus);
    setMessage('');
    setError('');
  };

  const submitStatusEdit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');

    try {
      await updateResource(`/purchases/${editingPurchase.purchaseId}/status`, {
        purchaseStatus: statusForm
      });
      setMessage('Purchase status updated');
      setEditingPurchase(null);
      await loadRows();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not update purchase status');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { key: 'purchaseNumber', label: 'Purchase No.' },
    { key: 'supplierName', label: 'Supplier' },
    { key: 'purchaseDate', label: 'Date', render: (row) => formatDateTime(row.purchaseDate) },
    { key: 'totalAmount', label: 'Total', render: (row) => formatCurrency(row.totalAmount) },
    {
      key: 'purchaseStatus',
      label: 'Status',
      render: (row) => <StatusBadge tone="info">{row.purchaseStatus}</StatusBadge>
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
        eyebrow="Purchasing"
        title="Purchases"
        description="Add purchase orders, receive stock, and update purchase status."
        actions={(
          <input
            className="search-input"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search purchase number"
            type="search"
            value={search}
          />
        )}
      />
      <div className="management-grid">
        <form className="panel management-form" onSubmit={editingPurchase ? submitStatusEdit : submitPurchase}>
          <div className="panel-heading">
            <h2>{editingPurchase ? 'Edit Purchase Status' : 'Add Purchases'}</h2>
            {editingPurchase ? (
              <button className="ghost-button" onClick={() => setEditingPurchase(null)} type="button">
                Cancel
              </button>
            ) : null}
          </div>
          {error ? <p className="form-error">{error}</p> : null}
          {message ? <p className="form-success">{message}</p> : null}
          {editingPurchase ? (
            <>
              <p className="muted">{editingPurchase.purchaseNumber}</p>
              <label>
                Purchase status
                <select value={statusForm} onChange={(event) => setStatusForm(event.target.value)}>
                  {purchaseStatusOptions.map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
              </label>
            </>
          ) : (
            <>
              <div className="management-form-grid">
                <label>
                  Purchase number
                  <input value={form.purchaseNumber} onChange={(event) => updateForm('purchaseNumber', event.target.value)} />
                </label>
                <label>
                  Supplier ID
                  <input min="1" required type="number" value={form.supplierId} onChange={(event) => updateForm('supplierId', event.target.value)} />
                </label>
                <label>
                  Status
                  <select value={form.purchaseStatus} onChange={(event) => updateForm('purchaseStatus', event.target.value)}>
                    {purchaseStatusOptions.map((status) => (
                      <option key={status}>{status}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Paid amount
                  <input min="0" step="0.01" type="number" value={form.amountPaid} onChange={(event) => updateForm('amountPaid', event.target.value)} />
                </label>
                <label>
                  Discount
                  <input min="0" step="0.01" type="number" value={form.discountAmount} onChange={(event) => updateForm('discountAmount', event.target.value)} />
                </label>
                <label>
                  Tax
                  <input min="0" step="0.01" type="number" value={form.taxAmount} onChange={(event) => updateForm('taxAmount', event.target.value)} />
                </label>
                <label className="field-full">
                  Notes
                  <textarea rows="2" value={form.notes} onChange={(event) => updateForm('notes', event.target.value)} />
                </label>
              </div>
              <div className="line-items">
                {items.map((item, index) => (
                  <div className="purchase-item-row" key={`purchase-item-${index}`}>
                    <input placeholder="Product ID" min="1" required type="number" value={item.productId} onChange={(event) => updateItem(index, 'productId', event.target.value)} />
                    <input placeholder="Qty" min="1" required type="number" value={item.quantity} onChange={(event) => updateItem(index, 'quantity', event.target.value)} />
                    <input placeholder="Unit cost" min="0" required step="0.01" type="number" value={item.unitCost} onChange={(event) => updateItem(index, 'unitCost', event.target.value)} />
                    <input placeholder="Batch" value={item.batchNumber} onChange={(event) => updateItem(index, 'batchNumber', event.target.value)} />
                    <input title="Manufactured date" type="date" value={item.manufacturedDate} onChange={(event) => updateItem(index, 'manufacturedDate', event.target.value)} />
                    <input title="Expiry date" type="date" value={item.expiryDate} onChange={(event) => updateItem(index, 'expiryDate', event.target.value)} />
                    <button className="ghost-button" onClick={() => removeItem(index)} type="button">Remove</button>
                  </div>
                ))}
              </div>
              <button className="ghost-button" onClick={addItem} type="button">
                Add item
              </button>
              <div className="totals-list">
                <div><span>Subtotal</span><strong>{formatCurrency(subtotal)}</strong></div>
                <div><span>Total</span><strong>{formatCurrency(totalAmount)}</strong></div>
                <div><span>Balance</span><strong>{formatCurrency(balanceAmount)}</strong></div>
              </div>
            </>
          )}
          <div className="form-footer">
            <button className="primary-button" disabled={saving} type="submit">
              {saving ? 'Saving...' : editingPurchase ? 'Save status' : 'Add Purchase'}
            </button>
          </div>
        </form>
        <section className="panel management-table">
          {loading ? <p className="muted">Loading purchases...</p> : <DataTable columns={columns} rows={rows} />}
        </section>
      </div>
    </section>
  );
};

export default Purchases;
