import { ThemeToggle } from "@/components/theme-toggle";
import { BrandLogo } from "@/components/brand-logo";
import { PageAnimation } from "@/components/page-animation";
import { Ticket } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen lg:grid lg:grid-cols-[1fr_480px]">
      {/* Lado esquerdo — branding laranja */}
      <section className="relative hidden lg:flex flex-col justify-between overflow-hidden hero-gradient">
        {/* Pattern overlay */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 h-96 w-96 rounded-full bg-white/30 -translate-y-1/2 translate-x-1/3" />
          <div className="absolute bottom-0 left-0 h-64 w-64 rounded-full bg-white/20 translate-y-1/3 -translate-x-1/4" />
        </div>

        {/* Logo */}
        <div className="relative z-10 p-10">
          <div className="flex items-center gap-3">
            <BrandLogo inverted />
          </div>
        </div>

        {/* Hero text */}
        <div className="relative z-10 p-10 pb-16">
          <h1 className="max-w-lg text-4xl font-extrabold text-white leading-tight tracking-tight">
            Venda ingressos, acompanhe receita e valide entradas em uma única operação.
          </h1>
          <p className="mt-4 text-white/80 text-lg max-w-md">
            A plataforma com as menores taxas do mercado! Mais de 10 mil eventos criados. Checkout seguro, QR Code digital e financeiro em tempo real.
          </p>

          <div className="mt-10 grid grid-cols-3 gap-6">
            {[
              { value: "10k+", label: "Eventos criados" },
              { value: "500k+", label: "Ingressos vendidos" },
              { value: "99.9%", label: "Uptime garantido" },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-3xl font-extrabold text-white">{stat.value}</p>
                <p className="text-sm text-white/75 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Lado direito — formulário */}
      <section className="flex min-h-screen flex-col bg-[#F8F8F8] dark:bg-background">
        <div className="flex justify-between items-center p-4">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 lg:hidden">
            <BrandLogo />
          </div>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center p-6">
          <PageAnimation className="w-full">{children}</PageAnimation>
        </div>
      </section>
    </main>
  );
}
