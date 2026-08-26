"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight, CalendarPlus, ChevronRight, Compass, MapPin,
  Music, GraduationCap, Dumbbell, Theater, Users, Briefcase,
  Search, ShieldCheck, UserCircle, Zap, TrendingDown
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EventCard } from "@/components/event-card";
import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import Topography from "@/components/topography/Topography";
import { api } from "@/lib/api";
import { getOrganizerCtaHref } from "@/lib/organizer-route";
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

  const { data, isLoading, isFetching, refetch } = useQuery<Paginated<EventFlowEvent>>({
    queryKey: ["public-events", query],
    queryFn: () => api(query ? `/events/public?${query}` : "/events/public", { auth: false })
  });

  const events = data?.data ?? [];
  const organizerCtaHref = getOrganizerCtaHref(user?.role);
  const hasActiveFilters = Boolean(search || city || selectedCategory !== "all");

  function handleShowAllEvents() {
    setSearch("");
    setCity("");
    setSelectedCategory("all");
    if (!hasActiveFilters) {
      void refetch();
    }
  }

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
      <section className="relative overflow-hidden bg-[#1a1528] min-h-[600px] flex items-center">
        {/* Background Animation Container */}
        <div className="absolute inset-0 z-0">
          <Topography
            lowColor="#5227FF"
            midColor="#FF9FFC"
            highColor="#FFFFFF"
            speed={0.35}
            morphAmount={3}
            morphSpeed={0.05}
            bands={2}
            thickness={0.01}
            scale={2}
            pixelSize={1}
            glow={0.5}
            colorMode="elevation"
            contrast={3}
            brightness={1}
            fillBands={false}
            opacity={1}
            grain={true}
            grainIntensity={0.05}
            mouseInteraction={true}
            mouseRadius={0.3}
            mouseStrength={0.4}
          />
        </div>

        <div className="relative z-10 mx-auto max-w-7xl px-4 py-16 lg:py-24 lg:px-8 w-full">
          <div className="text-center">
            <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl drop-shadow-sm animate-slide-up" style={{ animationDelay: "0.1s" }}>
              Encontre eventos e compre{" "}
              <span className="block">ingressos com segurança</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-white/85 animate-slide-up" style={{ animationDelay: "0.2s" }}>
              Shows, cursos, congressos, teatros e muito mais. Tudo num só lugar com checkout rápido e ingresso digital.
            </p>

            {/* Barra de busca */}
            <div className="mx-auto mt-8 max-w-3xl animate-slide-up" style={{ animationDelay: "0.3s" }}>
              <div className="flex flex-col gap-3 rounded-2xl bg-white p-3 shadow-2xl shadow-black/10 sm:flex-row transition-all duration-300 focus-within:shadow-primary/20 focus-within:ring-2 focus-within:ring-primary/20">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    className="w-full rounded-lg bg-muted/50 py-3 pl-9 pr-4 text-sm outline-none transition-all duration-200 focus:bg-white focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground"
                    placeholder="Nome do evento, artista..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <div className="relative sm:w-52">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    className="w-full rounded-lg bg-muted/50 py-3 pl-9 pr-4 text-sm outline-none transition-all duration-200 focus:bg-white focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground"
                    placeholder="Cidade"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                  />
                </div>
                <Button asChild className="bg-primary hover:bg-primary/90 active:scale-95 transition-all text-white shadow-md px-6 rounded-xl">
                  <a href="#eventos">
                    Buscar
                    <ArrowRight className="h-4 w-4" />
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Wave separator */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
            <path d="M0 60L60 50C120 40 240 20 360 15C480 10 600 20 720 28C840 36 960 42 1080 40C1200 38 1320 28 1380 23L1440 18V60H0Z" fill="#F8F8F8" className="dark:fill-background" />
          </svg>
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
            <Button
              className="mt-6 bg-primary hover:bg-primary/90 text-white"
              disabled={isFetching}
              onClick={handleShowAllEvents}
            >
              {isFetching ? "Atualizando..." : "Ver todos os eventos"}
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
                  <Link href={organizerCtaHref}>Criar meu evento <ChevronRight className="h-4 w-4" /></Link>
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
