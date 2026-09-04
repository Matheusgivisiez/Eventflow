"use client";

import { useSyncExternalStore } from "react";
import { useAuthStore } from "@/stores/auth-store";

function subscribeToHydration(onStoreChange: () => void) {
  return useAuthStore.persist.onFinishHydration(onStoreChange);
}

function getHydrationSnapshot() {
  return useAuthStore.persist.hasHydrated();
}

function getServerHydrationSnapshot() {
  return false;
}

export function useAuthHydration() {
  return useSyncExternalStore(
    subscribeToHydration,
    getHydrationSnapshot,
    getServerHydrationSnapshot
  );
}
