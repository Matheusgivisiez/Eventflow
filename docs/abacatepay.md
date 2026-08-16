# AbacatePay - Integracao Event Flow

> Documentacao completa da integracao com o gateway de pagamentos **AbacatePay** no Event Flow.
> API Base: `https://api.abacatepay.com/v2` · Autenticação: `Bearer Token` · Moeda: `BRL (centavos)`

---

## Índice

- [Visão Geral](#visão-geral)
- [Configuração](#configuração)
- [Fluxo de Pagamento](#fluxo-de-pagamento)
- [Fluxo de Saque](#fluxo-de-saque)
- [Webhooks](#webhooks)
- [Arquivos Modificados](#arquivos-modificados)
- [Variáveis de Ambiente](#variáveis-de-ambiente)
- [Referências da API](#referências-da-api)

---

## Visão Geral

O Event Flow utiliza o **AbacatePay** como gateway de pagamento principal (substituindo o Mercado Pago). A integracao cobre dois fluxos:

| Fluxo | Endpoint AbacatePay | Descrição |
|---|---|---|
| **Checkout de Ingressos** | `POST /products/create` + `POST /checkouts/create` | Gera página de pagamento hospedada (PIX ou Cartão) |
| **Saque de Organizadores** | `POST /pix/create` | Envia PIX para a chave do organizador após aprovação do admin |

### Diagrama de Fluxo

```
COMPRA DE INGRESSO
─────────────────
Cliente -> Event Flow -> POST /payments/orders/:id/preference
                          ↓
                   AbacatePay cria Produto
                          ↓
                   AbacatePay cria Checkout
                          ↓
              Retorna `checkoutUrl` para redirect
                          ↓
              Cliente paga no AbacatePay
                          ↓
              POST /webhooks/abacatepay  ← AbacatePay notifica
                          ↓
              Ingressos gerados automaticamente


SAQUE DO ORGANIZADOR
────────────────────
Organizador → POST /finance/withdrawals (solicita)
                    ↓
             Status: REQUESTED (aguardando admin)
                    ↓
Admin → POST /finance/withdrawals/:id/approve + pixKey
                    ↓
         AbacatePay POST /pix/create
                    ↓
         Status: APPROVED + paidAt registrado
```

---

## Configuração

### 1. Variáveis de Ambiente

Edite o arquivo `.env` na raiz de `apps/api`:

```bash
ABACATE_API_KEY="sk_live_xxxxxxxxxxxxxxxxxxxx"
ABACATE_WEBHOOK_SECRET="webhook-secret-configurado-no-dashboard"
ABACATE_BASE_URL="https://api.abacatepay.com/v2"
ABACATE_ENVIRONMENT="production"
```

> ⚠️ **Nunca commite as chaves reais.** Use um gerenciador de segredos em produção.

### 2. Obtenha suas credenciais

1. Acesse [app.abacatepay.com](https://app.abacatepay.com)
2. Vá em **Configurações → API Keys**
3. Gere uma nova API Key e copie para `ABACATE_API_KEY`
4. Para Webhooks: vá em **Configurações → Webhooks**, registre a URL e copie o `secret`

---

## Fluxo de Pagamento

### Etapa 1 — Criar preferência de pagamento

```http
POST /api/payments/orders/:orderId/preference
Authorization: Bearer <jwt_token>
```

**O que acontece internamente:**

1. O `PaymentsService` busca o pedido no banco de dados
2. O `AbacatePayGateway.createCheckout()` é chamado:
   - **Cria o produto** (`POST /products/create`) com `externalId = orderId`
   - **Cria o checkout** (`POST /checkouts/create`) com dados do comprador e URLs de retorno
3. O `providerRef` (ID do checkout AbacatePay) é salvo no `Payment`
4. A `checkoutUrl` é retornada ao frontend para redirect

**Resposta:**

```json
{
  "provider": "abacate_pay",
  "providerRef": "chk_abc123",
  "checkoutUrl": "https://pay.abacatepay.com/checkout/chk_abc123"
}
```

### Etapa 2 — Cliente realiza o pagamento

O cliente é redirecionado para a página do AbacatePay e paga via PIX ou Cartão.

### Etapa 3 — Webhook confirma pagamento

O AbacatePay envia um `POST` para `/api/webhooks/abacatepay?webhookSecret=<secret>` quando o pagamento é confirmado. A rota legada `/api/webhooks/abacate-pay` continua aceita por compatibilidade.

---

## Fluxo de Saque

### Etapa 1 — Organizador solicita saque

```http
POST /api/finance/withdrawals
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "amountCents": 5000
}
```

> Valor mínimo: **R$ 3,50** (`amountCents >= 350`)  
> Status inicial: `REQUESTED`

### Etapa 2 — Admin lista saques pendentes

Na interface de **Administração → Aba "Saques"**, o admin visualiza todos os saques com status `REQUESTED`.

Ou via API:

```http
GET /api/finance/withdrawals
Authorization: Bearer <jwt_token_admin>
```

### Etapa 3 — Admin aprova e informa a chave PIX

```http
POST /api/finance/withdrawals/:id/approve
Authorization: Bearer <jwt_token_admin>
Content-Type: application/json

{
  "pixKey": "organizer@email.com"
}
```

**O que acontece internamente:**

1. Valida que o saque existe e está com status `REQUESTED`
2. Chama `AbacatePayGateway.createPixTransfer()` → `POST /pix/create`
3. Atualiza status para `APPROVED` e registra `paidAt`

> 🔑 **Tipos de chave PIX aceitos:** CPF, CNPJ, e-mail, telefone, chave aleatória

---

## Webhooks

### Configuração no AbacatePay

Registre a seguinte URL no painel do AbacatePay:

```
https://seu-dominio.com/api/webhooks/abacatepay?webhookSecret=SEU_SECRET
```

Eventos que devem ser habilitados:

| Evento | Acao no Event Flow |
|---|---|
| `checkout.completed` | Pagamento → `PAID`, ingressos emitidos |
| `checkout.refunded` | Pagamento → `REFUNDED`, ingressos cancelados |
| `checkout.disputed` | Pagamento → `CANCELED` |
| `checkout.lost` | Pagamento → `CANCELED` |

### Validação de Segurança

O endpoint valida o `webhookSecret` na query string (tambem aceita `x-webhook-secret` por compatibilidade) e a assinatura HMAC-SHA256 no header `X-Webhook-Signature`, calculada sobre o corpo raw do webhook conforme a documentacao oficial da AbacatePay.

Se o secret ou a assinatura estiver ausente/incorreto, a requisicao e rejeitada com `401 Unauthorized`. Cada evento tambem e gravado em `PaymentLog` por `provider + providerEventId`, impedindo processamento duplicado em retentativas.

### Payload de exemplo (checkout.completed)

```json
{
  "event": "checkout.completed",
  "id": "chk_abc123",
  "metadata": {
    "orderId": "order_xyz789"
  },
  "status": "PAID"
}
```

### Teste local com ngrok

```bash
# Exponha sua API local
ngrok http 3001

# Use a URL gerada no painel do AbacatePay:
# https://abc123.ngrok.io/api/webhooks/abacatepay?webhookSecret=SEU_SECRET
```

---

## Arquivos Modificados

```
apps/api/src/
├── config/
│   └── env.schema.ts              ← Adicionadas variaveis ABACATE_*
├── modules/
│   ├── payments/
│   │   ├── abacate-pay.gateway.ts ← 🆕 Gateway principal do AbacatePay
│   │   ├── payments.module.ts     ← Substituído MercadoPagoGateway por AbacatePayGateway
│   │   └── payments.service.ts    ← createProviderPreference usa AbacatePay
│   ├── finance/
│   │   ├── dto/
│   │   │   └── approve-withdrawal.dto.ts ← 🆕 DTO para aprovação de saques
│   │   ├── finance.controller.ts  ← Novos endpoints: GET /withdrawals, POST /withdrawals/:id/approve
│   │   ├── finance.module.ts      ← Importa PaymentsModule (para AbacatePayGateway)
│   │   └── finance.service.ts     ← approveWithdrawal dispara PIX via AbacatePay
│   └── webhooks/
│       ├── webhooks.controller.ts ← 🆕 POST /webhooks/abacatepay
│       └── webhooks.service.ts    ← Mapeamento de eventos checkout.completed, etc.
apps/api/.env                      ← ABACATE_API_KEY e ABACATE_WEBHOOK_SECRET

apps/web/src/
└── app/(dashboard)/admin/
    └── page.tsx                   ← 🆕 Aba "Saques" com aprovação por PIX
```

> 🗑️ O arquivo `mercado-pago.gateway.ts` pode ser deletado — não é mais utilizado.

---

## Variáveis de Ambiente

| Variável | Obrigatória | Descrição |
|---|---|---|
| `ABACATE_API_KEY` | ✅ Sim | Chave de API do AbacatePay (`sk_live_...`). `ABACATEPAY_API_KEY` segue aceito por compatibilidade. |
| `ABACATE_WEBHOOK_SECRET` | ✅ Sim | Secret usado na query `webhookSecret`. `ABACATEPAY_WEBHOOK_SECRET` segue aceito por compatibilidade. |
| `ABACATE_BASE_URL` | ✅ Sim | URL base da API, padrao `https://api.abacatepay.com/v2`. |
| `ABACATE_ENVIRONMENT` | ✅ Sim | `sandbox` ou `production`. |
| `ABACATE_PUBLIC_KEY` | Opcional | Chave publica HMAC da AbacatePay. Se ausente, usa a chave publica documentada pela AbacatePay. |
| `APP_URL` | ✅ Sim | URL base do frontend (usado nas `returnUrl` e `completionUrl`) |

---

## Referências da API

| Endpoint | Método | Uso |
|---|---|---|
| `/products/create` | POST | Cria produto (precede o checkout) |
| `/checkouts/create` | POST | Gera página de pagamento hospedada |
| `/pix/create` | POST | Envia transferência PIX para terceiros |
| `/checkouts/list` | GET | Lista checkouts (diagnóstico) |
| `/pix/get` | GET | Consulta status de uma transferência PIX |

Documentação oficial: [docs.abacatepay.com](https://docs.abacatepay.com)  
Referência LLM: [abacatepay.com/llms.txt](https://www.abacatepay.com/llms.txt)
