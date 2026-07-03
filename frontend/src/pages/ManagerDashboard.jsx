import PageHeader from '../components/PageHeader.jsx';
import StatCard from '../components/StatCard.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const ManagerDashboard = () => {
  const { user } = useAuth();

  return (
    <section className="page-stack">
      <PageHeader
        eyebrow="Manager"
        title="Manager Dashboard"
        description={`Inventory and sales workspace for ${user?.fullName || 'Manager'}.`}
      />
      <div className="stats-grid">
        <StatCard label="Inventory" value="Active" detail="Products and stock" />
        <StatCard label="Purchases" value="Ready" detail="Supplier receiving" />
        <StatCard label="Reports" value="Available" detail="Sales and stock views" />
      </div>
      <div className="panel-grid">
        <section className="panel">
          <h2>Stock Focus</h2>
          <p className="muted">Review product availability, low stock, and supplier activity.</p>
        </section>
        <section className="panel">
          <h2>Sales Focus</h2>
          <p className="muted">Track invoices, cashier activity, returns, expenses, and profit reports.</p>
        </section>
      </div>
    </section>
  );
};

export default ManagerDashboard;
