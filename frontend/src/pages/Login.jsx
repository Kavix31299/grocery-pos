import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import AuthLayout from '../layouts/AuthLayout.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { getHomePathForRole } from '../utils/navigation.js';

const Login = () => {
  const { isAuthenticated, login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({
    login: '',
    password: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (isAuthenticated) {
    return <Navigate to={getHomePathForRole(user?.role)} replace />;
  }

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: value
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const loggedInUser = await login(form);
      const fallbackPath = getHomePathForRole(loggedInUser.role);
      const redirectPath = location.state?.from?.pathname || fallbackPath;
      navigate(redirectPath, { replace: true });
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout>
      <form className="login-card" onSubmit={handleSubmit}>
        <div>
          <h2>Sign in</h2>
          <p>Enter your staff credentials.</p>
        </div>
        {error ? <p className="form-error">{error}</p> : null}
        <label>
          Username or email
          <input
            autoComplete="username"
            name="login"
            onChange={handleChange}
            required
            type="text"
            value={form.login}
          />
        </label>
        <label>
          Password
          <input
            autoComplete="current-password"
            name="password"
            onChange={handleChange}
            required
            type="password"
            value={form.password}
          />
        </label>
        <button className="primary-button" disabled={submitting} type="submit">
          {submitting ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </AuthLayout>
  );
};

export default Login;
