import { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../utils/api';

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

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const { data } = await authAPI.getCurrentUser();
        setUser(data.user);
      } catch {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
    setLoading(false);
  };

  const login = async (credentials) => {
    const { data } = await authAPI.login(credentials);
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
    return data;
  };

  const register = async (userData) => {
    const { data } = await authAPI.register(userData);
    return data;
  };

  const logout = async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setUser(null);
    }
  };

  const hasPermission = (permission) => {
    if (!user) return false;
    
    // Check effective permissions resolved via hierarchy (NIST RBAC1)
    if (Array.isArray(user.effectivePermissions)) {
      return user.effectivePermissions.includes(permission);
    }
    
    const userPermissions = [];
    (user.roles || []).forEach(role => {
      if (role.permissions) {
        role.permissions.forEach(perm => {
          userPermissions.push(`${perm.action}:${perm.resource}`);
        });
      }
    });
    
    return userPermissions.includes(permission);
  };

  const hasRole = (roleName) => {
    if (!user) return false;
    const rolesList = user.allRoles || user.roles || [];
    return rolesList.some(role => role.name === roleName);
  };

  const value = {
    user,
    login,
    register,
    logout,
    loading,
    isAuthenticated: !!user,
    hasPermission,
    hasRole,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};