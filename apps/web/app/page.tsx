"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight, CalendarPlus, ChevronRight, Compass, MapPin,
  Music, GraduationCap, Dumbbell, Theater, Users, Briefcase,
  Search, ShieldCheck, Ticket, UserCircle, Zap, Star, TrendingDown
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EventCard } from "@/components/event-card";
import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import type { EventFlowEvent, Paginated } from "@/types/eventflow";

const categories = [
  { id: "all", label: "Todos", icon: Zap },
  { id: "Show", label: "Shows", icon: Music },
  { id: "Curso", label: "Cursos", icon: GraduationCap },
  { id: "Congresso", label: "Congressos", icon: Briefcase },
  { id: "Teatro", label: "Teatro", icon: Theater },
  { id: "Esporte", label: "Esportes", icon: Dumbbell },
  { id: "Social", label: "Social", icon: Users },
];

export default function CatalogPage() {
  const { user, logout } = useAuthStore();
  const [search, setSearch] = useState("");
  const [city, setCity] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  const query = useMemo(() => {
    const params = new URLSearchParams();
    const term = [search, city].filter(Boolean).join(" ");
    if (term) params.set("search", term);
    if (selectedCategory !== "all") params.set("category", selectedCategory);
    return params.toString();
  }, [search, city, selectedCategory]);

  const { data, isLoading } = useQuery<Paginated<EventFlowEvent>>({
    queryKey: ["public-events", query],
    queryFn: () => api(`/events/public?${query}`, { auth: false })
  });

  const events = data?.data ?? [];

  return (
    <div className="min-h-screen bg-[#F8F8F8] dark:bg-background">
      {/* ─── HEADER ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 glass border-b shadow-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 lg:px-8">
          <Link href="/" className="group hover:opacity-90 transition-opacity">
            <BrandLogo />
          </Link>

          <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
            <a href="#eventos" className="hover:text-foreground transition-colors">Comprar ingressos</a>
            <a href="#vender" className="hover:text-foreground transition-colors">Para organizadores</a>
            <Link href="/me" className="hover:text-foreground transition-colors">Perfil</Link>
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            {user ? (
              <>
                <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex gap-2">
                  <Link href="/me">
                    <UserCircle className="h-4 w-4" />
                    Perfil
                  </Link>
                </Button>
                <Button variant="outline" size="sm" onClick={logout} className="border-primary/30 text-primary hover:bg-primary hover:text-white transition-colors">
                  Sair
                </Button>
              </>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/login">Entrar</Link>
                </Button>
                <Button asChild size="sm" className="bg-primary hover:bg-primary/90 shadow-sm shadow-primary/30 text-white">
                  <Link href="/register">Criar conta</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ─── HERO ────────────────────────────────────────────────── */}
      <section className="border-b bg-white dark:bg-card">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:px-8 lg:py-20">
          <div className="max-w-2xl">
            <div className="animate-fade-in">
              <Badge className="mb-5 border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100">
                <Star className="mr-1 h-3 w-3 fill-blue-600" />
                Eventos que cabem na sua agenda
              </Badge>
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl lg:text-6xl dark:text-white">
              Encontre seu próximo evento.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-slate-600 dark:text-slate-300">
              Compre ingressos com segurança, receba seu acesso digital e viva experiências que ficam na memória.
            </p>

            {/* Barra de busca */}
            <div className="mt-8 max-w-3xl">
              <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row dark:border-slate-700 dark:bg-slate-900">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    className="w-full rounded-lg bg-slate-50 py-3 pl-9 pr-4 text-base outline-none transition-all duration-200 focus:bg-white focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground dark:bg-slate-800"
                    placeholder="Nome do evento, artista..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <div className="relative sm:w-52">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    className="w-full rounded-lg bg-slate-50 py-3 pl-9 pr-4 text-base outline-none transition-all duration-200 focus:bg-white focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground dark:bg-slate-800"
                    placeholder="Cidade"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                  />
                </div>
                <Button asChild className="bg-primary px-6 text-white shadow-sm hover:bg-primary/90">
                  <a href="#eventos">
                    Buscar
                    <ArrowRight className="h-4 w-4" />
                  </a>
                </Button>
              </div>
            </div>
          </div>
          <div className="relative min-h-[280px] overflow-hidden rounded-2xl bg-blue-50 dark:bg-slate-800">
            {events[0]?.bannerUrl ? (
              <Image src={events[0].bannerUrl} alt={events[0].title} fill priority sizes="(max-width: 1024px) 100vw, 45vw" className="object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center bg-blue-700 p-10 text-center text-white">
                <div>
                  <Ticket className="mx-auto mb-4 h-12 w-12" />
                  <p className="text-xl font-semibold">Seu próximo momento começa aqui</p>
                </div>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/65 via-transparent to-transparent" />
            {events[0] && <p className="absolute bottom-5 left-5 right-5 text-lg font-semibold text-white">{events[0].title}</p>}
          </div>
        </div>
      </section>

      {/* ─── CATEGORIAS ─────────────────────────────────────────── */}
      <section id="eventos" className="mx-auto max-w-7xl px-4 pt-8 pb-2 lg:px-8 animate-fade-in">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold tracking-tight">Explorar por categoria</h2>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const isActive = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 border ${
                  isActive
                    ? "bg-primary text-white border-primary shadow-md shadow-primary/25"
                    : "bg-white dark:bg-card border-border text-muted-foreground hover:border-primary/50 hover:text-primary"
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-white" : ""}`} />
                {cat.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* ─── EVENTOS ────────────────────────────────────────────── */}
      <main className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
        {isLoading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="rounded-2xl border bg-white dark:bg-card overflow-hidden animate-pulse">
                <div className="h-44 bg-muted" />
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                  <div className="h-3 bg-muted rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-dashed bg-white dark:bg-card p-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
              <Compass className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-xl font-bold">Nenhum evento encontrado</h3>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Tente outro termo, cidade ou categoria para descobrir novos eventos.
            </p>
            <Button className="mt-6 bg-primary hover:bg-primary/90 text-white" onClick={() => { setSearch(""); setCity(""); setSelectedCategory("all"); }}>
              Ver todos os eventos
            </Button>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 stagger-children">
            {events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </main>

      {/* ─── ORGANIZADOR CTA ────────────────────────────────────── */}
      <section id="vender" className="border-t bg-white dark:bg-card mt-8">
        <div className="mx-auto max-w-7xl px-4 py-16 lg:px-8">
          <div className="rounded-3xl hero-gradient p-10 lg:p-16 text-white overflow-hidden relative">
            <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-10">
              <CalendarPlus className="h-full w-full" />
            </div>
            <div className="relative max-w-xl">
              <Badge className="mb-4 bg-white/20 text-white border-white/30">Para organizadores</Badge>
              <h2 className="text-3xl font-extrabold lg:text-4xl">Crie e venda ingressos para o seu evento</h2>
              <p className="mt-4 text-white/85 text-lg">
                A plataforma com as menores taxas do mercado! Cadastre seu evento em minutos, publique a página de vendas, gerencie lotes e valide entradas por QR Code.
              </p>
              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                <Button asChild size="lg" className="bg-white text-primary hover:bg-white/90 font-bold shadow-lg">
                  <Link href="/register">Criar meu evento <ChevronRight className="h-4 w-4" /></Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="border-white/50 text-white hover:bg-white/10">
                  <Link href="/login">Já tenho conta</Link>
                </Button>
              </div>
              <div className="mt-8 grid grid-cols-3 gap-4">
                {[
                  { icon: ShieldCheck, label: "Checkout seguro" },
                  { icon: Zap, label: "Check-in por QR Code" },
                  { icon: TrendingDown, label: "Menores taxas do mercado" },
                ].map((item) => (
                  <div key={item.label} className="flex flex-col items-center gap-2 text-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
                      <item.icon className="h-5 w-5 text-white" />
                    </div>
                    <span className="text-xs font-medium text-white/90">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ─────────────────────────────────────────────── */}
      <footer className="border-t bg-white dark:bg-card py-8">
        <div className="mx-auto max-w-7xl px-4 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <BrandLogo iconOnly className="h-6 w-6" />
            <p>© {new Date().getFullYear()} Event Flow.</p>
          </div>
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
  );
}
