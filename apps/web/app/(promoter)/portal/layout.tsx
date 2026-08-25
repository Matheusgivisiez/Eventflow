"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LayoutDashboard, Wallet, Megaphone, Settings, Ticket, LogOut } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";

export default function PromoterPortalLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, accessToken, logout } = useAuthStore();

  // Guard: only PROMOTER role can access this layout
  useEffect(() => {
    if (!accessToken || !user) {
      router.replace("/login?redirect=/portal/dashboard");
      return;
    }
    if (user.role !== "PROMOTER") {
      // If logged in but not a promoter, redirect to the correct dashboard
      router.replace("/dashboard");
    }
  }, [accessToken, user, router]);

  // Don't render until auth is confirmed
  if (!accessToken || !user || user.role !== "PROMOTER") {
    return null;
  }

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 z-50 flex w-72 flex-col border-r bg-white dark:bg-card">
        <div className="flex h-16 items-center px-6 border-b">
          <Ticket className="h-6 w-6 text-primary mr-2" />
          <span className="text-xl font-black tracking-tight">Event Flow <span className="text-primary">Portal</span></span>
        </div>

        <div className="px-4 py-3 border-b bg-muted/30">
          <p className="text-xs text-muted-foreground">Logado como</p>
          <p className="text-sm font-semibold truncate">{user.name}</p>
          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
        </div>

        <div className="flex-1 overflow-auto py-6 px-4 space-y-1">
          <NavItem href="/portal/dashboard" icon={LayoutDashboard} label="Dashboard" />
          <NavItem href="/portal/links" icon={Megaphone} label="Meus Links & Vendas" />
          <NavItem href="/portal/finance" icon={Wallet} label="Financeiro & Saques" />
          <NavItem href="/portal/settings" icon={Settings} label="Minha Conta" />
        </div>

        <div className="p-4 border-t">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
          >
            <LogOut className="h-5 w-5" />
            Sair
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 pl-72">
        <div className="p-8 max-w-6xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}

function NavItem({ href, icon: Icon, label }: { href: string; icon: any; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-50 transition-colors"
    >
      <Icon className="h-5 w-5" />
      {label}
    </Link>
  );
}
