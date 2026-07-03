import { useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader.jsx';
import { getResource, updateResource } from '../api/resourcesApi.js';

const initialSettings = {
  storeName: '',
  address: '',
  phone: '',
  email: '',
  currencyCode: 'LKR',
  taxRate: 0,
  receiptFooter: ''
};

const StoreSettings = () => {
  const [settings, setSettings] = useState(initialSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let ignore = false;

    const loadSettings = async () => {
      try {
        const response = await getResource('/store-settings');

        if (!ignore) {
          setSettings({
            ...initialSettings,
            ...response.data.settings
          });
        }
      } catch (requestError) {
        if (!ignore) {
          setError(requestError.response?.data?.message || 'Could not load store settings');
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    loadSettings();

    return () => {
      ignore = true;
    };
  }, []);

  const updateField = (field, value) => {
    setSettings((current) => ({
      ...current,
      [field]: value
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');

    try {
      const response = await updateResource('/store-settings', {
        ...settings,
        taxRate: Number(settings.taxRate || 0)
      });
      setSettings({
        ...initialSettings,
        ...response.data.settings
      });
      setMessage('Store settings saved');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not save store settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="page-stack">
      <PageHeader
        eyebrow="Admin"
        title="Store Settings"
        description="Receipt identity, tax, currency, and contact details."
      />
      <form className="panel settings-form" onSubmit={handleSubmit}>
        {error ? <p className="form-error">{error}</p> : null}
        {message ? <p className="form-success">{message}</p> : null}
        {loading ? (
          <p className="muted">Loading settings...</p>
        ) : (
          <>
            <div className="form-grid">
              <label>
                Store name
                <input
                  onChange={(event) => updateField('storeName', event.target.value)}
                  required
                  type="text"
                  value={settings.storeName || ''}
                />
              </label>
              <label>
                Phone
                <input
                  onChange={(event) => updateField('phone', event.target.value)}
                  type="tel"
                  value={settings.phone || ''}
                />
              </label>
              <label>
                Email
                <input
                  onChange={(event) => updateField('email', event.target.value)}
                  type="email"
                  value={settings.email || ''}
                />
              </label>
              <label>
                Currency
                <input
                  maxLength="3"
                  onChange={(event) => updateField('currencyCode', event.target.value.toUpperCase())}
                  required
                  type="text"
                  value={settings.currencyCode || ''}
                />
              </label>
              <label>
                Tax rate
                <input
                  min="0"
                  onChange={(event) => updateField('taxRate', event.target.value)}
                  step="0.01"
                  type="number"
                  value={settings.taxRate ?? 0}
                />
              </label>
            </div>
            <label>
              Address
              <textarea
                onChange={(event) => updateField('address', event.target.value)}
                rows="3"
                value={settings.address || ''}
              />
            </label>
            <label>
              Receipt footer
              <textarea
                onChange={(event) => updateField('receiptFooter', event.target.value)}
                rows="3"
                value={settings.receiptFooter || ''}
              />
            </label>
            <div className="form-footer">
              <button className="primary-button" disabled={saving} type="submit">
                {saving ? 'Saving...' : 'Save settings'}
              </button>
            </div>
          </>
        )}
      </form>
    </section>
  );
};

export default StoreSettings;
