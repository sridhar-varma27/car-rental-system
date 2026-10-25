import { create } from "zustand";
import api from "../services/api";
import type { User } from "../types";

interface AuthState {
  token: string | null;
  user: User | null;
  loading: boolean;

  login: (token: string) => void;
  loadUser: () => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem("token"),
  user: null,
  loading: true,

  login: (token: string) => {
    localStorage.setItem("token", token);

    set({
      token,
    });
  },

  loadUser: async () => {
    const token = localStorage.getItem("token");

    if (!token) {
      set({
        token: null,
        user: null,
        loading: false,
      });

      return;
    }

    try {
      const response = await api.get<User>("/auth/me");

      set({
        token,
        user: response.data,
        loading: false,
      });
    } catch {
      localStorage.removeItem("token");

      set({
        token: null,
        user: null,
        loading: false,
      });
    }
  },

  logout: () => {
    localStorage.removeItem("token");

    set({
      token: null,
      user: null,
      loading: false,
    });
  },
}));