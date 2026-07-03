import { Outlet } from 'react-router-dom';
import HeaderLayout from './HeaderLayout.jsx';
import SidebarLayout from './SidebarLayout.jsx';

const DashboardLayout = () => (
  <div className="app-shell">
    <SidebarLayout />
    <div className="main-shell">
      <HeaderLayout />
      <main className="content">
        <Outlet />
      </main>
    </div>
  </div>
);

export default DashboardLayout;
