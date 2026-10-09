# Ingresso Event Flow — tarefas

Fonte: solicitação e capturas do usuário, 07/10/2026. Direção visual: funcionalista, preservando a identidade roxa do ingresso.

- [x] **1. Limpar os selos do e-mail**: remover os selos verdes do cabeçalho e do cartão; preservar as mensagens úteis sobre QR e acesso. _Modifica: template de confirmação de compra e transferência._
- [x] **2. Corrigir o PDF**: adaptar título, setor, participante e local aos limites do cartão; colocar o estado do ingresso de forma discreta no canto inferior direito, sem visto. _Modifica: renderização SVG/PDF existente._
- [x] **3. Baixar direto do e-mail**: fazer o botão de PDF da transferência abrir um PDF autorizado para o destinatário, com resposta `attachment`. _Modifica: notificação, rota e serviço de ingresso._
- [x] **4. Ajustar modo escuro do e-mail**: fixar cores de texto, superfícies e bordas compatíveis com clientes de e-mail em tema escuro. _Modifica: template de e-mail existente._
- [x] **5. Verificar**: testar template, geração de PDF, autorização de download e inspeção visual das saídas. _Reutiliza: testes e ferramentas do projeto._
