import { redirect } from "next/navigation";
import Link from "next/link";
import { LayoutDashboard, Wallet, Megaphone, Settings, Ticket, LogOut } from "lucide-react";

export default function PromoterPortalLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 z-50 flex w-72 flex-col border-r bg-white dark:bg-card">
        <div className="flex h-16 items-center px-6 border-b">
          <Ticket className="h-6 w-6 text-primary mr-2" />
          <span className="text-xl font-black tracking-tight">Event Flow <span className="text-primary">Portal</span></span>
        </div>
        <div className="flex-1 overflow-auto py-6 px-4 space-y-1">
          <NavItem href="/portal/dashboard" icon={LayoutDashboard} label="Dashboard" />
          <NavItem href="/portal/links" icon={Megaphone} label="Meus Links & Vendas" />
          <NavItem href="/portal/finance" icon={Wallet} label="Financeiro & Saques" />
        </div>
        <div className="p-4 border-t">
          <NavItem href="/portal/settings" icon={Settings} label="Minha Conta" />
          <NavItem href="/logout" icon={LogOut} label="Sair" variant="destructive" />
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

function NavItem({ href, icon: Icon, label, variant = "default" }: { href: string, icon: any, label: string, variant?: "default" | "destructive" }) {
  const isDestructive = variant === "destructive";
  return (
    <Link 
      href={href}
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
        isDestructive 
          ? "text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50" 
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-50"
      }`}
    >
      <Icon className="h-5 w-5" />
      {label}
    </Link>
  );
}
