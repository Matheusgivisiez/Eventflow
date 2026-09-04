"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { ReactNode, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuthHydration } from "@/hooks/use-auth-hydration";
import { useAuthStore } from "@/stores/auth-store";

function AuthSessionBootstrap() {
  const hydrated = useAuthHydration();
  const user = useAuthStore((state) => state.user);
  const updateUser = useAuthStore((state) => state.updateUser);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    if (!hydrated || restored || !user) return;
    setRestored(true);

    // This also refreshes an expired access token through api(), using the
    // HttpOnly refresh cookie, before protected pages make their requests.
    void api<typeof user>("/auth/me")
      .then((currentUser) => updateUser(currentUser))
      .catch(() => undefined);
  }, [hydrated, restored, updateUser, user]);

  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 2, // 2 minutes
        refetchOnWindowFocus: false,
        retry: (failureCount, error: any) => {
          if (error?.status === 401 || error?.status === 403 || error?.status === 404) return false;
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
