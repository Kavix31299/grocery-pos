import { useEffect, useMemo, useState } from 'react';
import DataTable from '../components/DataTable.jsx';
import PageHeader from '../components/PageHeader.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import {
  createResource,
  deleteResource,
  getResource,
  updateResource
} from '../api/resourcesApi.js';
import { translateSinhala } from '../utils/sinhalaTranslations.js';

const getDefaultForm = (fields) => fields.reduce((form, field) => {
  form[field.name] = field.defaultValue ?? (field.type === 'checkbox' ? false : '');
  return form;
}, {});

const getFieldValue = (field, value) => {
  if (field.type === 'checkbox') {
    return Boolean(value);
  }

  if (field.valueType === 'integer') {
    return value === '' || value === null || value === undefined ? null : Number.parseInt(value, 10);
  }

  if (field.valueType === 'number') {
    return value === '' || value === null || value === undefined ? null : Number(value);
  }

  return value === '' ? null : value;
};

const buildPayload = (fields, form, mode) => fields.reduce((payload, field) => {
  if (field.readOnly || (mode === 'edit' && field.hideOnEdit)) {
    return payload;
  }

  if (mode === 'create' && field.hideOnCreate) {
    return payload;
  }

  const rawValue = form[field.name];

  if (mode === 'edit' && field.omitEmptyOnEdit && (rawValue === '' || rawValue === null || rawValue === undefined)) {
    return payload;
  }

  payload[field.name] = getFieldValue(field, rawValue);
  return payload;
}, {});

const ManagementPage = ({
  title,
  eyebrow,
  description,
  endpoint,
  dataKey,
  idKey,
  fields,
  columns,
  allowDelete = true,
  createRoles = ['Admin', 'Manager'],
  editRoles = ['Admin', 'Manager'],
  deleteLabel = 'Delete',
  renderRowActions,
  searchPlaceholder = 'Search'
}) => {
  const { user } = useAuth();
  const canCreate = createRoles.includes(user?.role);
  const canEdit = editRoles.includes(user?.role);
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(() => getDefaultForm(fields));
  const [editingRow, setEditingRow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const requestParams = useMemo(() => (
    search.trim() ? { search: search.trim() } : {}
  ), [search]);

  const loadRows = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await getResource(endpoint, requestParams);
      setRows(response.data[dataKey] || []);
    } catch (requestError) {
      setError(requestError.response?.data?.message || `Could not load ${title.toLowerCase()}`);
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
        const response = await getResource(endpoint, requestParams);

        if (!ignore) {
          setRows(response.data[dataKey] || []);
        }
      } catch (requestError) {
        if (!ignore) {
          setError(requestError.response?.data?.message || `Could not load ${title.toLowerCase()}`);
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
  }, [dataKey, endpoint, requestParams, title]);

  const resetForm = () => {
    setForm(getDefaultForm(fields));
    setEditingRow(null);
  };

  const updateField = (name, value) => {
    setForm((current) => ({
      ...current,
      [name]: value
    }));
  };

  const startEdit = (row) => {
    const nextForm = getDefaultForm(fields);

    fields.forEach((field) => {
      if (!field.hideOnEdit) {
        nextForm[field.name] = row[field.sourceKey || field.name] ?? field.defaultValue ?? (field.type === 'checkbox' ? false : '');
      }
    });

    setForm(nextForm);
    setEditingRow(row);
    setMessage('');
    setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');

    try {
      const mode = editingRow ? 'edit' : 'create';
      const payload = buildPayload(fields, form, mode);

      if (editingRow) {
        await updateResource(`${endpoint}/${editingRow[idKey]}`, payload);
        setMessage(`${title} updated`);
      } else {
        await createResource(endpoint, payload);
        setMessage(`${title} added`);
      }

      resetForm();
      await loadRows();
    } catch (requestError) {
      setError(requestError.response?.data?.message || `Could not save ${title.toLowerCase()}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row) => {
    const confirmed = window.confirm(translateSinhala(
      `${deleteLabel} ${row.displayName || row.name || row[idKey]}?`
    ));

    if (!confirmed) {
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');

    try {
      await deleteResource(`${endpoint}/${row[idKey]}`);
      setMessage(`${title} deleted`);
      await loadRows();

      if (editingRow?.[idKey] === row[idKey]) {
        resetForm();
      }
    } catch (requestError) {
      setError(requestError.response?.data?.message || `Could not delete ${title.toLowerCase()}`);
    } finally {
      setSaving(false);
    }
  };

  const tableColumns = [
    ...columns,
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div className="table-actions">
          {renderRowActions ? renderRowActions(row) : null}
          {canEdit ? (
            <button className="ghost-button" onClick={() => startEdit(row)} type="button">
              Edit
            </button>
          ) : null}
          {allowDelete && ['Admin', 'Manager'].includes(user?.role) ? (
            <button className="ghost-button danger-button" onClick={() => handleDelete(row)} type="button">
              {deleteLabel}
            </button>
          ) : null}
        </div>
      )
    }
  ];

  return (
    <section className="page-stack">
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
        actions={(
          <input
            className="search-input"
            onChange={(event) => setSearch(event.target.value)}
            placeholder={searchPlaceholder}
            type="search"
            value={search}
          />
        )}
      />
      <div className="management-grid">
        {editingRow || canCreate ? (
          <form className="panel management-form" onSubmit={handleSubmit}>
          <div className="panel-heading">
            <h2>{editingRow ? `Edit ${title}` : `Add ${title}`}</h2>
            {editingRow ? (
              <button className="ghost-button" onClick={resetForm} type="button">
                Cancel
              </button>
            ) : null}
          </div>
          {error ? <p className="form-error">{error}</p> : null}
          {message ? <p className="form-success">{message}</p> : null}
          <div className="management-form-grid">
            {fields.filter((field) => !(editingRow && field.hideOnEdit)).map((field) => (
              <label className={field.fullWidth ? 'field-full' : undefined} key={field.name}>
                {field.label}
                {field.type === 'select' ? (
                  <select
                    onChange={(event) => updateField(field.name, event.target.value)}
                    required={field.required}
                    value={form[field.name] ?? ''}
                  >
                    {field.options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : field.type === 'textarea' ? (
                  <textarea
                    onChange={(event) => updateField(field.name, event.target.value)}
                    required={field.required}
                    rows={field.rows || 3}
                    value={form[field.name] ?? ''}
                  />
                ) : field.type === 'checkbox' ? (
                  <input
                    checked={Boolean(form[field.name])}
                    onChange={(event) => updateField(field.name, event.target.checked)}
                    type="checkbox"
                  />
                ) : (
                  <input
                    min={field.min}
                    onChange={(event) => updateField(field.name, event.target.value)}
                    placeholder={field.placeholder}
                    required={field.required && !(editingRow && field.omitEmptyOnEdit)}
                    step={field.step}
                    type={field.type || 'text'}
                    value={form[field.name] ?? ''}
                  />
                )}
              </label>
            ))}
          </div>
          <div className="form-footer">
            <button className="primary-button" disabled={saving} type="submit">
              {saving ? 'Saving...' : editingRow ? 'Save changes' : `Add ${title}`}
            </button>
          </div>
          </form>
        ) : (
          <section className="panel management-form">
            <h2>{`Edit ${title}`}</h2>
            <p className="muted">Select Edit beside a record to update it.</p>
          </section>
        )}
        <section className="panel management-table">
          {loading ? (
            <p className="muted">Loading records...</p>
          ) : (
            <DataTable columns={tableColumns} rows={rows} emptyLabel={`No ${title.toLowerCase()} found`} />
          )}
        </section>
      </div>
    </section>
  );
};

export default ManagementPage;
