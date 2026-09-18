import { Metadata } from "next";
import Link from "next/link";
import {
  Lock,
  Building2,
  Database,
  Target,
  Share2,
  Clock,
  ShieldCheck,
  UserCheck,
  Mail,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Política de Privacidade | Event Flow",
  description: "Como a Event Flow coleta, usa e protege os dados pessoais de organizadores e compradores de ingressos.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 w-full border-b bg-white/95 dark:bg-card/95 backdrop-blur shadow-sm h-16 flex items-center px-4 md:px-8">
        <Link href="/" className="font-bold text-xl flex items-center gap-2 text-primary hover:opacity-80 transition-opacity">
          <div className="h-8 w-8 rounded-lg brand-gradient flex items-center justify-center text-white">
            EH
          </div>
          Event Flow
        </Link>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-12 md:py-20">
        <div className="mb-10 text-center space-y-4">
          <div className="mx-auto bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center text-primary mb-6">
            <Lock className="h-8 w-8" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight">Política de Privacidade</h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Última atualização: {new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
          </p>
        </div>

        <div className="prose prose-slate dark:prose-invert max-w-none space-y-8">
          <section className="bg-card border rounded-2xl p-6 md:p-8 shadow-sm">
            <h2 className="flex items-center gap-2 text-2xl font-semibold mt-0 mb-4">
              <Building2 className="text-primary h-6 w-6" /> 1. Quem trata os seus dados
            </h2>
            <p>
              Esta Política se aplica ao tratamento de dados pessoais realizado pela Event Flow,
              operada por <strong>MATHEUS GIVISIEZ NALON</strong>, inscrito no CNPJ nº{" "}
              <strong>69.109.143/0001-32</strong>, com sede em Ipatinga, Minas Gerais
              (&quot;controlador&quot;, &quot;nós&quot;), em conformidade com a Lei Geral de Proteção de Dados
              (Lei nº 13.709/2018 &mdash; LGPD).
            </p>
          </section>

          <section className="bg-card border rounded-2xl p-6 md:p-8 shadow-sm">
            <h2 className="flex items-center gap-2 text-2xl font-semibold mt-0 mb-4">
              <Database className="text-primary h-6 w-6" /> 2. Quais dados coletamos
            </h2>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="bg-muted/50 border rounded-xl p-5">
                <h3 className="font-semibold text-lg mb-2">Cadastro e compra</h3>
                <p className="text-sm text-muted-foreground">
                  Nome completo, e-mail, telefone e, quando aplicável, CPF, usados para identificar
                  o Comprador e emitir o ingresso em seu nome.
                </p>
              </div>
              <div className="bg-muted/50 border rounded-xl p-5">
                <h3 className="font-semibold text-lg mb-2">Pagamento</h3>
                <p className="text-sm text-muted-foreground">
                  Dados de pagamento são inseridos e processados diretamente pelo nosso parceiro de
                  pagamentos (InfinitePay). A Event Flow não armazena o número completo do cartão.
                </p>
              </div>
              <div className="bg-muted/50 border rounded-xl p-5">
                <h3 className="font-semibold text-lg mb-2">Ingresso e check-in</h3>
                <p className="text-sm text-muted-foreground">
                  Código do ingresso (QR Code), status de uso e histórico de transferências entre
                  Compradores.
                </p>
              </div>
              <div className="bg-muted/50 border rounded-xl p-5">
                <h3 className="font-semibold text-lg mb-2">Navegação</h3>
                <p className="text-sm text-muted-foreground">
                  Dados coletados por cookies (endereço IP, dispositivo, páginas visitadas),
                  detalhados na nossa{" "}
                  <Link href="/politica-de-cookies" className="text-primary underline">
                    Política de Cookies
                  </Link>
                  .
                </p>
              </div>
            </div>
          </section>

          <section className="bg-card border rounded-2xl p-6 md:p-8 shadow-sm">
            <h2 className="flex items-center gap-2 text-2xl font-semibold mt-0 mb-4">
              <Target className="text-primary h-6 w-6" /> 3. Para que usamos os seus dados
            </h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>processar a compra e o pagamento do ingresso;</li>
              <li>emitir, entregar e validar o ingresso digital (QR Code) na entrada do evento;</li>
              <li>enviar comunicações transacionais sobre a compra (confirmação, ingresso, transferência);</li>
              <li>prestar suporte e atender solicitações do titular dos dados;</li>
              <li>prevenir fraudes e garantir a segurança da plataforma;</li>
              <li>cumprir obrigações legais, fiscais e regulatórias.</li>
            </ul>
          </section>

          <section className="bg-card border rounded-2xl p-6 md:p-8 shadow-sm">
            <h2 className="flex items-center gap-2 text-2xl font-semibold mt-0 mb-4">
              <Share2 className="text-primary h-6 w-6" /> 4. Com quem compartilhamos
            </h2>
            <p>Compartilhamos apenas os dados necessários, com:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                o <strong>Organizador</strong> do evento para o qual você comprou o ingresso, para
                fins de check-in e gestão daquele evento específico;
              </li>
              <li>
                nosso parceiro de <strong>pagamentos</strong> (InfinitePay), para processar a
                transação;
              </li>
              <li>
                nosso parceiro de <strong>envio de e-mail transacional</strong> (Brevo), para
                entregar o ingresso e comunicações da compra;
              </li>
              <li>autoridades públicas, quando exigido por lei ou ordem judicial.</li>
            </ul>
            <p>A Event Flow não vende dados pessoais a terceiros.</p>
          </section>

          <section className="bg-card border rounded-2xl p-6 md:p-8 shadow-sm">
            <h2 className="flex items-center gap-2 text-2xl font-semibold mt-0 mb-4">
              <Clock className="text-primary h-6 w-6" /> 5. Por quanto tempo guardamos os dados
            </h2>
            <p>
              Mantemos os dados pelo tempo necessário para cumprir as finalidades descritas nesta
              Política e os prazos exigidos pela legislação fiscal e civil aplicável, sendo
              eliminados ou anonimizados após esse período, salvo quando a manutenção for exigida
              ou permitida por lei.
            </p>
          </section>

          <section className="bg-card border rounded-2xl p-6 md:p-8 shadow-sm">
            <h2 className="flex items-center gap-2 text-2xl font-semibold mt-0 mb-4">
              <ShieldCheck className="text-primary h-6 w-6" /> 6. Segurança da informação
            </h2>
            <p>
              Adotamos medidas técnicas e administrativas razoáveis para proteger os dados
              pessoais contra acessos não autorizados e situações de destruição, perda, alteração,
              comunicação ou difusão indevida.
            </p>
          </section>

          <section className="bg-muted/50 border rounded-2xl p-6 md:p-8">
            <h2 className="flex items-center gap-2 text-2xl font-semibold mt-0 mb-4">
              <UserCheck className="text-primary h-6 w-6" /> 7. Seus direitos (LGPD)
            </h2>
            <p>Nos termos do art. 18 da LGPD, você pode solicitar a qualquer momento:</p>
            <ul className="list-disc pl-6 space-y-2 mt-4">
              <li>confirmação da existência de tratamento e acesso aos seus dados;</li>
              <li>correção de dados incompletos, inexatos ou desatualizados;</li>
              <li>anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desconformidade com a lei;</li>
              <li>portabilidade dos dados a outro fornecedor de serviço;</li>
              <li>informação sobre com quem compartilhamos seus dados;</li>
              <li>revogação do consentimento, quando o tratamento se basear nele.</li>
            </ul>
            <p className="mt-4">
              Para exercer qualquer desses direitos, entre em contato pelo e-mail informado na
              seção 9.
            </p>
          </section>

          <section className="bg-muted/50 border rounded-2xl p-6 md:p-8">
            <h2 className="text-2xl font-semibold mt-0 mb-4">8. Alterações desta Política</h2>
            <p>
              Podemos atualizar esta Política periodicamente. A versão vigente é sempre a publicada
              nesta página, com a respectiva data de atualização.
            </p>
          </section>

          <section className="bg-card border rounded-2xl p-6 md:p-8 shadow-sm">
            <h2 className="flex items-center gap-2 text-2xl font-semibold mt-0 mb-4">
              <Mail className="text-primary h-6 w-6" /> 9. Contato
            </h2>
            <p>
              Dúvidas ou solicitações sobre o tratamento dos seus dados pessoais podem ser
              enviadas para{" "}
              <a href="mailto:suporte@eventflowtickets.com.br" className="text-primary underline">
                suporte@eventflowtickets.com.br
              </a>
              .
            </p>
          </section>
        </div>
      </main>

      <footer className="border-t bg-white dark:bg-card py-8 text-center text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} Event Flow. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
}
