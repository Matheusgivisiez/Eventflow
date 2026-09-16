"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3, Bell, Building2, CalendarDays, CreditCard, DoorOpen,
  FileBarChart2, Shield, Tag, UserCheck,
  UserCircle, Users, ChevronRight, Menu, X,
  Megaphone, PanelLeftClose, PanelLeftOpen
} from "lucide-react";
import { AppTopBar } from "@/components/app-top-bar";
import { BrandLogo } from "@/components/brand-logo";
import { MobileAccountNavigation } from "@/components/mobile-account-navigation";
import { PageAnimation } from "@/components/page-animation";
import { useAuthHydration } from "@/hooks/use-auth-hydration";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: BarChart3, roles: ["ORGANIZER", "ADMIN", "TEAM"] },
  { href: "/events", label: "Eventos", icon: CalendarDays, roles: ["ORGANIZER", "ADMIN", "TEAM"] },
  { href: "/participants", label: "Participantes", icon: UserCheck, roles: ["ORGANIZER", "ADMIN", "TEAM"] },
  { href: "/check-in", label: "Check-in", icon: DoorOpen, roles: ["ORGANIZER", "ADMIN", "TEAM", "CHECKIN"] },
  { href: "/finance", label: "Financeiro", icon: CreditCard, roles: ["ORGANIZER", "ADMIN", "TEAM"] },
  { href: "/reports", label: "Relatorios", icon: FileBarChart2, roles: ["ORGANIZER", "ADMIN", "TEAM"] },
  { href: "/enterprise", label: "Enterprise", icon: Building2, roles: ["ORGANIZER", "ADMIN", "TEAM"] },
  { href: "/promoters", label: "Promoters", icon: Megaphone, roles: ["ORGANIZER", "ADMIN", "TEAM"] },
  { href: "/team", label: "Equipe", icon: Users, roles: ["ORGANIZER", "ADMIN"] },
  { href: "/coupons", label: "Cupons", icon: Tag, roles: ["ORGANIZER", "ADMIN", "TEAM"] },
  { href: "/notifications", label: "Notificações", icon: Bell, roles: ["ADMIN"] },
  { href: "/profile", label: "Perfil", icon: UserCircle, roles: ["ORGANIZER", "ADMIN", "TEAM", "CHECKIN"] },
  { href: "/admin", label: "Admin", icon: Shield, roles: ["ADMIN"] }
];

function NavItem({ item, active, isCollapsed }: { item: typeof nav[0]; active: boolean; isCollapsed: boolean }) {
  const Icon = item.icon;
  const qc = useQueryClient();

  const handlePrefetch = () => {
    if (item.href === "/finance") {
      qc.prefetchQuery({ queryKey: ["finance"], queryFn: () => api("/finance/summary") });
    } else if (item.href === "/events") {
      qc.prefetchQuery({ queryKey: ["events"], queryFn: () => api("/events") });
    } else if (item.href === "/team") {
      qc.prefetchQuery({ queryKey: ["team"], queryFn: () => api("/team") });
    } else if (item.href === "/coupons") {
      qc.prefetchQuery({ queryKey: ["coupons"], queryFn: () => api("/coupons") });
    } else if (item.href === "/reports") {
      qc.prefetchQuery({ queryKey: ["dashboard"], queryFn: () => api("/dashboard") });
    }
  };

  return (
    <Link
      href={item.href}
      onMouseEnter={handlePrefetch}
      title={isCollapsed ? item.label : undefined}
      className={cn(
        "group flex h-10 items-center gap-3 rounded-xl text-sm font-medium transition-all duration-200 relative overflow-hidden",
        isCollapsed ? "justify-center px-0 w-10 mx-auto" : "px-3",
        active
          ? "bg-primary text-white shadow-md shadow-primary/30"
          : "text-muted-foreground hover:bg-muted hover:text-foreground hover:shadow-sm"
      )}
    >
      <Icon className={cn("shrink-0 transition-transform duration-200 group-hover:scale-110", isCollapsed ? "h-5 w-5" : "h-4 w-4")} />
      {!isCollapsed && <span className="flex-1 animate-fade-in truncate">{item.label}</span>}
      {!isCollapsed && active && <ChevronRight className="h-3.5 w-3.5 opacity-70" />}
    </Link>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const hasHydrated = useAuthHydration();
  const user = useAuthStore((state) => state.user);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!user) { router.replace("/login"); return; }
    if (user.role === "CUSTOMER") { router.replace("/me/ingressos"); }
  }, [hasHydrated, user, router]);

  // Close mobile nav on route change
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  if (!hasHydrated || !user || user.role === "CUSTOMER") return null;

  const filteredNav = nav.filter((item) => item.roles.includes(user.role));
  const initials = (user?.name ?? "U").split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase();

  const Sidebar = (
    <div className="flex flex-col h-full bg-white dark:bg-card">
      {/* Logo */}
      <div className={cn("flex h-16 items-center border-b shrink-0 transition-all duration-300", isCollapsed ? "justify-center px-0" : "px-5 gap-3")}>
        {!isCollapsed && <BrandLogo />}
        {isCollapsed && <div className="h-8 w-8 rounded-lg brand-gradient flex items-center justify-center font-bold text-white text-xs">EF</div>}
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-3 scrollbar-hide">
        {filteredNav.map((item) => {
          const active = pathname.startsWith(item.href) && (item.href !== "/dashboard" || pathname === "/dashboard");
          return <NavItem key={item.href} item={item} active={active} isCollapsed={isCollapsed} />;
        })}
      </nav>

      {/* Collapse Toggle (Desktop) */}
      <div className="hidden lg:flex items-center justify-center p-2 border-t border-border/50">
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="flex h-8 w-full items-center justify-center rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        >
          {isCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>

      {/* User info */}
      <div className="border-t p-3 shrink-0">
        <div className={cn("flex items-center rounded-xl bg-muted/40 transition-all duration-300 border border-transparent hover:border-border/50 hover:bg-muted/80", isCollapsed ? "p-1.5 justify-center" : "p-3 gap-3")}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full brand-gradient text-white font-bold text-sm shadow-sm">
            {initials}
          </div>
          {!isCollapsed && (
            <div className="min-w-0 flex-1 animate-fade-in">
              <p className="truncate text-sm font-semibold leading-none text-foreground">{user?.name ?? "Organizador"}</p>
              <p className="truncate text-xs text-muted-foreground mt-0.5">{user?.email}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
      {/* ─── Desktop Sidebar ──────────────────────── */}
      <aside className={cn(
        "fixed inset-y-0 left-0 hidden border-r border-border/60 bg-white dark:bg-card shadow-sm lg:flex flex-col transition-all duration-300 z-30",
        isCollapsed ? "w-[80px]" : "w-64"
      )}>
        {Sidebar}
      </aside>

      {/* ─── Mobile Drawer Overlay ────────────────── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden animate-fade-in"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ─── Mobile Drawer ────────────────────────── */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-72 bg-white dark:bg-card shadow-2xl transform transition-transform duration-300 ease-in-out lg:hidden",
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="absolute right-3 top-3">
          <button onClick={() => setMobileOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-xl hover:bg-muted transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        {Sidebar}
      </aside>

      {/* ─── Content ──────────────────────────────── */}
      <div className={cn("transition-all duration-300 min-h-screen flex flex-col", isCollapsed ? "lg:pl-[80px]" : "lg:pl-64")}>
        <AppTopBar
          contentClassName="max-w-none"
          leadingAddon={
            <button
              type="button"
              aria-label="Abrir menu do painel"
              onClick={() => setMobileOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
          }
        />

        <main className="mx-auto w-full min-w-0 max-w-7xl flex-grow px-4 py-6 lg:px-8">
          <PageAnimation>{children}</PageAnimation>
        </main>
        
        {/* Rodapé do Organizador */}
        <footer className="mt-auto border-t bg-white/50 dark:bg-card/50 py-6">
          <div className="mx-auto max-w-7xl px-4 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
            <p>© {new Date().getFullYear()} Event Flow.</p>
            <div className="flex items-center gap-4">
              <Link href="/politica-de-cookies" className="hover:text-primary transition-colors">
                Política de Cookies
              </Link>
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
