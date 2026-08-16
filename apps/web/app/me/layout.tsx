"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Ticket, LogOut, Compass, LayoutDashboard, UserCheck2, Home, QrCode, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { BrandLogo } from "@/components/brand-logo";
import { useAuthStore } from "@/stores/auth-store";
import { cn } from "@/lib/utils";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuthStore();

  useEffect(() => {
    if (!user) {
      router.push("/login");
    }
  }, [user, router]);

  if (!user) {
    return null;
  }

  const isOrganizerOrAdmin = ["ORGANIZER", "ADMIN"].includes(user.role);

  const navItems = [
    { href: "/", icon: Compass, label: "Explorar" },
    { href: "/me", icon: User, label: "Perfil" },
    ...(isOrganizerOrAdmin
      ? [{ href: "/dashboard", icon: LayoutDashboard, label: "Painel" }]
      : [{ href: "/me/organizador", icon: UserCheck2, label: "Organizar" }]
    ),
  ];

  return (
    <div className="min-h-screen bg-[#F8F8F8] dark:bg-background flex flex-col">
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
            {/* Avatar */}
            <div className="hidden sm:flex items-center gap-2 rounded-xl bg-muted px-3 py-1.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs">
                {user?.name?.charAt(0).toUpperCase() ?? "U"}
              </div>
              <span className="text-sm font-medium max-w-[100px] truncate">{user?.name?.split(" ")[0]}</span>
            </div>
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              title="Sair"
              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl"
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
            <p>© {new Date().getFullYear()} EventHub.</p>
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

      {/* Bottom nav — mobile */}
      <nav className="md:hidden sticky bottom-0 z-30 border-t bg-white dark:bg-card shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
        <div className="grid h-16" style={{ gridTemplateColumns: `repeat(${navItems.length + 1}, 1fr)` }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 text-xs font-medium transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                <Icon className={cn("h-5 w-5", isActive && "text-primary")} />
                <span className="text-[10px]">{item.label}</span>
              </Link>
            );
          })}
          {/* Botão de sair mobile */}
          <button
            onClick={() => { logout(); router.push("/login"); }}
            className="flex flex-col items-center justify-center gap-1 text-xs font-medium text-muted-foreground"
          >
            <LogOut className="h-5 w-5" />
            <span className="text-[10px]">Sair</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
