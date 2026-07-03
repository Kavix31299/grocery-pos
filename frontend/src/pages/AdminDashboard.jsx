import PageHeader from '../components/PageHeader.jsx';
import StatCard from '../components/StatCard.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const AdminDashboard = () => {
  const { user } = useAuth();

  return (
    <section className="page-stack">
      <PageHeader
        eyebrow="Admin"
        title="Admin Dashboard"
        description={`Welcome back, ${user?.fullName || 'Admin'}.`}
      />
      <div className="stats-grid">
        <StatCard label="System Access" value="Full" detail="Users, settings, inventory" />
        <StatCard label="Primary Area" value="Control" detail="Roles and store setup" />
        <StatCard label="Backend" value="Connected" detail="API routes ready" />
      </div>
      <div className="panel-grid">
        <section className="panel">
          <h2>Administration</h2>
          <p className="muted">User management, permissions, store settings, and operational oversight.</p>
        </section>
        <section className="panel">
          <h2>Store Setup</h2>
          <p className="muted">Configure receipt details, tax rate, currency, and contact information.</p>
        </section>
      </div>
    </section>
  );
};

export default AdminDashboard;
