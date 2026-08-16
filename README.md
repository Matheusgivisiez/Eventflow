# EventHub

EventHub e uma plataforma SaaS multi-tenant para venda de ingressos online, eventos, checkout, pagamentos, QR Code, check-in, financeiro, CRM, marketplace e operacao enterprise para organizadores.

## Stack

- Web: Next.js 15, React, TypeScript, Tailwind CSS, Shadcn/UI, React Hook Form, Zod, React Query e Zustand.
- API: NestJS, Prisma ORM, PostgreSQL, Redis, RabbitMQ, JWT, Swagger e Docker.
- Mobile: React Native/Expo com SQLite para check-in offline.
- Infra: Docker Compose, Kubernetes manifests, GitHub Actions, Prometheus, Grafana e Loki.

## Como rodar

```bash
cp .env.example .env
docker compose up -d postgres redis rabbitmq
pnpm install
pnpm --filter @eventhub/api prisma:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Web: http://localhost:3000
API: http://localhost:3001/api
Swagger: http://localhost:3001/docs
Prometheus: http://localhost:9090
Grafana: http://localhost:3002
RabbitMQ: http://localhost:15672

Credenciais seed:

- Admin: admin@eventhub.local / EventHub@123
- Organizador: organizador@eventhub.local / EventHub@123

## Maturidade do produto

A matriz completa esta em [docs/product-maturity.md](./docs/product-maturity.md). Resumo atual:

- Pronto para validacao local/staging: autenticacao, eventos/lotes, checkout com reserva atomica, webhook de pagamento, QR/check-in e permissoes enterprise.
- Parcial: financeiro, white-label, mobile offline, afiliados, CRM/marketing, analytics, API publica, seat maps, marketplace, seguranca operacional e observabilidade.
- Planejado/prototipo: IA enterprise, SDK publico completo e infraestrutura multi-regiao.

## Modulos principais

- Autenticacao com JWT, refresh token e recuperacao de senha.
- Dashboard com KPIs, resumo financeiro e graficos.
- Eventos com status, localizacao, imagens, SEO e pagina publica.
- Lotes de ingressos com quantidade, preco, janela de venda e limites.
- Checkout com dados pessoais, resumo, PIX/cartao e confirmacao.
- Pagamentos com status e adapter preparado para Mercado Pago.
- QR Code por ingresso com UUID, hash e validacao.
- Check-in em tempo real via API.
- Financeiro com saldo, taxas, extrato e solicitacao de saque.
- Perfil da empresa e administracao.
- White label, dominio proprio, tema e emails personalizados.
- Mobile Android/iOS com check-in offline e sincronizacao.
- Afiliados, CRM, campanhas, automacao e marketing.
- Analytics, origem de vendas, dispositivos, campanhas, GA e Meta Pixel.
- API publica, API keys, OAuth, SDK e documentacao.
- Mapa de assentos, reservas, bloqueios temporarios e compra.
- Marketplace com organizadores verificados, busca, favoritos e avaliacoes.
- IA para previsao de vendas, lotes, preco, comportamento e fraude.
- Seguranca enterprise com 2FA, LGPD, auditoria, backups e permissoes.
- Infraestrutura para alta disponibilidade e escalabilidade horizontal.

Os itens acima descrevem o escopo do produto. Para saber o que esta pronto, parcial ou planejado, consulte a matriz de maturidade.

## Documentacao tecnica

A documentacao completa esta em [docs/index.md](./docs/index.md).

- [Arquitetura](./docs/architecture.md)
- [Banco de dados](./docs/database.md)
- [API Reference](./docs/api-reference.md)
- [Seguranca e LGPD](./docs/security-lgpd.md)
- [Infraestrutura e deploy](./docs/infrastructure-deploy.md)
- [Observabilidade](./docs/observability.md)
- [Testes e qualidade](./docs/testing-quality.md)
- [Frontend e mobile](./docs/frontend-mobile.md)
- [Runbooks operacionais](./docs/operations-runbooks.md)
- [Governanca tecnica](./docs/technical-governance.md)
- [Maturidade do produto](./docs/product-maturity.md)
