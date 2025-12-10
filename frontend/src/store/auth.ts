import { create } from "zustand";
import { api } from "../lib/api";

interface User {
  id: string;
  email: string;
  name?: string;
  orgId: string;
  roles: string[];
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  error: string | null;
  
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshTokens: () => Promise<boolean>;
  clearError: () => void;
  setLoading: (loading: boolean) => void;
}

const ACCESS_TOKEN_KEY = "access_token";
const REFRESH_TOKEN_KEY = "refresh_token";
const USER_KEY = "user";

const loadFromStorage = () => {
  try {
    const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    const userStr = localStorage.getItem(USER_KEY);
    const user = userStr ? JSON.parse(userStr) : null;
    return { accessToken, refreshToken, user };
  } catch {
    return { accessToken: null, refreshToken: null, user: null };
  }
};

const saveToStorage = (accessToken: string, refreshToken: string, user: User) => {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

const clearStorage = () => {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

const initial = loadFromStorage();

export const useAuthStore = create<AuthState>((set, get) => ({
  user: initial.user,
  accessToken: initial.accessToken,
  refreshToken: initial.refreshToken,
  isLoading: false,
  error: null,

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post("/security/auth/login", { email, password });
      const { user, accessToken, refreshToken } = response.data;
      saveToStorage(accessToken, refreshToken, user);
      set({ user, accessToken, refreshToken, isLoading: false });
    } catch (err: any) {
      const message = err.response?.data?.error || "Login failed";
      set({ error: message, isLoading: false });
      throw new Error(message);
    }
  },

  register: async (email: string, password: string, name?: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post("/security/auth/register", { email, password, name });
      const { user, accessToken, refreshToken } = response.data;
      saveToStorage(accessToken, refreshToken, user);
      set({ user, accessToken, refreshToken, isLoading: false });
    } catch (err: any) {
      const message = err.response?.data?.error || "Registration failed";
      set({ error: message, isLoading: false });
      throw new Error(message);
    }
  },

  logout: async () => {
    const { refreshToken } = get();
    try {
      if (refreshToken) {
        await api.post("/security/auth/logout", { refreshToken });
      }
    } catch {
      // Ignore errors on logout
    }
    clearStorage();
    set({ user: null, accessToken: null, refreshToken: null });
  },

  refreshTokens: async () => {
    const { refreshToken } = get();
    if (!refreshToken) return false;

    try {
      const response = await api.post("/security/auth/refresh", { refreshToken });
      const { accessToken: newAccessToken, refreshToken: newRefreshToken } = response.data;
      const { user } = get();
      if (user) {
        saveToStorage(newAccessToken, newRefreshToken, user);
      }
      set({ accessToken: newAccessToken, refreshToken: newRefreshToken });
      return true;
    } catch {
      // Refresh failed, clear auth
      clearStorage();
      set({ user: null, accessToken: null, refreshToken: null });
      return false;
    }
  },

  clearError: () => set({ error: null }),
  setLoading: (loading: boolean) => set({ isLoading: loading })
}));

// Legacy compatibility - some components use 'token'
export const getAccessToken = () => useAuthStore.getState().accessToken;
