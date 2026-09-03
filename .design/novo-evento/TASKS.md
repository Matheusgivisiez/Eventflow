# Build Tasks: Novo evento

Generated from: `.design/novo-evento/DESIGN_BRIEF.md`
Date: 2026-09-03

## Foundation

- [ ] **Extrair o fluxo em componentes por etapa**: separar o monólito de `apps/web/app/(dashboard)/events/new/page.tsx` em componentes para cabeçalho/stepper, dados do evento, programação, local, lote e regras, preservando o comportamento atual. _Modifica: `page.tsx`; novos componentes em `apps/web/components/events/new-event/`._
- [ ] **Definir estados e contrato do formulário**: centralizar tipos, valores padrão, mensagens de validação e transformação para API, incluindo compatibilidade com categoria livre legada e com o `firstTicket` atual. _Modifica: schema e mutation de `page.tsx`; reutiliza React Hook Form e Zod._

## Core UI

- [ ] **Redesenhar a etapa Dados do evento**: organizar nome, descrição, banner, formato e categoria em blocos com hierarquia clara, mantendo a prévia lateral e os estados de erro. _Modifica: campos atuais de `page.tsx`; reutiliza `Card`, `Input`, `Label` e `ImageUpload`._
- [x] **Criar seletor de categoria com opção Outro**: trocar o `Input` livre por opções Palestra, Teatro, Shows, Jogos e Outro; ao escolher Outro, exibir campo complementar, validar seu preenchimento e enviar o valor final correto para a API. _Novo componente; modifica schema e consumidores de categoria em listagem/edição se o contrato deixar de ser livre._
- [x] **Criar bloco de programação com calendário legível**: substituir os dois `datetime-local` genéricos por seleção separada de data e horário para início e fim, com calendário visual, indicação do fuso/locale, resumo formatado e validações de data futura e fim posterior. _Novo componente; modifica schema e serialização de `startsAt`/`endsAt`._
- [x] **Reorganizar local presencial**: apresentar CEP primeiro e agrupar endereço, número, bairro, cidade e estado em uma composição visual consistente; indicar campos preenchidos automaticamente e permitir edição manual. _Modifica: campos de local de `page.tsx`; reutiliza a integração ViaCEP existente._
- [x] **Melhorar a busca de CEP**: adicionar debounce ou disparo controlado ao completar oito dígitos, loading no campo, tratamento de CEP inválido/indisponibilidade, cancelamento de request e foco no número apenas quando a busca tiver sucesso. _Modifica: efeito ViaCEP e estados de `page.tsx`; cobertura de teste do comportamento._

## Lotes e regras

- [x] **Evoluir o Lote inicial para configuração comercial clara**: separar nome, preço, quantidade total, limite por compra e período de venda; mostrar uma prévia do lote e explicar como estoque e janela de vendas funcionam. _Modifica: etapa Lote inicial; depende do bloco de programação para limites de data._
- [x] **Adicionar criação de múltiplos lotes**: permitir adicionar, editar, duplicar e remover Lote 2+ antes de salvar, com ordenação e resumo de cada fase. _Novo componente; depende do contrato da API de tickets/lotes e da tela existente `/events/[id]/tickets`._
- [x] **Adicionar critérios de encerramento de lote**: oferecer encerramento por data, por quantidade vendida ou por ambos, deixando explícito qual condição ocorrer primeiro; validar que as fases não se sobreponham e que o estoque total seja coerente. _Modifica modelo do formulário e regras; requer decisão/implementação de domínio na API._
- [x] **Adicionar preço por regra opcional**: permitir preço fixo ou cálculo relativo ao lote anterior por percentual, exibindo o preço resultante e permitindo revisão antes de salvar. _Novo componente; depende da modelagem de preço do backend._
- [ ] **Atualizar contrato backend e persistência de lotes**: suportar múltiplos lotes, janela/critério de ativação e preço derivado de forma transacional, sem quebrar eventos que já têm `ticketTypes`. _Modifica: DTO, service, repository e schema Prisma relacionados a eventos/ticket types; inclui migração e testes._

## Interactions & States

- [x] **Refinar navegação entre etapas**: bloquear avanço quando a etapa estiver inválida, preservar dados ao voltar, indicar progresso e levar o usuário ao primeiro campo com erro. _Modifica stepper e `nextStep`; cobre teclado e foco._
- [ ] **Completar estados de salvamento e recuperação**: mostrar loading, erro de API, confirmação de sucesso e evitar duplo envio; validar rascunho sem exigir dados de publicação quando essa for a regra de negócio. _Modifica mutation e regras de `page.tsx`; adiciona testes._
- [x] **Adicionar resumo final de revisão**: exibir data/hora de início e fim, formato/local, categoria e todos os lotes com preço/critério antes de salvar ou publicar. _Modifica sidebar de publicação._

## Responsive & Polish

- [x] **Passar o fluxo para mobile e tablet**: transformar o resumo lateral em bloco reordenado, manter calendário e campos de endereço utilizáveis em telas estreitas e garantir que ações permaneçam acessíveis. _Modifica layout responsivo da página e componentes novos._
- [x] **Acessibilidade e consistência visual**: labels associados, navegação por teclado no calendário e seletor, mensagens anunciadas, contraste, estados disabled/loading e formatação brasileira de datas, horários, CEP e moeda. _Reutiliza tokens e componentes UI existentes; cria testes de interação quando aplicável._

## Review

- [ ] **Revisar a primeira fatia visual**: validar Dados do evento + programação em desktop e mobile antes de avançar para lotes.
- [ ] **Rodar testes e lint do web**: executar os testes relevantes e `pnpm --filter @eventflow/web lint` após cada fatia integrada.
- [ ] **Design review do fluxo completo**: conferir hierarquia, clareza, estados, responsividade e compatibilidade com criação, edição, checkout e filtros públicos.
