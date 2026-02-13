/**
 * Auth Store - Zustand state management for authentication
 *
 * Manages:
 * - User session state
 * - Login/Register/Logout flows
 * - Token persistence in localStorage
 * - Profile updates
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { api } from '../lib/api';

export interface User {
  id: string;
  email: string;
  name: string;
  displayName: string;
  avatarUrl: string | null;
  role: 'user' | 'admin' | 'super_admin';
  organizationId: string | null;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Actions
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  loadUser: () => Promise<void>;
  updateProfile: (data: Partial<Pick<User, 'name' | 'displayName' | 'avatarUrl'>>) => Promise<void>;
}

const TOKEN_KEY = 'auth-token';

export const useAuthStore = create<AuthState>()(
  devtools(
    (set, get) => ({
      user: null,
      token: localStorage.getItem(TOKEN_KEY),
      isAuthenticated: false,
      isLoading: true,

      login: async (email: string, password: string) => {
        set({ isLoading: true });
        try {
          const response = await api.post<{ token: string; user: User }>(
            '/v1/auth/login',
            { email, password }
          );

          localStorage.setItem(TOKEN_KEY, response.token);

          set({
            token: response.token,
            user: response.user,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      register: async (name: string, email: string, password: string) => {
        set({ isLoading: true });
        try {
          const response = await api.post<{ token: string; user: User }>(
            '/v1/auth/register',
            { name, email, password }
          );

          localStorage.setItem(TOKEN_KEY, response.token);

          set({
            token: response.token,
            user: response.user,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      logout: () => {
        localStorage.removeItem(TOKEN_KEY);

        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
        });

        window.location.href = '/login';
      },

      loadUser: async () => {
        const token = get().token;
        if (!token) {
          set({ isLoading: false, isAuthenticated: false });
          return;
        }

        try {
          const user = await api.get<User>('/v1/auth/me');
          set({
            user,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch {
          // Token is invalid or expired
          localStorage.removeItem(TOKEN_KEY);
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
          });
        }
      },

      updateProfile: async (data) => {
        const response = await api.patch<User>('/v1/auth/profile', data);
        set({ user: response });
      },
    }),
    { name: 'auth-store' }
  )
);
