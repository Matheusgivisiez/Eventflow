"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3, Building2, CalendarDays, CreditCard, DoorOpen,
  FileBarChart2, LogOut, Shield, Tag, Ticket, UserCheck,
  UserCircle, Users, ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: BarChart3, roles: ["ORGANIZER", "ADMIN", "TEAM"] },
  { href: "/events", label: "Eventos", icon: CalendarDays, roles: ["ORGANIZER", "ADMIN", "TEAM"] },
  { href: "/participants", label: "Participantes", icon: UserCheck, roles: ["ORGANIZER", "ADMIN", "TEAM"] },
  { href: "/check-in", label: "Check-in", icon: DoorOpen, roles: ["ORGANIZER", "ADMIN", "TEAM", "CHECKIN"] },
  { href: "/finance", label: "Financeiro", icon: CreditCard, roles: ["ORGANIZER", "ADMIN", "TEAM"] },
  { href: "/reports", label: "Relatórios", icon: FileBarChart2, roles: ["ORGANIZER", "ADMIN", "TEAM"] },
  { href: "/enterprise", label: "Enterprise", icon: Building2, roles: ["ORGANIZER", "ADMIN", "TEAM"] },
  { href: "/team", label: "Equipe", icon: Users, roles: ["ORGANIZER", "ADMIN"] },
  { href: "/coupons", label: "Cupons", icon: Tag, roles: ["ORGANIZER", "ADMIN", "TEAM"] },
  { href: "/profile", label: "Perfil", icon: UserCircle, roles: ["ORGANIZER", "ADMIN", "TEAM", "CHECKIN"] },
  { href: "/admin", label: "Admin", icon: Shield, roles: ["ADMIN"] }
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }
    if (user.role === "CUSTOMER") {
      router.push("/me/ingressos");
    }
  }, [user, router]);

  if (!user || user.role === "CUSTOMER") {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r bg-white dark:bg-card shadow-sm lg:flex">
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 border-b px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary shadow-md">
            <Ticket className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="font-bold leading-none text-base">
              Event<span className="text-primary">Flow</span>
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Painel do organizador</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
          {nav
            .filter((item) => !user?.role || item.roles.includes(user.role))
            .map((item) => {
              const Icon = item.icon;
              const active = pathname.startsWith(item.href) && (item.href !== "/dashboard" || pathname === "/dashboard");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-all duration-150",
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
            })}
        </nav>

        {/* User info */}
        <div className="border-t p-3">
          <div className="flex items-center gap-3 rounded-xl bg-muted/60 p-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm">
              {user?.name?.charAt(0).toUpperCase() ?? "U"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold leading-none">{user?.name ?? "Organizador"}</p>
              <p className="truncate text-xs text-muted-foreground mt-0.5">{user?.email}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Content */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-white/95 dark:bg-card/95 backdrop-blur px-4 shadow-sm lg:px-8">
          <div>
            <p className="text-xs text-muted-foreground">Bem-vindo de volta,</p>
            <p className="font-bold text-base leading-tight">{user?.name ?? "Organizador"}</p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              title="Sair"
              onClick={() => { logout(); router.push("/login"); }}
              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
