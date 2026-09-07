# Build Tasks: Check-in seguro de portaria

Generated from: auditoria de check-in e plano de melhorias
Date: 2026-09-07

## Foundation

- [x] **Janela de portaria no evento**: adicionar abertura e fechamento opcionais, com abertura padrão no início do evento para preservar eventos existentes. _Modifica: schema Prisma, DTOs e serviço de eventos._
- [x] **Validação server-side da portaria**: impedir baixa antes da abertura, após o fechamento ou em evento não publicado; registrar a recusa. _Modifica: ValidateTicketUseCase._

## Core UI

- [x] **Configuração de portaria pelo organizador**: permitir editar abertura e fechamento na página do evento, deixando explícita a diferença entre QR visível e portaria aberta. _Modifica: página de edição de evento._
- [x] **Scanner contínuo e resiliente**: manter a câmera ativa entre leituras e explicar erros de permissão/HTTPS. _Modifica: página de check-in._
- [ ] **Painel operacional**: apresentar estado da portaria, totais e histórico por status. _Modifica: página de check-in; reusa Card, Badge e Tabs._

## Interactions & States

- [ ] **Leitura segura**: aceitar QR assinado no scanner, manter busca manual autorizada e impedir repetição enquanto uma validação estiver em curso. _Modifica: API e interface de check-in._
- [x] **Transferência concorrente**: garantir que aceite e check-in não resultem em transferência de ingresso usado. _Modifica: TransfersService._

## Quality

- [ ] **Testes de regressão de portaria**: cobrir abertura, fechamento, evento não publicado, QR adulterado, duplicidade e concorrência. _Modifica: testes do check-in._
- [ ] **Testes de integração de rotas críticas**: cobrir DTOs, permissões e respostas dos fluxos de check-in e transferência. _Modifica: testes de controllers/services._
- [ ] **Homologação manual**: validar câmera em Android/Chrome, iPhone/Safari, webcam e leitor USB sob HTTPS.
