import { Link } from 'react-router-dom';
import PageHeader from '../components/PageHeader.jsx';
import { reportList } from '../utils/reportConfig.js';

const Reports = () => (
  <section className="page-stack">
    <PageHeader
      eyebrow="Insights"
      title="Reports"
      description="Sales, stock, profit, expenses, and supplier due reports."
    />
    <div className="report-card-grid">
      {reportList.map((report) => (
        <Link className="report-card" key={report.key} to={`/reports/${report.slug}`}>
          <span>{report.label}</span>
          <p>{report.description}</p>
          <small>
            {report.supportsDateFilter ? 'Date filter' : 'Live summary'}
            {report.supportsSearch ? ' + search' : ''}
          </small>
        </Link>
      ))}
    </div>
  </section>
);

export default Reports;
