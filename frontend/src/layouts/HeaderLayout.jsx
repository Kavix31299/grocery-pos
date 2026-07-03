import { useAuth } from '../context/AuthContext.jsx';

const HeaderLayout = () => {
  const { logout, user } = useAuth();

  return (
    <header className="topbar">
      <div>
        <span>{user?.fullName}</span>
        <small>{user?.username}</small>
      </div>
      <button type="button" className="ghost-button" onClick={logout}>
        Sign out
      </button>
    </header>
  );
};

export default HeaderLayout;
