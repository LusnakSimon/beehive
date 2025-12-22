import React, { createContext, useContext, useState, useEffect } from 'react';

      // Use /api/users/me to fetch fresh DB-backed user data (includes ownedHives)
      const response = await fetch('/api/users/me', {

export const useAuth = () => {
  const context = useContext(AuthContext);
        const data = await response.json();
        if (data) {
          setUser(data);
          setIsAuthenticated(true);
        }

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  
  useEffect(() => {
    // Check session on mount, but skip if logging out
    if (!isLoggingOut) {
      checkSession();
    }
  }, [isLoggingOut]);  const checkSession = async () => {
    try {
      const response = await fetch('/api/session', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const session = await response.json();
        if (session && session.user) {
          setUser(session.user);
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
      // Redirect to OAuth provider
      window.location.href = `/api/auth/${provider}`;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      // Set logout flag to prevent checkSession from running
      setIsLoggingOut(true);
      
      // Call logout endpoint to clear cookie
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });
      
      // Clear state
      setUser(null);
      setIsAuthenticated(false);
      
      // Redirect to login (will unmount component, so no need to reset flag)
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout error:', error);
      // Even if API call fails, clear local state and redirect
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
