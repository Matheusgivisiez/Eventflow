import { Metadata } from "next";
import Link from "next/link";
import {
  FileText,
  Building2,
  ShoppingBag,
  CreditCard,
  Ticket,
  RefreshCcw,
  Users,
  ShieldAlert,
  Scale,
  Mail,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Termos de Uso | Event Flow",
  description: "Condições de uso da plataforma Event Flow para organizadores e compradores de ingressos.",
};

export default function TermsOfUsePage() {
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
            <FileText className="h-8 w-8" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight">Termos de Uso</h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Última atualização: {new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
          </p>
        </div>

        <div className="prose prose-slate dark:prose-invert max-w-none space-y-8">
          <section className="bg-card border rounded-2xl p-6 md:p-8 shadow-sm">
            <h2 className="flex items-center gap-2 text-2xl font-semibold mt-0 mb-4">
              <Building2 className="text-primary h-6 w-6" /> 1. Quem somos
            </h2>
            <p>
              A plataforma Event Flow é operada por <strong>MATHEUS GIVISIEZ NALON</strong>,
              inscrito no CNPJ sob o nº <strong>69.109.143/0001-32</strong>, com sede em
              Ipatinga, Minas Gerais, doravante denominado <strong>&quot;Event Flow&quot;</strong>.
            </p>
            <p>
              Estes Termos de Uso regulam o acesso e a utilização do site e dos aplicativos
              da Event Flow por organizadores de eventos (&quot;Organizadores&quot;) e por pessoas
              que compram ingressos (&quot;Compradores&quot;), em conjunto denominados &quot;Usuários&quot;.
              Ao criar uma conta, comprar um ingresso ou publicar um evento na plataforma,
              você concorda integralmente com estes Termos.
            </p>
          </section>

          <section className="bg-card border rounded-2xl p-6 md:p-8 shadow-sm">
            <h2 className="flex items-center gap-2 text-2xl font-semibold mt-0 mb-4">
              <ShoppingBag className="text-primary h-6 w-6" /> 2. O que é a Event Flow
            </h2>
            <p>
              A Event Flow é uma plataforma de tecnologia que <strong>intermedeia</strong> a venda
              de ingressos entre Organizadores e Compradores. A Event Flow não organiza, promove
              nem realiza os eventos anunciados na plataforma: cada evento é de responsabilidade
              exclusiva do respectivo Organizador, que é o único responsável por informações,
              horários, local, qualidade, segurança e efetiva realização do evento.
            </p>
            <p>
              À Event Flow cabem as funções de: viabilizar o cadastro do evento e dos lotes de
              ingressos, processar o pagamento por meio de parceiro especializado, emitir e
              entregar o ingresso digital (com QR Code) e disponibilizar o check-in na entrada
              do evento.
            </p>
          </section>

          <section className="bg-card border rounded-2xl p-6 md:p-8 shadow-sm">
            <h2 className="flex items-center gap-2 text-2xl font-semibold mt-0 mb-4">
              <Users className="text-primary h-6 w-6" /> 3. Cadastro e conta
            </h2>
            <p>
              É possível comprar ingressos com ou sem cadastro prévio (&quot;compra como
              convidado&quot;). Na compra como convidado, o Comprador recebe por e-mail um link
              seguro do pedido e pode, posteriormente, criar uma conta e vincular suas compras
              anteriores mediante verificação do e-mail.
            </p>
            <p>
              O Usuário é responsável pela veracidade dos dados informados no cadastro e na
              compra, e pela guarda de suas credenciais de acesso.
            </p>
          </section>

          <section className="bg-card border rounded-2xl p-6 md:p-8 shadow-sm">
            <h2 className="flex items-center gap-2 text-2xl font-semibold mt-0 mb-4">
              <CreditCard className="text-primary h-6 w-6" /> 4. Preço, taxa de serviço e pagamento
            </h2>
            <p>
              O preço de cada ingresso é definido pelo Organizador e exibido de forma clara na
              página do evento e no checkout, junto de eventuais taxas.
            </p>
            <p>
              A Event Flow cobra uma taxa de serviço de <strong>8% (oito por cento)</strong> sobre
              o valor do ingresso. Para cada evento, o Organizador escolhe se essa taxa é absorvida
              por ele ou repassada ao Comprador no checkout; não há cobrança de nenhuma outra taxa
              de processamento além dessa.
            </p>
            <p>
              Os pagamentos são processados por parceiro especializado (InfinitePay). A Event Flow
              não armazena os dados completos do cartão de pagamento do Comprador.
            </p>
          </section>

          <section className="bg-card border rounded-2xl p-6 md:p-8 shadow-sm">
            <h2 className="flex items-center gap-2 text-2xl font-semibold mt-0 mb-4">
              <Ticket className="text-primary h-6 w-6" /> 5. Entrega, transferência e uso do ingresso
            </h2>
            <p>
              Após a confirmação do pagamento, o ingresso digital com QR Code é enviado por e-mail
              ao Comprador. O acesso ao evento é validado por meio da leitura desse QR Code na
              entrada.
            </p>
            <p>
              O Comprador pode transferir um ingresso a outra pessoa pela plataforma. Enquanto a
              transferência estiver pendente de aceite, o ingresso original permanece válido; ele
              só é invalidado no momento em que o destinatário aceita a transferência.
            </p>
            <p>
              Ingressos são pessoais e intransferíveis fora dos mecanismos oferecidos pela própria
              plataforma. A Event Flow não se responsabiliza por ingressos adquiridos fora do site
              ou aplicativo oficial.
            </p>
          </section>

          <section className="bg-card border rounded-2xl p-6 md:p-8 shadow-sm">
            <h2 className="flex items-center gap-2 text-2xl font-semibold mt-0 mb-4">
              <RefreshCcw className="text-primary h-6 w-6" /> 6. Cancelamento, reembolso e alteração de evento
            </h2>
            <p>
              <strong>Direito de arrependimento:</strong> nos termos do art. 49 do Código de Defesa
              do Consumidor, o Comprador pode se arrepender da compra em até 7 (sete) dias corridos
              a contar da confirmação do pagamento, desde que o pedido seja feito antes da realização
              do evento. Nesse caso, o valor pago é integralmente reembolsado.
            </p>
            <p>
              <strong>Cancelamento ou alteração pelo Organizador:</strong> se o evento for cancelado,
              adiado ou tiver alteração relevante (data, local) por decisão do Organizador, os
              Compradores serão comunicados e terão direito ao reembolso do valor pago, conforme a
              política do respectivo evento e a legislação consumerista aplicável.
            </p>
            <p>
              Fora dessas hipóteses, a compra de ingressos não é reembolsável, salvo previsão
              específica divulgada na página do evento.
            </p>
          </section>

          <section className="bg-card border rounded-2xl p-6 md:p-8 shadow-sm">
            <h2 className="flex items-center gap-2 text-2xl font-semibold mt-0 mb-4">
              <ShieldAlert className="text-primary h-6 w-6" /> 7. Obrigações do Organizador
            </h2>
            <p>O Organizador declara e garante que:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>as informações cadastradas sobre o evento são verdadeiras, completas e atualizadas;</li>
              <li>possui todas as autorizações, alvarás e licenças necessárias à realização do evento;</li>
              <li>é o único responsável pela realização, qualidade, segurança e eventuais danos
                decorrentes do evento perante os Compradores e terceiros;</li>
              <li>é responsável por honrar a política de reembolso divulgada e por comunicar a
                Event Flow e os Compradores em caso de cancelamento ou alteração do evento.</li>
            </ul>
          </section>

          <section className="bg-card border rounded-2xl p-6 md:p-8 shadow-sm">
            <h2 className="flex items-center gap-2 text-2xl font-semibold mt-0 mb-4">
              <Scale className="text-primary h-6 w-6" /> 8. Limitação de responsabilidade
            </h2>
            <p>
              A Event Flow atua como intermediadora tecnológica e responde pelo correto
              funcionamento da plataforma, do processo de compra e da emissão do ingresso. A
              Event Flow não é responsável pela realização, qualidade, segurança, cancelamento ou
              qualquer outro aspecto do evento em si, cuja responsabilidade é exclusiva do
              Organizador, sem prejuízo da responsabilidade solidária prevista em lei quando
              aplicável.
            </p>
          </section>

          <section className="bg-muted/50 border rounded-2xl p-6 md:p-8">
            <h2 className="text-2xl font-semibold mt-0 mb-4">9. Privacidade e cookies</h2>
            <p>
              O tratamento de dados pessoais na plataforma é descrito na nossa{" "}
              <Link href="/politica-de-privacidade" className="text-primary underline">
                Política de Privacidade
              </Link>{" "}
              e o uso de cookies na nossa{" "}
              <Link href="/politica-de-cookies" className="text-primary underline">
                Política de Cookies
              </Link>
              .
            </p>
          </section>

          <section className="bg-muted/50 border rounded-2xl p-6 md:p-8">
            <h2 className="text-2xl font-semibold mt-0 mb-4">10. Alterações destes Termos</h2>
            <p>
              A Event Flow pode atualizar estes Termos periodicamente para refletir mudanças na
              plataforma ou na legislação. A versão vigente é sempre a publicada nesta página, com
              a respectiva data de atualização.
            </p>
          </section>

          <section className="bg-muted/50 border rounded-2xl p-6 md:p-8">
            <h2 className="text-2xl font-semibold mt-0 mb-4">11. Legislação aplicável e foro</h2>
            <p>
              Estes Termos são regidos pelas leis da República Federativa do Brasil. Fica eleito o
              foro da comarca de Ipatinga, Minas Gerais, para dirimir eventuais controvérsias,
              ressalvado o foro do domicílio do consumidor, quando aplicável por lei.
            </p>
          </section>

          <section className="bg-card border rounded-2xl p-6 md:p-8 shadow-sm">
            <h2 className="flex items-center gap-2 text-2xl font-semibold mt-0 mb-4">
              <Mail className="text-primary h-6 w-6" /> 12. Contato
            </h2>
            <p>
              Dúvidas sobre estes Termos podem ser enviadas para{" "}
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
