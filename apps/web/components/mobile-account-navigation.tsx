"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Compass, LayoutDashboard, LogOut, UserCheck2, UserCircle } from "lucide-react";
import { useAuthHydration } from "@/hooks/use-auth-hydration";
import { getMobileAccountNavItems } from "@/lib/mobile-account-navigation";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";

const itemIcons = {
  explore: Compass,
  profile: UserCircle,
  panel: LayoutDashboard,
  "become-producer": UserCheck2
};

export function MobileAccountNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const hasHydrated = useAuthHydration();
  const { user, logout } = useAuthStore();

  if (!hasHydrated || !user) {
    return null;
  }

  const navItems = getMobileAccountNavItems(user.role, pathname);

  return (
    <nav
      aria-label="Navegação da conta"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border/70 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(13,11,26,0.12)] backdrop-blur-xl dark:bg-card/95 md:hidden"
    >
      <div className="mx-auto grid h-16 max-w-lg grid-cols-4 px-1">
        {navItems.map((item) => {
          const Icon = itemIcons[item.id];

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.ariaLabel}
              aria-current={item.isActive ? "page" : undefined}
              className={cn(
                "relative flex min-h-11 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                item.isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground active:bg-muted"
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "absolute inset-x-4 top-0 h-0.5 rounded-b-full transition-colors",
                  item.isActive ? "bg-primary" : "bg-transparent"
                )}
              />
              <Icon className="h-5 w-5" aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          aria-label="Sair da conta"
          onClick={() => {
            logout();
            router.replace("/login");
          }}
          className="relative flex min-h-11 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-semibold text-muted-foreground transition-colors hover:text-destructive active:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          <LogOut className="h-5 w-5" aria-hidden="true" />
          <span>Sair</span>
        </button>
      </div>
    </nav>
  );
}
