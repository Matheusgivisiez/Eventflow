"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { History, Inbox, Ticket, UserCog } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);

  const tabs = [
    { href: "/me/ingressos", icon: Ticket, label: "Meus Ingressos" },
    { href: "/me/recebidos", icon: Inbox, label: "Recebidos" },
    { href: "/me/historico", icon: History, label: "Historico" },
    { href: "/me/conta", icon: UserCog, label: "Minha Conta" },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Header do Perfil */}
      <div className="flex items-center gap-4 mb-8">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-2xl shadow-sm">
          {user?.name?.charAt(0).toUpperCase() ?? "U"}
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Olá, {user?.name ?? "Participante"}
          </h1>
          <p className="text-muted-foreground text-sm">
            Gerencie seus ingressos e dados da conta
          </p>
        </div>
      </div>

      {/* Navegação por Abas */}
      <div className="flex items-center gap-2 mb-8 border-b border-border/60 pb-1 overflow-x-auto scrollbar-hide">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex items-center gap-2 whitespace-nowrap px-4 py-2.5 text-sm font-semibold transition-all rounded-t-lg border-b-2",
                isActive
                  ? "border-primary text-primary bg-primary/5"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30"
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </Link>
          );
        })}
      </div>

      {/* Conteúdo da Aba */}
      <div>{children}</div>
    </div>
  );
}
