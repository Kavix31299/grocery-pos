import { Navigate, Route, Routes } from 'react-router-dom';
import LoadingScreen from '../components/LoadingScreen.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import DashboardLayout from '../layouts/DashboardLayout.jsx';
import AdminDashboard from '../pages/AdminDashboard.jsx';
import CashierPOS from '../pages/CashierPOS.jsx';
import Categories from '../pages/Categories.jsx';
import Customers from '../pages/Customers.jsx';
import Expenses from '../pages/Expenses.jsx';
import Login from '../pages/Login.jsx';
import ManagerDashboard from '../pages/ManagerDashboard.jsx';
import Products from '../pages/Products.jsx';
import Purchases from '../pages/Purchases.jsx';
import Reports from '../pages/Reports.jsx';
import ReportPage from '../pages/ReportPage.jsx';
import Returns from '../pages/Returns.jsx';
import Sales from '../pages/Sales.jsx';
import StoreSettings from '../pages/StoreSettings.jsx';
import Suppliers from '../pages/Suppliers.jsx';
import Users from '../pages/Users.jsx';
import { getHomePathForRole } from '../utils/navigation.js';
import ProtectedRoute from './ProtectedRoute.jsx';

const HomeRedirect = () => {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) {
    return <LoadingScreen label="Loading workspace" />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to={getHomePathForRole(user.role)} replace />;
};

const AppRoutes = () => (
  <Routes>
    <Route path="/login" element={<Login />} />
    <Route path="/" element={<HomeRedirect />} />

    <Route element={<ProtectedRoute roles={['Admin', 'Manager', 'Cashier']} />}>
      <Route element={<DashboardLayout />}>
        <Route path="/pos" element={<CashierPOS />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/products" element={<Products />} />
        <Route path="/categories" element={<Categories />} />
        <Route path="/suppliers" element={<Suppliers />} />
        <Route path="/returns" element={<Returns />} />
        <Route path="/sales" element={<Sales />} />
      </Route>
    </Route>

    <Route element={<ProtectedRoute roles={['Admin']} />}>
      <Route element={<DashboardLayout />}>
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/users" element={<Users />} />
        <Route path="/store-settings" element={<StoreSettings />} />
      </Route>
    </Route>

    <Route element={<ProtectedRoute roles={['Admin', 'Manager']} />}>
      <Route element={<DashboardLayout />}>
        <Route path="/manager/dashboard" element={<ManagerDashboard />} />
        <Route path="/purchases" element={<Purchases />} />
        <Route path="/expenses" element={<Expenses />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/reports/:reportSlug" element={<ReportPage />} />
      </Route>
    </Route>

    <Route path="*" element={<HomeRedirect />} />
  </Routes>
);

export default AppRoutes;
