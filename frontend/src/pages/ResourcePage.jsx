import { useEffect, useMemo, useState } from 'react';
import DataTable from '../components/DataTable.jsx';
import PageHeader from '../components/PageHeader.jsx';
import { getResource } from '../api/resourcesApi.js';

const ResourcePage = ({
  title,
  eyebrow,
  description,
  endpoint,
  dataKey,
  columns,
  searchPlaceholder = 'Search'
}) => {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const params = useMemo(() => (
    search.trim() ? { search: search.trim() } : {}
  ), [search]);

  useEffect(() => {
    let ignore = false;

    const loadRows = async () => {
      setLoading(true);
      setError('');

      try {
        const response = await getResource(endpoint, params);

        if (!ignore) {
          setRows(response.data[dataKey] || []);
        }
      } catch (requestError) {
        if (!ignore) {
          setError(requestError.response?.data?.message || 'Could not load records');
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    loadRows();

    return () => {
      ignore = true;
    };
  }, [dataKey, endpoint, params]);

  return (
    <section className="page-stack">
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
        actions={(
          <input
            className="search-input"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={searchPlaceholder}
            type="search"
          />
        )}
      />
      <div className="panel">
        {error ? <p className="form-error">{error}</p> : null}
        {loading ? (
          <p className="muted">Loading records...</p>
        ) : (
          <DataTable columns={columns} rows={rows} emptyLabel={`No ${title.toLowerCase()} found`} />
        )}
      </div>
    </section>
  );
};

export default ResourcePage;
