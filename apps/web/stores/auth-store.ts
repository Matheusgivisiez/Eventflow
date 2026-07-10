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
  refreshToken?: string;
  user?: AuthUser;
  setSession: (session: { accessToken: string; refreshToken: string; user: AuthUser }) => void;
  updateUser: (data: Partial<AuthUser>) => void;
  logout: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      setSession: (session) => set(session),
      updateUser: (data) => set((state) => ({ user: state.user ? { ...state.user, ...data } : undefined })),
      logout: () => set({ accessToken: undefined, refreshToken: undefined, user: undefined })
    }),
    { name: "eventhub-session" }
  )
);
