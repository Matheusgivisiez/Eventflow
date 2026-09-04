"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Compass, LayoutDashboard, LogOut, Ticket, User, UserCheck2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { BrandLogo } from "@/components/brand-logo";
import { MobileAccountNavigation } from "@/components/mobile-account-navigation";
import { useAuthHydration } from "@/hooks/use-auth-hydration";
import { useAuthStore } from "@/stores/auth-store";
import { cn } from "@/lib/utils";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const hasHydrated = useAuthHydration();
  const { user, logout } = useAuthStore();

  useEffect(() => {
    if (!hasHydrated) return;
    if (!user) {
      router.replace("/login");
    }
  }, [hasHydrated, user, router]);

  if (!hasHydrated || !user) {
    return null;
  }

  const isOrganizerOrAdmin = ["ORGANIZER", "ADMIN"].includes(user.role);
  const navItems = [
    { href: "/", icon: Compass, label: "Explorar" },
    { href: "/me/ingressos", icon: Ticket, label: "Ingressos" },
    { href: "/me/conta", icon: User, label: "Perfil" },
    ...(isOrganizerOrAdmin
      ? [{ href: "/dashboard", icon: LayoutDashboard, label: "Painel" }]
      : [{ href: "/me/organizador", icon: UserCheck2, label: "Ser produtor" }]
    )
  ];
  const initials = user.name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex min-h-screen flex-col bg-[#F8F8F8] pb-[calc(4rem+env(safe-area-inset-bottom))] dark:bg-background md:pb-0">
      {/* Header */}
      <header className="sticky top-0 z-30 w-full border-b bg-white/95 dark:bg-card/95 backdrop-blur shadow-sm">
        <div className="mx-auto max-w-5xl px-4 h-16 flex items-center justify-between">
          <Link href="/" className="group hover:opacity-90 transition-opacity">
            <BrandLogo />
          </Link>

          {/* Nav desktop */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
              return (
                <Button
                  key={item.href}
                  asChild
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "gap-2 rounded-xl",
                    isActive
                      ? "bg-primary/10 text-primary font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Link href={item.href}>
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                </Button>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link
              href="/me/conta"
              aria-label={`Abrir dados da conta de ${user.name}`}
              className="flex h-11 items-center gap-2 rounded-full px-1 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:h-10 sm:rounded-xl sm:bg-muted sm:px-2.5"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                {initials}
              </div>
              <span className="hidden max-w-[100px] truncate sm:inline">{user.name.split(" ")[0]}</span>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              title="Sair"
              className="hidden rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive md:inline-flex"
              onClick={() => { logout(); router.push("/login"); }}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

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
