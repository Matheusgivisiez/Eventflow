"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AppTopBar } from "@/components/app-top-bar";
import { MobileAccountNavigation } from "@/components/mobile-account-navigation";
import { useAuthHydration } from "@/hooks/use-auth-hydration";
import { useAuthStore } from "@/stores/auth-store";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const hasHydrated = useAuthHydration();
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!user) {
      router.replace("/login");
    }
  }, [hasHydrated, user, router]);

  if (!hasHydrated || !user) {
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#F8F8F8] pb-[calc(4rem+env(safe-area-inset-bottom))] dark:bg-background md:pb-0">
      <AppTopBar contentClassName="max-w-5xl" />

      {/* Conteúdo principal */}
      <div className="flex-grow flex flex-col">
        <div className="flex-grow">
          {children}
        </div>
        
        {/* Rodapé da Área do Cliente */}
        <footer className="py-6 mt-8 border-t bg-white dark:bg-card">
          <div className="mx-auto max-w-5xl px-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
            <p>© {new Date().getFullYear()} Event Flow.</p>
            <div className="flex items-center gap-4">
              <a href="/politica-de-cookies" className="hover:text-primary transition-colors">
                Política de Cookies
              </a>
              <button 
                onClick={() => window.dispatchEvent(new CustomEvent('open-cookie-settings'))}
                className="hover:text-primary transition-colors"
              >
                Configurações de Cookies
              </button>
            </div>
          </div>
        </footer>
      </div>

      <MobileAccountNavigation />
    </div>
  );
}
