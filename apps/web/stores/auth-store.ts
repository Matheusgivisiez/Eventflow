"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AuthUser = {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  phone?: string;
  role: "ADMIN" | "ORGANIZER" | "TEAM" | "CHECKIN" | "CUSTOMER";
};

type AuthState = {
  accessToken?: string;
  user?: AuthUser;
  setSession: (session: { accessToken: string; user: AuthUser }) => void;
  updateUser: (data: Partial<AuthUser>) => void;
  logout: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      setSession: (session) => set(session),
      updateUser: (data) => set((state) => ({ user: state.user ? { ...state.user, ...data } : undefined })),
      logout: () => {
        void fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api"}/auth/logout`, {
          method: "POST",
          credentials: "include"
        }).catch(() => undefined);
        set({ accessToken: undefined, user: undefined });
      }
    }),
    {
      name: "eventflow-session",
      partialize: (state) => ({ accessToken: state.accessToken, user: state.user })
    }
  )
);
