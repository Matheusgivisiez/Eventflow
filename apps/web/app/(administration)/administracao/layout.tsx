"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Shield } from "lucide-react";
import { AppTopBar } from "@/components/app-top-bar";
import { BrandLogo } from "@/components/brand-logo";
import { useAuthHydration } from "@/hooks/use-auth-hydration";
import { useAuthStore } from "@/stores/auth-store";

export default function AdministrationLayout({ children }: { children: React.ReactNode }) {
  const hydrated = useAuthHydration();
  const user = useAuthStore(state => state.user);
  const router = useRouter();

  useEffect(() => {
    if (!hydrated) return;
    if (!user) router.replace("/login");
    else if (user.role !== "ADMIN") router.replace("/dashboard");
  }, [hydrated, user, router]);

  if (!hydrated || user?.role !== "ADMIN") return null;

  return <div className="min-h-screen bg-background">
    <aside className="fixed inset-y-0 left-0 hidden w-56 border-r bg-card p-5 lg:flex lg:flex-col">
      <Link href="/administracao" aria-label="Início da administração"><BrandLogo /></Link>
      <div className="mt-10 flex items-center gap-2 rounded-xl bg-primary/10 px-3 py-2 text-sm font-semibold text-primary"><Shield className="h-4 w-4" /> Administração</div>
      <nav className="mt-6 space-y-2 text-sm">
        <Link href="/administracao" className="block rounded-lg px-3 py-2 hover:bg-muted">Visão geral</Link>
        <a href="/administracao?tab=events" className="block rounded-lg px-3 py-2 hover:bg-muted">Todos os eventos</a>
        <a href="/administracao?tab=users" className="block rounded-lg px-3 py-2 hover:bg-muted">Usuários</a>
        <a href="/administracao?tab=payments" className="block rounded-lg px-3 py-2 hover:bg-muted">Pagamentos</a>
      </nav>
      <Link href="/dashboard" className="mt-auto flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted"><ArrowLeft className="h-4 w-4" /> Painel do organizador</Link>
    </aside>
    <div className="lg:pl-56">
      <AppTopBar contentClassName="max-w-none" />
      <main className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-8">
        <div className="mb-5 flex flex-wrap gap-2 lg:hidden">
          <Link href="/administracao" className="rounded-lg border px-3 py-2 text-sm">Administração</Link>
          <Link href="/dashboard" className="rounded-lg border px-3 py-2 text-sm">Painel do organizador</Link>
        </div>
        {children}
      </main>
    </div>
  </div>;
}
