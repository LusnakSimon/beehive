import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    if (!isLoggingOut) {
      checkSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggingOut]);

  const checkSession = async () => {
    try {
      // Fetch DB-backed current user
      const response = await fetch('/api/users/me', {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        if (data) {
          setUser(data);
          setIsAuthenticated(true);
        }
      }
    } catch (error) {
      console.error('Session check failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshUser = async () => {
    try {
      const response = await fetch('/api/users/me', {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        if (data) {
          setUser(data);
          setIsAuthenticated(true);
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('User refresh failed:', error);
      return false;
    }
  };

  const login = async (provider) => {
    try {
      window.location.href = `/api/auth/${provider}`;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      setIsLoggingOut(true);
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });
      setUser(null);
      setIsAuthenticated(false);
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout error:', error);
      setUser(null);
      setIsAuthenticated(false);
      window.location.href = '/login';
    }
  };

  const value = {
    user,
    isAuthenticated,
    loading,
    login,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// HOC for protected routes
export const withAuth = (Component) => {
  return (props) => {
    const { isAuthenticated, loading } = useAuth();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
      setMounted(true);
    }, []);

    if (!mounted || loading) {
      return (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh'
        }}>
          <div className="spinner"></div>
        </div>
      );
    }

    if (!isAuthenticated) {
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      return null;
    }

    return <Component {...props} />;
  };
};
