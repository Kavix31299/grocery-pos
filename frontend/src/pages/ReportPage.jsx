import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import DataTable from '../components/DataTable.jsx';
import PageHeader from '../components/PageHeader.jsx';
import { getResource } from '../api/resourcesApi.js';
import { getReportBySlug } from '../utils/reportConfig.js';

const ReportPage = () => {
  const { reportSlug } = useParams();
  const report = getReportBySlug(reportSlug);
  const [rows, setRows] = useState([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const params = useMemo(() => {
    const nextParams = {};

    if (report?.supportsDateFilter && dateFrom) {
      nextParams.dateFrom = dateFrom;
    }

    if (report?.supportsDateFilter && dateTo) {
      nextParams.dateTo = dateTo;
    }

    if (report?.supportsSearch && search.trim()) {
      nextParams.search = search.trim();
    }

    return nextParams;
  }, [dateFrom, dateTo, report, search]);

  useEffect(() => {
    if (!report) {
      return undefined;
    }

    let ignore = false;

    const loadReport = async () => {
      setLoading(true);
      setError('');

      try {
        const response = await getResource(report.endpoint, params);

        if (!ignore) {
          setRows(response.data[report.key] || []);
        }
      } catch (requestError) {
        if (!ignore) {
          setRows([]);
          setError(requestError.response?.data?.message || 'Could not load report');
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    loadReport();

    return () => {
      ignore = true;
    };
  }, [params, report]);

  if (!report) {
    return <Navigate to="/reports" replace />;
  }

  const handlePrint = () => {
    window.print();
  };

  const resetFilters = () => {
    setDateFrom('');
    setDateTo('');
    setSearch('');
  };

  return (
    <section className="page-stack">
      <PageHeader
        eyebrow="Reports"
        title={report.label}
        description={report.description}
        actions={(
          <Link className="ghost-button" to="/reports">
            All reports
          </Link>
        )}
      />

      <section className="panel report-controls">
        <div className="report-filter-grid">
          {report.supportsDateFilter ? (
            <>
              <label>
                From
                <input
                  onChange={(event) => setDateFrom(event.target.value)}
                  type="date"
                  value={dateFrom}
                />
              </label>
              <label>
                To
                <input
                  onChange={(event) => setDateTo(event.target.value)}
                  type="date"
                  value={dateTo}
                />
              </label>
            </>
          ) : (
            <div className="report-filter-note">
              <strong>Live report</strong>
              <span>This report reflects current or all-time summary data.</span>
            </div>
          )}
          {report.supportsSearch ? (
            <label>
              Search
              <input
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search report"
                type="search"
                value={search}
              />
            </label>
          ) : null}
        </div>
        <div className="report-control-actions">
          <button className="ghost-button" onClick={resetFilters} type="button">
            Reset
          </button>
          <button className="primary-button" onClick={handlePrint} type="button">
            Print report
          </button>
        </div>
      </section>

      <section className="panel printable-report">
        <div className="report-print-header">
          <div>
            <span>Grocery POS</span>
            <h2>{report.label}</h2>
          </div>
          <div>
            {report.supportsDateFilter && (dateFrom || dateTo) ? (
              <p>{dateFrom || 'Start'} to {dateTo || 'Today'}</p>
            ) : (
              <p>Generated report</p>
            )}
            <p>{new Date().toLocaleString()}</p>
          </div>
        </div>
        {error ? <p className="form-error">{error}</p> : null}
        {loading ? (
          <p className="muted">Loading report...</p>
        ) : (
          <DataTable columns={report.columns} rows={rows} emptyLabel="No report rows found" />
        )}
      </section>
    </section>
  );
};

export default ReportPage;
