"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { ArrowLeft, Compass, LayoutDashboard, Ticket, User, UserCheck2 } from "lucide-react";
import { AccountMenu } from "@/components/account-menu";
import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { useAuthHydration } from "@/hooks/use-auth-hydration";
import { getOrganizerCtaHref } from "@/lib/organizer-route";
import { cn } from "@/lib/utils";
import { useAuthStore, type AuthUser } from "@/stores/auth-store";

const PANEL_ACCESS_ROLES: AuthUser["role"][] = ["ADMIN", "ORGANIZER", "TEAM", "CHECKIN"];

type AppTopBarProps = {
  backHref?: string;
  backLabel?: string;
  className?: string;
  contentClassName?: string;
  compact?: boolean;
  leadingAddon?: ReactNode;
};

function getInitials(name?: string) {
  return (name ?? "U")
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function getPanelHref(role?: AuthUser["role"]) {
  if (role === "CHECKIN") return "/check-in";
  return "/dashboard";
}

export function AppTopBar({
  backHref,
  backLabel = "Voltar",
  className,
  contentClassName,
  compact = false,
  leadingAddon
}: AppTopBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const hasHydrated = useAuthHydration();
  const { user: storedUser, logout } = useAuthStore();
  const user = hasHydrated ? storedUser : undefined;
  const initials = getInitials(user?.name);
  const hasPanelAccess = user ? PANEL_ACCESS_ROLES.includes(user.role) : false;
  const producerHref = user ? getOrganizerCtaHref(user.role) : "/#vender";

  const navItems = [
    {
      href: "/",
      label: "Explorar",
      icon: Compass,
      active: pathname === "/"
    },
    ...(user
      ? [
          {
            href: "/me/ingressos",
            label: "Ingressos",
            icon: Ticket,
            active: pathname.startsWith("/me/ingressos")
          },
          {
            href: "/me/conta",
            label: "Perfil",
            icon: User,
            active: pathname.startsWith("/me") && !pathname.startsWith("/me/organizador") && !pathname.startsWith("/me/ingressos")
          },
          {
            href: hasPanelAccess ? getPanelHref(user.role) : "/me/organizador",
            label: hasPanelAccess ? "Painel" : "Ser produtor",
            icon: hasPanelAccess ? LayoutDashboard : UserCheck2,
            active: hasPanelAccess
              ? ["/dashboard", "/events", "/participants", "/check-in", "/finance", "/reports", "/enterprise", "/promoters", "/team", "/coupons", "/notifications", "/profile", "/admin"].some((route) => pathname === route || pathname.startsWith(`${route}/`))
              : pathname.startsWith("/me/organizador")
          }
        ]
      : [
          {
            href: producerHref,
            label: "Organizadores",
            icon: UserCheck2,
            active: false
          }
        ])
  ];

  function handleLogout() {
    logout();
    router.push("/login");
  }

  return (
    <header className={cn("sticky top-0 z-40 w-full border-b border-border/60 bg-background/92 shadow-sm backdrop-blur-xl", className)}>
      <div className={cn("mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 lg:px-8", contentClassName)}>
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {leadingAddon}

          {backHref ? (
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="shrink-0 gap-2 rounded-xl text-muted-foreground hover:text-foreground"
            >
              <Link href={backHref}>
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">{backLabel}</span>
              </Link>
            </Button>
          ) : (
            <Link href="/" className="group shrink-0 transition-opacity hover:opacity-90">
              <BrandLogo />
            </Link>
          )}

          {backHref && (
            <Link href="/" className="group shrink-0 transition-opacity hover:opacity-90">
              <BrandLogo />
            </Link>
          )}
        </div>

        {!compact && (
          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Button
                  key={item.href}
                  asChild
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "gap-2 rounded-xl",
                    item.active
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
        )}

        <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
          <ThemeToggle />
          {hasHydrated && user ? (
            <AccountMenu
              initials={initials}
              name={user.name}
              profileHref="/me/conta"
              onLogout={handleLogout}
            />
          ) : hasHydrated ? (
            <>
              <Button asChild variant="ghost" size="sm" className="rounded-xl">
                <Link href="/login">Entrar</Link>
              </Button>
              <Button asChild size="sm" className="hidden rounded-xl bg-primary text-white shadow-sm shadow-primary/30 hover:bg-primary/90 sm:inline-flex">
                <Link href="/register">Criar conta</Link>
              </Button>
            </>
          ) : (
            <div className="h-10 w-24" aria-hidden="true" />
          )}
        </div>
      </div>
    </header>
  );
}
