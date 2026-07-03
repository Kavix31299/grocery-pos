import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { getNavigationForRole } from '../utils/navigation.js';

const SidebarLayout = () => {
  const { user } = useAuth();
  const navItems = getNavigationForRole(user?.role);

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <strong>Grocery POS</strong>
        <span>{user?.role || 'Staff'}</span>
      </div>
      <nav className="sidebar-nav" aria-label="Main navigation">
        {navItems.map((item) => (
          <NavLink key={item.path} to={item.path}>
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
};

export default SidebarLayout;
