import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react';
import { getProfileRequest, loginRequest } from '../api/authApi.js';

const AuthContext = createContext(null);

const TOKEN_KEY = 'grocery_pos_token';
const USER_KEY = 'grocery_pos_user';

const readStoredUser = () => {
  const rawUser = localStorage.getItem(USER_KEY);

  if (!rawUser) {
    return null;
  }

  try {
    return JSON.parse(rawUser);
  } catch (error) {
    localStorage.removeItem(USER_KEY);
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState(readStoredUser);
  const [access, setAccess] = useState([]);
  const [loading, setLoading] = useState(Boolean(localStorage.getItem(TOKEN_KEY)));

  const saveSession = useCallback((session) => {
    localStorage.setItem(TOKEN_KEY, session.token);
    localStorage.setItem(USER_KEY, JSON.stringify(session.user));
    setToken(session.token);
    setUser(session.user);
    setAccess(session.access || []);
  }, []);

  const login = useCallback(async ({ login, password }) => {
    const response = await loginRequest({ login, password });
    saveSession(response.data);
    return response.data.user;
  }, [saveSession]);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
    setAccess([]);
  }, []);

  useEffect(() => {
    let ignore = false;

    const refreshProfile = async () => {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const response = await getProfileRequest();

        if (!ignore) {
          setUser(response.data.user);
          setAccess(response.data.access || []);
          localStorage.setItem(USER_KEY, JSON.stringify(response.data.user));
        }
      } catch (error) {
        if (!ignore) {
          logout();
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    refreshProfile();

    return () => {
      ignore = true;
    };
  }, [logout, token]);

  const value = useMemo(() => ({
    access,
    isAuthenticated: Boolean(token && user),
    loading,
    login,
    logout,
    token,
    user
  }), [access, loading, login, logout, token, user]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
};
