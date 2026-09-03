# Brief de design: Novo evento

## Objetivo

Reorganizar o fluxo de criação de evento para reduzir confusão, melhorar a leitura visual e permitir que o produtor configure data, local, categoria e lotes com mais segurança.

## Escopo

- Fluxo atual em `apps/web/app/(dashboard)/events/new/page.tsx`.
- As etapas atuais são: Dados e local, Lote inicial e Regras.
- O fluxo deve continuar permitindo salvar como rascunho ou publicar.
- O backend já aceita os dados básicos do evento e um `firstTicket`; a evolução para múltiplos lotes precisa ser compatível com a gestão de ingressos existente.

## Direção de experiência

- Separar visualmente informações do evento, programação e local.
- Substituir o campo genérico de `datetime-local` por uma seleção clara de data e horário para início e fim.
- Mostrar resumo contextual e estados de preenchimento, erro, carregamento e sucesso.
- Manter o preenchimento de CEP assistido, com possibilidade de edição manual quando o serviço não encontrar o endereço.
- Usar categorias pré-definidas, com `Outro` revelando um campo complementar.
- Tornar lotes compreensíveis: período de venda, quantidade, preço e limite por compra; permitir preço derivado por percentual quando fizer sentido.

## Categorias iniciais

Usar Palestra, Teatro, Shows e Jogos como opções visíveis, além de Outro. O termo “posterior” citado no briefing parece ambíguo e deve ser confirmado antes de virar uma categoria persistida.

## Restrições e riscos

- Datas devem continuar sendo futuras e o fim posterior ao início.
- Eventos presenciais exigem CEP, cidade, estado, endereço e número; eventos online exigem URL.
- A consulta ViaCEP é externa e deve ter loading, erro, cancelamento e fallback manual.
- A criação atual envia apenas um lote inicial; a criação de múltiplos lotes pode exigir contrato de API, modelo e regras de ativação.
- Alterar categoria para enum rígido impacta filtros, cards, detalhes e edição de eventos existentes; uma migração ou compatibilidade com valores legados deve ser planejada.

