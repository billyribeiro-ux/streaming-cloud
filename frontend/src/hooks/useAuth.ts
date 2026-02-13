/**
 * useAuth Hook - Auth hook wrapping authStore
 *
 * Features:
 * - Returns user, isAuthenticated, isLoading, login, logout, register
 * - Checks localStorage for token on mount
 * - Redirects to login on 401 (handled by api client)
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

export function useAuth() {
  const navigate = useNavigate();

  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isLoading = useAuthStore((state) => state.isLoading);
  const token = useAuthStore((state) => state.token);

  const loginAction = useAuthStore((state) => state.login);
  const registerAction = useAuthStore((state) => state.register);
  const logoutAction = useAuthStore((state) => state.logout);
  const loadUser = useAuthStore((state) => state.loadUser);

  // Check for existing token on mount and load user
  useEffect(() => {
    if (token && !user && !isLoading) {
      loadUser();
    }
  }, [token, user, isLoading, loadUser]);

  // Listen for auth state changes - redirect to login if token is removed
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'auth-token' && !e.newValue) {
        navigate('/login', { replace: true });
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [navigate]);

  const login = async (email: string, password: string) => {
    await loginAction(email, password);
  };

  const register = async (name: string, email: string, password: string) => {
    await registerAction(name, email, password);
  };

  const logout = () => {
    logoutAction();
  };

  return {
    user,
    isAuthenticated,
    isLoading,
    login,
    logout,
    register,
  };
}

export default useAuth;
