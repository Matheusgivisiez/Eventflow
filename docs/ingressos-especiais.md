# Ingressos especiais: VIP da Eventflow e cortesias do organizador

Ingressos emitidos sem venda. Existem duas origens, com a mesma mecânica e visibilidade oposta.

| | VIP da Eventflow | Cortesia do organizador |
| --- | --- | --- |
| Origem (`TicketOrigin`) | `PLATFORM_COURTESY` | `ORGANIZER_COURTESY` |
| Quem emite | Admin da plataforma, em qualquer evento | Somente o dono do evento |
| Onde | Painel admin, aba "Convidados VIP" | Página do evento, botão "Cortesias" |
| Organizador enxerga | Não, em nenhuma tela | Sim, em contagem separada das vendas |
| Nome padrão no ingresso | Convidado VIP | Cortesia |
| E-mail e PDF | Convite Premium em preto e dourado discreto | Modelo padrão em roxo |

Todo ingresso vendido tem origem `SALE`.

## O que vale para as duas origens

- O convidado recebe o ingresso por e-mail, com QR Code. Não precisa de conta: o link do e-mail abre o ingresso.
- O botão "Baixar PDF" no e-mail baixa diretamente o arquivo pela rota `GET /checkout/order/:orderId/tickets/:ticketId/pdf?accessToken=...`, sem redirecionar para o site. O token limita o acesso ao pedido e expira conforme a regra do checkout.
- A portaria valida como qualquer ingresso, com uso único.
- O ingresso é nominal: não pode ser transferido. Para trocar o titular, cancele e emita outro.
- Não há cobrança: o pedido é de valor zero, sem `Payment` e sem lançamento no extrato. Também não há reembolso.
- O estoque dos lotes não é tocado. O ingresso fica em um tipo interno (`TicketType` com origem diferente de `SALE`, inativo e sem quantidade) que não aparece como lote e que o checkout não vende.
- Só dá para cancelar o ingresso que ainda não entrou.
- Cada emissão e cancelamento fica na auditoria (`courtesy.issued`, `courtesy.canceled`), com o autor.
- Limites por requisição: 30 convidados, 10 ingressos por convidado.

## O que o organizador vê

| Número ou lista | Vendas | Cortesia dele | VIP da Eventflow |
| --- | --- | --- | --- |
| Receita, pedidos pagos, ingressos vendidos, compradores | Sim | Não | Não |
| Lotes e estoque | Sim | Não | Não |
| Participantes, exportação, check-ins, histórico da portaria | Sim | Sim | Não |
| Página "Cortesias" do evento | Não | Sim | Não |

Na tela do operador, no momento da leitura, o VIP aparece como "Entrada liberada" com o nome do tipo (por exemplo, "Convidado VIP"). Ele só não fica no histórico nem nos contadores. Como o VIP não entra na busca de participantes, a alternativa quando o QR Code não lê é digitar o código do ingresso.

## Regra para quem mexe no código

As regras de visibilidade ficam em `apps/api/src/common/utils/ticket-origin.ts`:

- `SALE_ONLY` em toda consulta de venda (receita, pedidos, vendidos, lotes).
- `ORGANIZER_VISIBLE` em toda consulta de público que o organizador acessa (participantes, check-ins).

Qualquer consulta nova do lado do organizador sobre `Order`, `Ticket`, `TicketType` ou `CheckInLog` precisa de um dos dois filtros. O teste `ticket-origin.visibility.spec.ts` cobre as telas atuais e deve ganhar um caso a cada tela nova.

## Rotas

Admin da plataforma (`ADMIN`):

- `GET /admin/courtesy/summary`: totais por evento, nas duas origens.
- `GET /admin/courtesy/events/:eventId`: lista os VIP do evento. Com `?origin=ORGANIZER_COURTESY`, lista as cortesias do organizador (só leitura).
- `POST /admin/courtesy/events/:eventId`: emite VIP.
- `POST /admin/courtesy/tickets/:ticketId/cancel`: cancela um VIP.

Dono do evento:

- `GET /events/:eventId/courtesy`
- `POST /events/:eventId/courtesy`
- `POST /events/:eventId/courtesy/:ticketId/cancel`

Corpo da emissão:

```json
{
  "guests": [{ "name": "Ana Souza", "email": "ana@exemplo.com", "quantity": 2 }],
  "label": "Convidado VIP",
  "note": "Patrocinador",
  "sendEmail": true
}
```

`label`, `note` e `sendEmail` são opcionais. Com `sendEmail: false` nenhum e-mail sai e o link de cada ingresso fica disponível na lista de quem emitiu.

## Banco

Migration `20261007170000_ticket_origin_courtesy`: cria o enum `TicketOrigin` e adiciona `origin` (padrão `SALE`) em `TicketType`, `Order` e `Ticket`, além de `Order.issuedById`. Só acrescenta colunas com valor padrão, então o código anterior continua funcionando contra o banco novo.

Migration `20261007171500_vip_ticket_granted_notification`: adiciona `VIP_TICKET_GRANTED` ao enum `NotificationEvent`. O e-mail VIP usa esse evento; vendas e cortesias do organizador continuam usando `PURCHASE_CONFIRMED`. Ambos usam a mesma chave de deduplicação por pedido e entram na rotina de retentativa.
