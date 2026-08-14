import { Metadata } from "next";
import Link from "next/link";
import { Cookie, ShieldCheck, Settings2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";

import { CookieSettingsButton } from "./cookie-button";

export const metadata: Metadata = {
  title: "Política de Cookies | EventFlow",
  description: "Entenda como a EventFlow utiliza cookies para melhorar sua experiência na plataforma.",
};

export default function CookiePolicyPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header simples para a página de política */}
      <header className="sticky top-0 z-30 w-full border-b bg-white/95 dark:bg-card/95 backdrop-blur shadow-sm h-16 flex items-center px-4 md:px-8">
        <Link href="/" className="font-bold text-xl flex items-center gap-2 text-primary hover:opacity-80 transition-opacity">
          <div className="h-8 w-8 rounded-lg brand-gradient flex items-center justify-center text-white">
            EF
          </div>
          EventFlow
        </Link>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-12 md:py-20">
        <div className="mb-10 text-center space-y-4">
          <div className="mx-auto bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center text-primary mb-6">
            <Cookie className="h-8 w-8" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight">Política de Cookies</h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Última atualização: {new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
          </p>
        </div>

        <div className="prose prose-slate dark:prose-invert max-w-none space-y-8">
          <section className="bg-card border rounded-2xl p-6 md:p-8 shadow-sm">
            <h2 className="flex items-center gap-2 text-2xl font-semibold mt-0 mb-4">
              <Info className="text-primary h-6 w-6" /> O que são cookies?
            </h2>
            <p>
              Cookies são pequenos arquivos de texto armazenados no seu navegador ou dispositivo quando você visita um site. 
              Eles permitem que a plataforma lembre de suas ações e preferências (como login, idioma, tamanho da fonte e outras preferências de exibição) por um período de tempo. 
              Dessa forma, você não precisa reinseri-las sempre que retornar ao site ou navegar de uma página para outra.
            </p>
          </section>

          <section className="space-y-6">
            <h2 className="text-2xl font-semibold border-b pb-2">Como utilizamos os cookies</h2>
            <p>A EventFlow utiliza cookies para diferentes finalidades, categorizados da seguinte forma:</p>
            
            <div className="grid gap-6 md:grid-cols-3">
              <div className="bg-card border rounded-xl p-5 shadow-sm">
                <h3 className="font-semibold text-lg flex items-center gap-2 mb-2">
                  <ShieldCheck className="h-5 w-5 text-emerald-500" /> Necessários
                </h3>
                <p className="text-sm text-muted-foreground">
                  Estes cookies são essenciais para que a plataforma funcione corretamente. Eles permitem funcionalidades básicas como segurança, gerenciamento de rede, acesso a áreas logadas e processamento do carrinho de compras. Não podem ser desativados.
                </p>
              </div>
              
              <div className="bg-card border rounded-xl p-5 shadow-sm">
                <h3 className="font-semibold text-lg flex items-center gap-2 mb-2">
                  <Settings2 className="h-5 w-5 text-blue-500" /> Estatísticas
                </h3>
                <p className="text-sm text-muted-foreground">
                  Coletam informações anonimizadas sobre como você interage com a plataforma. Ajudam-nos a entender quais páginas são mais visitadas e como melhorar o design e a performance do nosso site (ex: Google Analytics).
                </p>
              </div>

              <div className="bg-card border rounded-xl p-5 shadow-sm">
                <h3 className="font-semibold text-lg flex items-center gap-2 mb-2">
                  <Cookie className="h-5 w-5 text-brand-pink" /> Marketing
                </h3>
                <p className="text-sm text-muted-foreground">
                  Utilizados para rastrear o comportamento dos visitantes em diferentes sites. A intenção é exibir anúncios que sejam relevantes e engajadores para o usuário individual, além de medir o retorno de nossas campanhas (ex: Meta Pixel).
                </p>
              </div>
            </div>
          </section>

          <section className="bg-muted/50 border rounded-2xl p-6 md:p-8">
            <h2 className="text-2xl font-semibold mt-0 mb-4">Seus direitos (LGPD)</h2>
            <p>
              Em conformidade com a Lei Geral de Proteção de Dados (LGPD), você tem total controle sobre seus dados e privacidade. 
              Você tem o direito de:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-4">
              <li>Saber quais cookies estamos utilizando e para qual finalidade.</li>
              <li>Aceitar ou recusar o uso de cookies opcionais (Estatísticas e Marketing) a qualquer momento.</li>
              <li>Alterar suas preferências no futuro.</li>
            </ul>
            
            <div className="mt-8 p-4 bg-background border rounded-lg flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h4 className="font-semibold">Gerenciar Preferências</h4>
                <p className="text-sm text-muted-foreground">
                  Você pode atualizar suas escolhas de cookies a qualquer instante.
                </p>
              </div>
              {/* Note: In a real implementation, this button would trigger the modal from the CookieConsent component.
                  We can do this by dispatching a custom event, or relying on the footer link. */}
              <CookieSettingsButton />
            </div>
          </section>
        </div>
      </main>

      <footer className="border-t bg-white dark:bg-card py-8 text-center text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} EventFlow. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
}
