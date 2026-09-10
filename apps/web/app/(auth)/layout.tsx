"use client";

import Image from "next/image";
import { BrandLogo } from "@/components/brand-logo";
import { ShieldCheck, QrCode, BarChart3 } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-[#07050e] text-white flex flex-col justify-between">
      {/* Background animado sutil fixo / 100% viewport */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <Image
          src="/images/eventflow-login-bg.png"
          alt="EventFlow Background"
          fill
          priority
          className="object-cover object-center animate-subtle-flow opacity-95"
          quality={100}
        />
        {/* Camada sutil para realçar contraste de leitura */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/40 pointer-events-none" />
      </div>

      {/* Top Header: Logo oficial à esquerda e microcopy à direita */}
      <header className="relative z-10 w-full px-6 sm:px-10 lg:px-14 xl:px-18 pt-7 sm:pt-9 lg:pt-11 flex items-start justify-between">
        <div className="flex items-center">
          <BrandLogo inverted className="scale-95 sm:scale-100 origin-left" />
        </div>

        {/* Microcopy superior direito */}
        <div className="hidden lg:block text-right">
          <div className="w-7 h-[1px] bg-purple-300/30 mb-2 ml-auto" />
          <p className="text-[9px] tracking-[0.25em] text-[#A59CB8]/60 uppercase font-medium leading-[1.6]">
            SIMPLES.
            <br />
            PODEROSO.
            <br />
            PARA O SEU EVENTO.
          </p>
        </div>
      </header>

      {/* Conteúdo Principal / Grid de 2 colunas */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-6 sm:px-10 lg:px-14 xl:px-18 py-8 lg:py-4 w-full max-w-[1520px] mx-auto">
        <div className="w-full grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] xl:grid-cols-[1.2fr_0.8fr] gap-10 lg:gap-12 xl:gap-20 items-center">
          
          {/* Lado Esquerdo: Headline, Eyebrow, Supporting copy e Features */}
          <section className="flex flex-col justify-center max-w-xl lg:max-w-2xl">
            {/* Eyebrow */}
            <div className="flex items-center gap-3 mb-4 sm:mb-5">
              <span className="text-[11px] lg:text-xs font-semibold tracking-[0.24em] text-[#B5A8CC] uppercase">
                EVENTOS QUE MOVEM PESSOAS
              </span>
              <span className="h-[1px] w-10 sm:w-14 bg-purple-300/30" />
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-[56px] xl:text-[64px] font-extrabold text-white leading-[1.03] tracking-tight">
              Controle total
              <br />
              <span className="text-white/95">do seu evento.</span>
            </h1>

            {/* Supporting Copy */}
            <p className="mt-5 sm:mt-6 text-base sm:text-lg text-[#AEA3C5] font-normal leading-relaxed max-w-lg">
              Venda ingressos, acompanhe pagamentos
              <br className="hidden sm:inline" />
              {" "}e valide entradas com fluidez.
            </p>

            {/* Features (3 Benefícios) */}
            <div className="mt-8 sm:mt-10 lg:mt-12 flex flex-wrap items-center gap-4 sm:gap-6">
              {/* Feature 1: Checkout seguro */}
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-[14px] bg-[#1B1333]/75 border border-purple-400/25 flex items-center justify-center shadow-[0_2px_12px_rgba(0,0,0,0.4)] backdrop-blur-md">
                  <ShieldCheck className="w-5 h-5 text-[#9E7BFF]" />
                </div>
                <div className="text-xs font-medium leading-tight">
                  <div className="text-white/95">Checkout</div>
                  <div className="text-[#AEA3C5]">seguro</div>
                </div>
              </div>

              {/* Feature 2: QR Code digital */}
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-[14px] bg-[#1B1333]/75 border border-purple-400/25 flex items-center justify-center shadow-[0_2px_12px_rgba(0,0,0,0.4)] backdrop-blur-md">
                  <QrCode className="w-5 h-5 text-[#9E7BFF]" />
                </div>
                <div className="text-xs font-medium leading-tight">
                  <div className="text-white/95">QR Code</div>
                  <div className="text-[#AEA3C5]">digital</div>
                </div>
              </div>

              {/* Feature 3: Painel em tempo real */}
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-[14px] bg-[#1B1333]/75 border border-purple-400/25 flex items-center justify-center shadow-[0_2px_12px_rgba(0,0,0,0.4)] backdrop-blur-md">
                  <BarChart3 className="w-5 h-5 text-[#9E7BFF]" />
                </div>
                <div className="text-xs font-medium leading-tight">
                  <div className="text-white/95">Painel em</div>
                  <div className="text-[#AEA3C5]">tempo real</div>
                </div>
              </div>
            </div>
          </section>

          {/* Lado Direito: Container compartilhado dos Cards */}
          <section className="w-full flex justify-center lg:justify-end">
            <div className="w-full max-w-[490px] xl:max-w-[510px]">
              {children}
            </div>
          </section>
        </div>
      </main>

      {/* Bottom Footer / Microcopy inferior */}
      <footer className="relative z-10 w-full px-6 sm:px-10 lg:px-14 xl:px-18 pb-6 sm:pb-8 pt-2 flex flex-col sm:flex-row items-center sm:justify-between gap-4">
        {/* Microcopy inferior esquerdo */}
        <div className="hidden sm:block">
          <div className="w-6 h-[1px] bg-purple-300/30 mb-2" />
          <p className="text-[9px] tracking-[0.22em] text-[#A59CB8]/60 uppercase font-medium leading-[1.6]">
            TECNOLOGIA PARA
            <br />
            GRANDES EXPERIÊNCIAS
          </p>
        </div>

        {/* Microcopy inferior direito */}
        <div className="hidden sm:block text-right">
          <p className="text-[9px] tracking-[0.22em] text-[#A59CB8]/60 uppercase font-medium leading-[1.6]">
            MAIS QUE EVENTOS.
            <br />
            MOVIMENTO.
          </p>
        </div>
      </footer>

      {/* Estilo local para animação do background e suporte a reduced-motion */}
      <style jsx global>{`
        @keyframes subtleFlowAnimation {
          0% {
            transform: scale(1) translate(0, 0);
          }
          50% {
            transform: scale(1.01) translate(-6px, -4px);
          }
          100% {
            transform: scale(1) translate(0, 0);
          }
        }
        .animate-subtle-flow {
          animation: subtleFlowAnimation 14s ease-in-out infinite;
        }
        @keyframes cardFadeIn {
          from {
            opacity: 0;
            transform: translateY(6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-card-enter {
          animation: cardFadeIn 220ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-subtle-flow,
          .animate-card-enter {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}


