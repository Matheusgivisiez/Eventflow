# Brief: validação de SMTP no boot e no /api/health

## Contexto

Em 13/09/2026 uma compra real de teste em produção falhou no envio do e-mail de
confirmação. A linha em `NotificationLog` ficou:

```
status:    FAILED
attempts:  2
lastError: getaddrinfo ENOTFOUND placeholder.smtp.local
```

A causa é de configuração: `SMTP_HOST` no Render está com o valor de exemplo
`placeholder.smtp.local`, um host que não resolve. Isso será corrigido no painel
do Render e **não faz parte deste brief**.

O que este brief corrige é o motivo de ninguém ter percebido antes:

1. A validação de produção em `env.schema.ts` exige que as variáveis de SMTP
   **existam**, não que sejam plausíveis. Um placeholder passa, a API sobe
   normalmente e a entrega falha em silêncio.
2. Não há forma de checar o estado do e-mail sem fazer uma compra de teste.

## Correção 1 — recusar valores de placeholder em produção

**Arquivo:** `apps/api/src/config/env.schema.ts`

Dentro do `superRefine` que já existe (ele faz `return` cedo quando
`NODE_ENV !== "production"`, então nada disso afeta desenvolvimento), logo após o
laço que percorre `productionMailKeys`, adicionar uma checagem de plausibilidade.

Rejeitar quando `SMTP_HOST` ou o domínio de `SMTP_FROM`:

- contiverem `placeholder`, `change-me`, `changeme`, `example.com`, `example.org`;
- terminarem em `.local`, `.localhost`, `.invalid`, `.test`, `.example`;
- `SMTP_HOST` for `localhost` ou `127.0.0.1`.

A mensagem do erro deve nomear a variável e o valor recusado, para o operador
entender no log de deploy. Exemplo:

```
SMTP_HOST looks like a placeholder in production: "placeholder.smtp.local".
Set a real SMTP host.
```

Usar `ctx.addIssue` com `path: ["SMTP_HOST"]`, no mesmo formato dos erros que já
existem no arquivo.

## Correção 2 — expor o estado do e-mail no /api/health

**Arquivos:** `apps/api/src/common/services/mail.service.ts` e
`apps/api/src/app.controller.ts`

Adicionar `MailService.checkTransport()` que:

- devolve `{ configured: false }` quando `SMTP_HOST` ou `SMTP_FROM` estiverem
  vazios, sem tentar conexão;
- caso contrário chama `transporter.verify()` do nodemailer dentro de
  `try/catch` e devolve `{ configured: true, reachable: boolean, error?: string }`;
- **nunca lança**;
- guarda o resultado em cache por 60 segundos, para que o health check não abra
  conexão SMTP a cada requisição.

`GET /api/health` passa a devolver, de forma **aditiva**:

```json
{
  "status": "ok",
  "service": "eventflow-api",
  "mail": { "configured": true, "reachable": false, "error": "getaddrinfo ENOTFOUND ..." }
}
```

### Restrições que não podem ser violadas

- **`/api/health` é o `healthCheckPath` do serviço no Render.** Ele precisa
  continuar respondendo **HTTP 200** com `status: "ok"` mesmo com o SMTP
  quebrado. Se o health passar a falhar por causa do e-mail, um SMTP mal
  configurado derruba a API inteira e trava o deploy. O e-mail entra como
  subcampo informativo, nunca como critério de saúde.
- Os campos `status` e `service` que já existem não mudam.
- `SMTP_PASS` e `SMTP_USER` nunca aparecem na resposta nem em log. Truncar a
  mensagem de erro em 200 caracteres.
- Não chamar `verify()` fora do cache.

## Correção 3 — aviso no boot

Em produção, se `checkTransport()` indicar `reachable: false`, registrar **um**
log de nível ERROR no start da aplicação, nomeando a variável suspeita. Um log
no deploy de hoje teria evitado toda a investigação.

## Testes obrigatórios

`apps/api/src/config/env.schema.spec.ts`

- produção + `SMTP_HOST="placeholder.smtp.local"` → lança;
- produção + `SMTP_FROM="no-reply@example.com"` → lança;
- produção + host e remetente reais → não lança;
- **desenvolvimento** + `SMTP_HOST="placeholder.smtp.local"` → **não** lança.

`apps/api/src/common/services/mail.service.spec.ts`

- `verify()` rejeitando → `{ configured: true, reachable: false }`, sem lançar;
- sem `SMTP_HOST` → `{ configured: false }` e `verify()` não é chamado;
- duas chamadas seguidas → `verify()` chamado uma vez só (cache).

Spec do controller de health

- com e-mail inacessível, a rota responde 200 e `status: "ok"`;
- a resposta não contém a senha de SMTP.

## Como rodar

```
pnpm --filter @eventflow/api prisma:generate
pnpm --filter @eventflow/api test
pnpm --filter @eventflow/api build
```

Estado atual antes desta mudança: 44 suítes, 317 testes passando.

## Fora do escopo

Definir as credenciais reais de SMTP no Render, e a autenticação de domínio
(SPF, DKIM, DMARC). São ações de configuração, não de código.
