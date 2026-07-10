"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3, Building2, CalendarDays, CreditCard, DoorOpen,
  FileBarChart2, LogOut, Shield, Tag, Ticket, UserCheck,
  UserCircle, Users, ChevronRight, Bell, Menu, X, Settings,
  ChevronDown, Megaphone
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { BrandLogo } from "@/components/brand-logo";
import { PageAnimation } from "@/components/page-animation";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";

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
  { href: "/notifications", label: "Notificações", icon: Bell, roles: ["ORGANIZER", "ADMIN"] },
  { href: "/profile", label: "Perfil", icon: UserCircle, roles: ["ORGANIZER", "ADMIN", "TEAM", "CHECKIN"] },
  { href: "/admin", label: "Admin", icon: Shield, roles: ["ADMIN"] }
];

function NavItem({ item, active }: { item: typeof nav[0]; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        "flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-all duration-150 relative",
        active
          ? "bg-primary text-white shadow-sm shadow-primary/30"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1">{item.label}</span>
      {active && <ChevronRight className="h-3.5 w-3.5 opacity-70" />}
    </Link>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  useEffect(() => {
    if (!user) { router.push("/login"); return; }
    if (user.role === "CUSTOMER") { router.push("/me/ingressos"); }
  }, [user, router]);

  // Close mobile nav on route change
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  if (!user || user.role === "CUSTOMER") return null;

  const filteredNav = nav.filter((item) => item.roles.includes(user.role));
  const initials = (user?.name ?? "U").split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase();

  const Sidebar = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b px-5 shrink-0">
        <BrandLogo />
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {filteredNav.map((item) => {
          const active = pathname.startsWith(item.href) && (item.href !== "/dashboard" || pathname === "/dashboard");
          return <NavItem key={item.href} item={item} active={active} />;
        })}
      </nav>

      {/* User info */}
      <div className="border-t p-3 shrink-0">
        <div className="flex items-center gap-3 rounded-xl bg-muted/60 p-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full brand-gradient text-white font-bold text-sm">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold leading-none">{user?.name ?? "Organizador"}</p>
            <p className="truncate text-xs text-muted-foreground mt-0.5">{user?.email}</p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* ─── Desktop Sidebar ──────────────────────── */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r bg-white dark:bg-card shadow-sm lg:flex flex-col">
        {Sidebar}
      </aside>

      {/* ─── Mobile Drawer Overlay ────────────────── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
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
      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-white/95 dark:bg-card/95 backdrop-blur px-4 shadow-sm lg:px-8">
          <div className="flex items-center gap-3">
            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-muted transition-colors lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="hidden sm:block">
              <p className="text-xs text-muted-foreground">Bem-vindo de volta,</p>
              <p className="font-bold text-base leading-tight">{user?.name ?? "Organizador"}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />

            {/* Notifications bell */}
            <button className="relative flex h-9 w-9 items-center justify-center rounded-xl hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
              <Bell className="h-4 w-4" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-brand-pink border-2 border-white dark:border-card" />
            </button>

            {/* User dropdown */}
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen((v) => !v)}
                className="flex items-center gap-2 rounded-xl p-1.5 pr-2.5 hover:bg-muted transition-colors"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full brand-gradient text-white font-bold text-xs">
                  {initials}
                </div>
                <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform duration-200", userMenuOpen && "rotate-180")} />
              </button>

              {userMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)} />
                  <div className="absolute right-0 top-11 z-20 min-w-[180px] rounded-2xl border bg-white dark:bg-card shadow-xl p-1.5 animate-scale-in">
                    <div className="px-3 py-2 border-b mb-1">
                      <p className="text-sm font-semibold truncate">{user?.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                    </div>
                    <Link href="/profile" onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-muted transition-colors">
                      <UserCircle className="h-4 w-4" /> Perfil
                    </Link>
                    <Link href="/enterprise" onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-muted transition-colors">
                      <Settings className="h-4 w-4" /> Configuracoes
                    </Link>
                    <div className="border-t mt-1 pt-1">
                      <button
                        onClick={() => { logout(); router.push("/login"); }}
                        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                      >
                        <LogOut className="h-4 w-4" /> Sair
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
          <PageAnimation>{children}</PageAnimation>
        </main>
      </div>
    </div>
  );
}
