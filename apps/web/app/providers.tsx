"use client";

import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuthHydration } from "@/hooks/use-auth-hydration";
import { useAuthStore } from "@/stores/auth-store";

function AuthSessionBootstrap() {
  const queryClient = useQueryClient();
  const hydrated = useAuthHydration();
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const updateUser = useAuthStore((state) => state.updateUser);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    if (!hydrated || restored || !user) return;
    if (pathname === "/checkout/success") return;
    setRestored(true);

    // This also refreshes an expired access token through api(), using the
    // HttpOnly refresh cookie, before protected pages make their requests.
    void api<typeof user>("/auth/me")
      .then((currentUser) => updateUser(currentUser))
      .catch(() => undefined);
  }, [hydrated, pathname, restored, updateUser, user]);

  // Confirmation often opens in the mail app or a second browser tab. Refresh
  // the original tab when the person returns, then reload data claimed by the
  // newly verified address. Existing verified sessions do no extra requests.
  useEffect(() => {
    if (!hydrated || !user || user.emailVerified !== false) return;

    const refreshVerification = () => {
      if (document.visibilityState !== "visible") return;
      void api<typeof user>("/auth/me")
        .then((currentUser) => {
          if (currentUser.id !== user.id) return;
          updateUser(currentUser);
          if (currentUser.emailVerified) {
            void queryClient.invalidateQueries({ queryKey: ["my-tickets"] });
            void queryClient.invalidateQueries({ queryKey: ["received-transfers"] });
            void queryClient.invalidateQueries({ queryKey: ["pending-purchases"] });
          }
        })
        .catch(() => undefined);
    };

    window.addEventListener("focus", refreshVerification);
    document.addEventListener("visibilitychange", refreshVerification);
    return () => {
      window.removeEventListener("focus", refreshVerification);
      document.removeEventListener("visibilitychange", refreshVerification);
    };
  }, [hydrated, queryClient, updateUser, user]);

  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 2, // 2 minutes
        refetchOnWindowFocus: false,
        retry: (failureCount, error: any) => {
          if (error?.status === 401 || error?.status === 403 || error?.status === 404 || error?.status === 429) return false;
          return failureCount < 1;
        },
      },
    },
  }));

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <QueryClientProvider client={queryClient}>
        <AuthSessionBootstrap />
        {children}
      </QueryClientProvider>
    </ThemeProvider>
  );
}
