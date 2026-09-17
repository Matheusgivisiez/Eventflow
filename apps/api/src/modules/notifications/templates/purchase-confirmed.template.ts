export type PurchaseConfirmedTemplateTicket = {
  id: string;
  attendeeName: string;
  ticketTypeName: string;
  shortCode: string;
  /** Guest-safe download link, authorized by the order's access token. */
  pdfUrl: string;
};

export type PurchaseConfirmedTemplateInput = {
  buyerName: string;
  eventTitle: string;
  eventStartsAt: Date;
  eventVenue: string;
  orderId: string;
  ticketCount: number;
  /** Secure, order-scoped link. Never a session and never the full ticket data. */
  orderUrl: string;
  createAccountUrl: string;
  qrCodeLocked: boolean;
  qrCodeReleaseAt: Date | null;
  logoLightUrl: string;
  logoDarkUrl: string;
  qrLockedImageUrl: string;
  /** Base URL for the hero/ticket-frame/icon assets, e.g. `${APP_URL}/images/email`. */
  assetsBaseUrl: string;
  tickets: PurchaseConfirmedTemplateTicket[];
};

const BRAND = "Event Flow";
const TZ = "America/Sao_Paulo";

// Deep indigo-violet, matching the background art (hero + ticket frame).
// Flat colour on purpose: a real diagonal gradient can't repeat cleanly across
// the ticket card's stacked, variable-height background slices (it produced
// visible seams), so the richness comes from the glowing border + grid frame
// image layered on top instead.
const CARD_SOLID = "#1a0f33";
const HERO_SOLID = "#150a2c";
const ACCENT_SOLID = "#b28bff";
// Saturated accent used for text/icons on white buttons - matches the
// reference mockup's "Baixar PDF" / "Criar conta" buttons.
const ACCENT_TEXT = "#5b3ff0";
const PRIMARY_BTN_GRADIENT = "linear-gradient(135deg, #2f1c66 0%, #120b2a 100%)";
const INK = "#171321";
const MUTED = "#6b647a";

/** "A1B2C3D4E5" -> "A1B2-C3D4-E5" */
function formatShortCode(code: string) {
  return code.replace(/(.{4})/g, "$1-").replace(/-$/, "");
}

export function orderCode(orderId: string) {
  return `EVF-${orderId.slice(-8).toUpperCase()}`;
}

export function formatEventDate(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: TZ
  }).format(date);
}

function formatHourMinute(date: Date) {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: TZ
  }).formatToParts(date);
  const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
  return `${hour}h${minute}`;
}

/** "24 de outubro, 21h30" */
function formatLongDayMonthTime(date: Date) {
  const day = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", timeZone: TZ }).format(date);
  const month = new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: TZ }).format(date);
  return `${day} de ${month}, ${formatHourMinute(date)}`;
}

/** "24 Out" */
function formatShortDayMonth(date: Date) {
  const day = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", timeZone: TZ }).format(date);
  const month = new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: TZ })
    .format(date)
    .replace(".", "");
  return `${day} ${month.charAt(0).toUpperCase()}${month.slice(1)}`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(value: string) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

/**
 * Purchase confirmation e-mail.
 *
 * Deliberately carries no CPF, no phone, no ticket signature and no real QR
 * payload: the message travels through servers we do not control, so the
 * QR shown here is a decorative locked placeholder (see qrLockedImageUrl).
 * The real, scannable QR only ever exists behind the order's access token
 * (orderUrl / per-ticket pdfUrl), which itself still applies the event's
 * own QR release-time lock — same reasoning big ticketing platforms use
 * (e.g. Ticketmaster's SafeTix): a static code in an inbox can be
 * forwarded or screenshotted before the buyer reaches the door.
 */
export function renderPurchaseConfirmed(input: PurchaseConfirmedTemplateInput) {
  const code = orderCode(input.orderId);
  const when = formatEventDate(input.eventStartsAt);
  const plural = input.ticketCount !== 1;
  const ticketLine = plural ? `${input.ticketCount} ingressos` : "1 ingresso";
  const possessive = plural ? "Seus ingressos" : "Seu ingresso";
  const verb = plural ? "estão prontos" : "está pronto";

  const subject = `${possessive} para ${input.eventTitle} já ${verb}!`;
  const preheader = `Pagamento aprovado. ${possessive} para ${input.eventTitle} já ${plural ? "estão disponíveis" : "está disponível"}.`;

  const text = [
    `Ola, ${input.buyerName}.`,
    "",
    `Seu pagamento foi aprovado e ${ticketLine} ja ${plural ? "estao disponiveis" : "esta disponivel"}.`,
    "",
    `Evento: ${input.eventTitle}`,
    `Local: ${input.eventVenue}`,
    `Data: ${when}`,
    `Pedido: ${code}`,
    "",
    ...input.tickets.flatMap((ticket) => [
      `- ${ticket.attendeeName} | ${ticket.ticketTypeName} | codigo ${ticket.shortCode}`,
      `  Baixar PDF: ${ticket.pdfUrl}`
    ]),
    "",
    `Ver seus ingressos: ${input.orderUrl}`,
    "",
    "O QR Code de cada ingresso so fica disponivel dentro do link acima (nao vai por e-mail, por seguranca).",
    "Este link e pessoal: quem tiver o endereco consegue ver este pedido. Nao compartilhe.",
    "",
    `Quer todos os seus ingressos em um lugar so? Crie uma conta: ${input.createAccountUrl}`,
    "",
    BRAND
  ].join("\n");

  const html = renderHtml(input, { code, when, ticketLine, possessive, verb, preheader });

  return { subject, text, html };
}

function asset(base: string, name: string) {
  return `${base.replace(/\/+$/, "")}/${name}`;
}

function infoCell(iconUrl: string, label: string, value: string) {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td width="40" valign="top"><img src="${escapeAttr(iconUrl)}" width="40" height="40" alt="" style="display:block;border:0" /></td>
        <td width="10"></td>
        <td valign="middle" style="font-family:Arial,Helvetica,sans-serif">
          <div style="font-size:11px;font-weight:700;letter-spacing:1px;color:${MUTED};text-transform:uppercase">${label}</div>
          <div style="font-size:15px;font-weight:700;color:${INK};margin-top:2px">${value}</div>
        </td>
      </tr>
    </table>`;
}

function metaPill(iconUrl: string, label: string, value: string) {
  return `
    <td width="33%" valign="top" style="padding-right:8px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.14);border-radius:12px">
        <tr>
          <td style="padding:10px 12px;font-family:Arial,Helvetica,sans-serif">
            <img src="${escapeAttr(iconUrl)}" width="16" height="16" alt="" style="display:block;border:0" />
            <div style="font-size:10px;font-weight:700;letter-spacing:1px;color:#c9c1de;text-transform:uppercase;margin-top:7px">${label}</div>
            <div style="font-size:15px;font-weight:700;color:#ffffff;margin-top:2px">${value}</div>
          </td>
        </tr>
      </table>
    </td>`;
}

function pillButton(opts: {
  href: string;
  iconUrl: string;
  label: string;
  variant: "primary" | "light";
  textColor?: string;
}) {
  const isPrimary = opts.variant === "primary";
  const bg = isPrimary
    ? `background-color:#1c1140;background:${PRIMARY_BTN_GRADIENT};`
    : "background-color:#ffffff;border:1px solid #e3ddef;";
  const color = isPrimary ? "#ffffff" : opts.textColor ?? INK;
  return `
    <a href="${escapeAttr(opts.href)}" style="display:inline-block;text-decoration:none;border-radius:13px;${bg}box-shadow:0 6px 16px rgba(20,12,45,0.16)">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding:13px 22px 13px 18px">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td valign="middle" style="padding-right:9px"><img src="${escapeAttr(opts.iconUrl)}" width="16" height="16" alt="" style="display:block;border:0" /></td>
                <td valign="middle" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;color:${color};white-space:nowrap">${escapeHtml(opts.label)}</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </a>`;
}

/**
 * Ticket card: a horizontal stub, main info on the left and a QR stub on the
 * right separated by a dashed perforation - matching the reference mockup's
 * ticket shape (not a stacked/repeating card). The two outward notches sit
 * at the card's outer left/right edges via a pair of small background
 * images positioned with `center`, so they stay vertically centred no
 * matter how tall the card ends up (long attendee names, wrapped titles).
 */
function ticketCard(
  ticket: PurchaseConfirmedTemplateTicket,
  ctx: {
    eventTitle: string;
    assetsBaseUrl: string;
    logoDarkUrl: string;
    qrLockedImageUrl: string;
    qrCodeLocked: boolean;
    qrCodeReleaseAt: Date | null;
    startsAt: Date;
    showInlineDownload: boolean;
  }
) {
  const qrCaption = ctx.qrCodeLocked && ctx.qrCodeReleaseAt
    ? `Libera em ${formatEventDate(ctx.qrCodeReleaseAt)}.`
    : "Toque em “Abrir ingresso” para ver e usar na entrada.";

  const iconWhite = (name: string) => asset(ctx.assetsBaseUrl, `icon-white-${name}.png`);

  const leftBlock = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td valign="middle"><img src="${escapeAttr(ctx.logoDarkUrl)}" width="84" alt="${BRAND}" style="display:block;border:0" /></td>
        <td valign="middle" align="right">
          <span style="display:inline-block;background-color:rgba(45,212,191,0.18);color:#8ff2d6;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;padding:6px 11px;border-radius:999px;white-space:nowrap">&#10003; Confirmado</span>
        </td>
      </tr>
    </table>

    <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:700;letter-spacing:2px;color:#b8a9e0;text-transform:uppercase;margin-top:16px">${escapeHtml(ctx.eventTitle)}</div>
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:24px;line-height:1.15;font-weight:800;color:#ffffff;margin-top:4px">${escapeHtml(ctx.eventTitle)}</div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:14px">
      <tr>
        ${metaPill(iconWhite("calendar"), "Data", formatShortDayMonth(ctx.startsAt))}
        ${metaPill(iconWhite("clock"), "Hora", formatHourMinute(ctx.startsAt))}
        ${metaPill(iconWhite("ticket"), "Setor", escapeHtml(ticket.ticketTypeName))}
      </tr>
    </table>

    <div style="border-top:1px dashed rgba(255,255,255,0.22);margin-top:18px;padding-top:14px">
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:700;letter-spacing:1px;color:#b8a9e0;text-transform:uppercase">Participante</div>
    </div>
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:800;color:#ffffff;margin-top:3px">${escapeHtml(ticket.attendeeName)}</div>`;

  // One unified white card (label + QR + code together) - matches the
  // reference mockup, where "SEU INGRESSO" and the QR live inside the same
  // rounded white surface rather than a floating label above a separate box.
  const rightBlock = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff;border-radius:16px;margin:0 auto;width:100%;max-width:176px">
      <tr>
        <td align="center" style="padding:13px 12px 2px 12px">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
            <td valign="middle" style="padding-right:5px"><img src="${escapeAttr(asset(ctx.assetsBaseUrl, "icon-dark-lock.png"))}" width="11" height="11" alt="" style="display:block;border:0" /></td>
            <td valign="middle" style="font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:800;letter-spacing:1px;color:${INK};text-transform:uppercase;white-space:nowrap">Seu ingresso</td>
          </tr></table>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding:8px 14px 14px 14px">
          <img src="${escapeAttr(ctx.qrLockedImageUrl)}" width="104" height="104" alt="QR Code protegido" style="display:block;border:0;border-radius:8px" />
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:800;letter-spacing:1px;color:${INK};margin-top:7px">${escapeHtml(formatShortCode(ticket.shortCode))}</div>
        </td>
      </tr>
    </table>
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;color:#c9c1de;margin-top:9px;line-height:1.4;text-align:center">${qrCaption}</div>
    ${ctx.showInlineDownload
      ? `<div style="text-align:center;margin-top:10px">
           <a href="${escapeAttr(ticket.pdfUrl)}" style="font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;color:#c9b8ff;text-decoration:underline">Baixar PDF deste ingresso</a>
         </div>`
      : ""}
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:9px;letter-spacing:1px;color:#8477a3;text-transform:uppercase;margin-top:14px;text-align:center;border-top:1px solid rgba(255,255,255,0.14);padding-top:10px">${BRAND}<br/>Ingressos que aproximam</div>`;

  // Background is the user's own reference art (grid mesh + glow ribbon +
  // rounded glowing border), cropped to the card's aspect and used with
  // `cover` so it holds up at any content height. The border glow it bakes
  // in already reads as the card's edge, so no separate CSS border/shadow
  // is layered on top. Two small white notch overlays punch true cutouts
  // through to the page background at the card's outer edges, vertically
  // centred regardless of height - the source art's own "notch" is just a
  // gap in its glow line, not an actual cutout, so it can't do that alone.
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:22px">
    <tr>
      <td style="background-color:${CARD_SOLID};background-image:url(${escapeAttr(asset(ctx.assetsBaseUrl, "ticket-card-bg.png"))}),url(${escapeAttr(asset(ctx.assetsBaseUrl, "ticket-notch-left.png"))}),url(${escapeAttr(asset(ctx.assetsBaseUrl, "ticket-notch-right.png"))});background-repeat:no-repeat,no-repeat,no-repeat;background-position:center,left center,right center;background-size:cover,20px 56px,20px 56px;border-radius:24px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td width="62%" valign="top" style="padding:26px 16px 24px 28px">${leftBlock}</td>
            <td width="38%" valign="top" style="padding:26px 24px 22px 16px">${rightBlock}</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>`;
}

function renderHtml(
  input: PurchaseConfirmedTemplateInput,
  ctx: { code: string; when: string; ticketLine: string; possessive: string; verb: string; preheader: string }
) {
  const iconBadge = (name: string) => asset(input.assetsBaseUrl, `icon-badge-${name}.png`);
  const iconWhite = (name: string) => asset(input.assetsBaseUrl, `icon-white-${name}.png`);
  const iconAccent = (name: string) => asset(input.assetsBaseUrl, `icon-accent-${name}.png`);
  const iconDark = (name: string) => asset(input.assetsBaseUrl, `icon-dark-${name}.png`);
  const iconAmber = (name: string) => asset(input.assetsBaseUrl, `icon-amber-${name}.png`);

  const showInlineDownload = input.ticketCount > 1;

  const cards = input.tickets
    .map((ticket) =>
      ticketCard(ticket, {
        eventTitle: input.eventTitle,
        startsAt: input.eventStartsAt,
        assetsBaseUrl: input.assetsBaseUrl,
        logoDarkUrl: input.logoDarkUrl,
        qrLockedImageUrl: input.qrLockedImageUrl,
        qrCodeLocked: input.qrCodeLocked,
        qrCodeReleaseAt: input.qrCodeReleaseAt,
        showInlineDownload
      })
    )
    .join("");

  return `
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(ctx.possessive)} já ${ctx.verb}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f2eef9">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(ctx.preheader)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f2eef9">
      <tr>
        <td align="center" style="padding:24px 16px">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background-color:#ffffff;border-radius:22px;overflow:hidden">

            <!-- Hero -->
            <tr>
              <td style="background-color:${HERO_SOLID};background-image:url(${escapeAttr(asset(input.assetsBaseUrl, "hero-bg.png"))});background-size:cover;background-position:center right;background-repeat:no-repeat;padding:32px 32px 28px 32px">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td valign="middle"><img src="${escapeAttr(input.logoDarkUrl)}" width="110" alt="${BRAND}" style="display:block;border:0" /></td>
                    <td valign="middle" align="right">
                      <span style="display:inline-block;background-color:rgba(45,212,191,0.18);color:#8ff2d6;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;padding:7px 14px;border-radius:999px">&#10003; Pagamento confirmado</span>
                    </td>
                  </tr>
                </table>
                <div style="font-family:Arial,Helvetica,sans-serif;font-size:34px;line-height:1.15;font-weight:800;color:#ffffff;margin-top:26px">${escapeHtml(ctx.possessive)}</div>
                <div style="font-family:Arial,Helvetica,sans-serif;font-size:34px;line-height:1.15;font-weight:800;color:${ACCENT_SOLID};margin-top:2px">já ${escapeHtml(ctx.verb)}.</div>
                <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;letter-spacing:3px;color:#c9c1de;text-transform:uppercase;margin-top:14px">Nos vemos no evento!</div>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding:30px 32px 8px 32px;font-family:Arial,Helvetica,sans-serif">
                <div style="font-size:20px;font-weight:800;color:${INK}">Olá, ${escapeHtml(input.buyerName)}!</div>
                <div style="font-size:14px;line-height:1.6;color:${MUTED};margin-top:8px">
                  Sua compra foi aprovada e ${escapeHtml(ctx.ticketLine)} já ${input.ticketCount !== 1 ? "estão disponíveis" : "está disponível"} abaixo.
                  O QR Code de entrada fica protegido dentro do ingresso — abra pelo botão abaixo quando for usar.
                </div>
              </td>
            </tr>

            <!-- Info grid -->
            <tr>
              <td style="padding:18px 32px 8px 32px">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f7f5fb;border-radius:16px">
                  <tr>
                    <td style="padding:18px 20px 10px 20px" width="50%">${infoCell(iconBadge("calendar"), "Evento", escapeHtml(input.eventTitle))}</td>
                    <td style="padding:18px 20px 10px 20px" width="50%">${infoCell(iconBadge("clock"), "Quando", formatLongDayMonthTime(input.eventStartsAt))}</td>
                  </tr>
                  <tr>
                    <td style="padding:6px 20px 18px 20px" width="50%">${infoCell(iconBadge("pin"), "Local", escapeHtml(input.eventVenue))}</td>
                    <td style="padding:6px 20px 18px 20px" width="50%">${infoCell(iconBadge("ticket"), "Pedido", ctx.code)}</td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Ticket card(s) -->
            <tr>
              <td style="padding:22px 32px 0 32px">
                ${cards}
              </td>
            </tr>

            <!-- CTAs -->
            <tr>
              <td style="padding:0 32px 24px 32px">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="padding-right:10px;padding-bottom:10px">${pillButton({ href: input.orderUrl, iconUrl: iconWhite("ticket-open"), label: "Abrir ingresso", variant: "primary" })}</td>
                    ${input.ticketCount === 1 && input.tickets[0]
                      ? `<td style="padding-right:10px;padding-bottom:10px">${pillButton({ href: input.tickets[0].pdfUrl, iconUrl: iconAccent("download"), label: "Baixar PDF", variant: "light", textColor: INK })}</td>`
                      : ""}
                    <td style="padding-right:10px;padding-bottom:10px">${pillButton({ href: input.createAccountUrl, iconUrl: iconAccent("person"), label: "Criar conta / Entrar", variant: "light", textColor: ACCENT_TEXT })}</td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Warning -->
            <tr>
              <td style="padding:0 32px 28px 32px">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fdf3d9;border-radius:14px">
                  <tr>
                    <td width="44" valign="top" style="padding:16px 0 16px 18px"><img src="${iconAmber("shield")}" width="26" height="26" alt="" style="display:block;border:0" /></td>
                    <td style="padding:16px 18px 16px 12px;font-family:Arial,Helvetica,sans-serif">
                      <div style="font-size:13px;font-weight:800;color:#6b4e0a">Este link é pessoal e o QR Code só existe dentro do ingresso.</div>
                      <div style="font-size:12px;color:#8a6d1f;margin-top:4px;line-height:1.5">Não compartilhe este e-mail. Cada QR Code é único e só pode ser usado uma vez na entrada.</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:20px 32px 30px 32px;border-top:1px solid #efeaf7">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td valign="middle" style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${MUTED};line-height:1.5">
                      Compra processada com segurança pela ${BRAND}.<br />
                      Em caso de dúvidas, <a href="${escapeAttr(input.createAccountUrl)}" style="color:${ACCENT_SOLID}">fale com nosso time de suporte</a>.
                    </td>
                    <td valign="middle" align="right">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
                        <td valign="middle" align="right" style="padding-right:10px;font-family:Arial,Helvetica,sans-serif;font-size:10px;color:${MUTED};line-height:1.3;white-space:nowrap">Mais encontros,<br/>mais hist&oacute;rias.</td>
                        <td valign="middle"><img src="${escapeAttr(input.logoLightUrl)}" width="92" alt="${BRAND}" style="display:block;border:0" /></td>
                      </tr></table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`.trim();
}
