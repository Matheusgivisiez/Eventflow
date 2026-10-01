# Event Flow

Event Flow é uma plataforma SaaS multi-tenant para venda de ingressos online, eventos, checkout, pagamentos, QR Code, check-in, financeiro, CRM, marketplace e operação enterprise para organizadores.

## Stack

- Web: Next.js 15, React, TypeScript, Tailwind CSS, Shadcn/UI, React Hook Form, Zod, React Query e Zustand.
- API: NestJS, Prisma ORM, PostgreSQL, Redis, RabbitMQ, JWT, Swagger e Docker.
- Mobile: React Native/Expo com SQLite para check-in offline.
- Infra: Docker Compose, Kubernetes manifests, GitHub Actions, Prometheus, Grafana e Loki.

## Serviços externos em uso

Serviços confirmados no ambiente atual:

- **Vercel** — hospedagem do frontend `eventflow-web`: https://eventflowtickets.com.br
- **Render** — hospedagem da API NestJS `eventflow-api-staging`: https://api.eventflowtickets.com.br
- **Neon** — PostgreSQL do projeto `eventflow-staging`.
- **Cloudflare R2** — armazenamento de banners, logos e imagens públicas de eventos.
- **AbacatePay** — checkout, pagamentos PIX e webhooks de pagamento.

Redis e RabbitMQ fazem parte da arquitetura da API e são executados pelo Docker Compose no ambiente local. As instâncias externas desses serviços são configuradas por variáveis de ambiente e não devem ter credenciais registradas neste arquivo.

## Como rodar

```bash
cp .env.example .env
docker compose up -d postgres redis rabbitmq
pnpm install
pnpm --filter @eventflow/api prisma:generate
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

- Admin: admin@eventflow.local / EventFlow@123
- Organizador: organizador@eventflow.local / EventFlow@123

## Maturidade do produto

A matriz completa está em [docs/product-maturity.md](./docs/product-maturity.md). Resumo atual:

- Pronto para validação local/staging: autenticação, eventos/lotes, checkout com reserva atômica, webhook de pagamento, QR/check-in e permissões enterprise.
- Parcial: financeiro, white-label, mobile offline, afiliados, CRM/marketing, analytics, API pública, seat maps, marketplace, segurança operacional e observabilidade.
- Planejado/protótipo: IA enterprise, SDK público completo e infraestrutura multi-região.

## Módulos principais

- Autenticação com JWT, refresh token e recuperação de senha.
- Dashboard com KPIs, resumo financeiro e gráficos.
- Eventos com status, localização, imagens, SEO e página pública.
- Lotes de ingressos com quantidade, preço, janela de venda e limites.
- Checkout com dados pessoais, resumo, PIX/cartão e confirmação.
- Pagamentos com status e adapter preparado para Mercado Pago.
- QR Code por ingresso com UUID, hash e validação.
- Check-in em tempo real via API.
- Financeiro com saldo, taxas, extrato e solicitação de saque.
- Perfil da empresa e administração.
- White label, domínio próprio, tema e emails personalizados.
- Mobile Android/iOS com check-in offline e sincronização.
- Afiliados, CRM, campanhas, automação e marketing.
- Analytics, origem de vendas, dispositivos, campanhas, GA e Meta Pixel.
- API pública, API keys, OAuth, SDK e documentação.
- Mapa de assentos, reservas, bloqueios temporários e compra.
- Marketplace com organizadores verificados, busca, favoritos e avaliações.
- IA para previsão de vendas, lotes, preço, comportamento e fraude.
- Segurança enterprise com 2FA, LGPD, auditoria, backups e permissões.
- Infraestrutura para alta disponibilidade e escalabilidade horizontal.

Os itens acima descrevem o escopo do produto. Para saber o que está pronto, parcial ou planejado, consulte a matriz de maturidade.

## Documentação técnica

A documentação completa está em [docs/index.md](./docs/index.md).

- [Arquitetura](./docs/architecture.md)
- [Banco de dados](./docs/database.md)
- [API Reference](./docs/api-reference.md)
- [Segurança e LGPD](./docs/security-lgpd.md)
- [Infraestrutura e deploy](./docs/infrastructure-deploy.md)
- [Observabilidade](./docs/observability.md)
- [Testes e qualidade](./docs/testing-quality.md)
- [Frontend e mobile](./docs/frontend-mobile.md)
- [Runbooks operacionais](./docs/operations-runbooks.md)
- [Governança técnica](./docs/technical-governance.md)
- [Maturidade do produto](./docs/product-maturity.md)
