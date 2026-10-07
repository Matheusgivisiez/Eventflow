export type PurchaseConfirmedTemplateTicket = {
  id: string;
  attendeeName: string;
  ticketTypeName: string;
  shortCode: string;
  /** Guest-safe download link, authorized by the order's access token. */
  pdfUrl: string;
  /**
   * Source of the real, scannable QR (a `cid:` reference to an inline
   * attachment). Only set when the event's QR is already released; when
   * absent the card shows the locked placeholder instead.
   */
  qrImageSrc?: string;
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
  /**
   * Present only when this e-mail delivers a ticket received via transfer,
   * not a fresh purchase — swaps the payment/order-specific copy for
   * transfer-appropriate wording while reusing the exact same ticket card.
   */
  transfer?: { fromName: string };
  /**
   * Pedido de total zero (evento gratuito ou cupom de 100%). Não houve cobrança,
   * então o texto fala em inscrição confirmada, nunca em pagamento.
   */
  free?: boolean;
  /**
   * Ingresso de cortesia (convidado da plataforma ou do organizador). Ninguém
   * comprou nem se inscreveu, então o texto fala em convite. Tem precedência
   * sobre `free`.
   */
  courtesy?: boolean;
  /** Only for a platform invitation; a sold ticket named VIP stays standard. */
  vipInvite?: { invitedBy?: string };
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

type EmailTheme = {
  vip: boolean;
  card: string;
  hero: string;
  accent: string;
  accentText: string;
  gradient: string;
  ink: string;
  muted: string;
  outer: string;
  sheet: string;
  info: string;
  cardLabel: string;
  cardCaption: string;
  badgeIconPrefix: string;
  accentIconPrefix: string;
  backgroundFile: string;
  darkOuter: string;
  darkSheet: string;
  darkInfo: string;
  darkInk: string;
  darkMuted: string;
  darkWarning: string;
  darkWarningTitle: string;
  darkWarningCopy: string;
  darkBorder: string;
};

const STANDARD_THEME: EmailTheme = {
  vip: false, card: CARD_SOLID, hero: HERO_SOLID, accent: ACCENT_SOLID,
  accentText: ACCENT_TEXT, gradient: PRIMARY_BTN_GRADIENT, ink: INK, muted: MUTED,
  outer: "#f2eef9", sheet: "#ffffff", info: "#f7f5fb", cardLabel: "#b8a9e0",
  cardCaption: "#c9c1de", badgeIconPrefix: "icon-badge", accentIconPrefix: "icon-accent",
  backgroundFile: "ticket-card-bg.png", darkOuter: "#0d091b", darkSheet: "#171126",
  darkInfo: "#241c36", darkInk: "#f4f0fa", darkMuted: "#c3bad3",
  darkWarning: "#382b16", darkWarningTitle: "#ffe5ad", darkWarningCopy: "#e7cf9c",
  darkBorder: "#382e4a",
};

const VIP_THEME: EmailTheme = {
  vip: true, card: "#11100f", hero: "#11100f", accent: "#b59a68",
  accentText: "#705a35", gradient: "#282420",
  ink: "#24211d", muted: "#716b63", outer: "#f1efeb", sheet: "#fffefd",
  info: "#f3f1ed", cardLabel: "#b9a782", cardCaption: "#e2dbce",
  badgeIconPrefix: "vip-icon-badge", accentIconPrefix: "vip-icon-accent",
  backgroundFile: "vip-bg.png", darkOuter: "#11100f", darkSheet: "#1b1a18",
  darkInfo: "#292723", darkInk: "#f2efe8", darkMuted: "#c7c0b5",
  darkWarning: "#2d2922", darkWarningTitle: "#eee7d8", darkWarningCopy: "#c9c0b0",
  darkBorder: "#3a352e",
};

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
 * Carries no CPF and no phone. The QR follows the event's own release rule,
 * which the organizer sets per event:
 *
 * - still locked: the card shows a decorative locked placeholder (see
 *   qrLockedImageUrl) and the real QR only exists behind the order's access
 *   token (orderUrl / per-ticket pdfUrl), which applies the same lock.
 * - already released (e.g. "released at purchase"): the real, scannable QR
 *   is embedded per ticket (`qrImageSrc`). A code sitting in an inbox can be
 *   forwarded or screenshotted, so the copy below warns about it; the door
 *   only accepts each code once.
 */
export function renderPurchaseConfirmed(input: PurchaseConfirmedTemplateInput) {
  const code = orderCode(input.orderId);
  const when = formatEventDate(input.eventStartsAt);
  const plural = input.ticketCount !== 1;
  const ticketLine = plural ? `${input.ticketCount} ingressos` : "1 ingresso";
  const possessive = plural ? "Seus ingressos" : "Seu ingresso";
  const verb = plural ? "estão prontos" : "está pronto";
  const transfer = input.transfer;
  const vip = Boolean(input.vipInvite);
  const inviter = input.vipInvite?.invitedBy?.trim() || BRAND;
  const theme = vip ? VIP_THEME : STANDARD_THEME;

  const subject = vip
    ? `${plural ? "Seus convites Premium" : "Seu convite Premium"} para ${input.eventTitle} ${plural ? "chegaram" : "chegou"}!`
    : transfer
    ? `${possessive} para ${input.eventTitle} chegou!`
    : `${possessive} para ${input.eventTitle} já ${verb}!`;
  const preheader = vip
    ? `${inviter} convidou você para ${input.eventTitle}. ${plural ? "Seus ingressos VIP nominais estão disponíveis" : "Seu ingresso VIP nominal está disponível"}.`
    : transfer
    ? `${transfer.fromName} transferiu ${ticketLine} para você. ${possessive} para ${input.eventTitle} já ${plural ? "estão disponíveis" : "está disponível"}.`
    : `${input.courtesy ? "Convite confirmado" : input.free ? "Inscrição confirmada" : "Pagamento aprovado"}. ${possessive} para ${input.eventTitle} já ${plural ? "estão disponíveis" : "está disponível"}.`;

  const text = [
    `Olá, ${input.buyerName}.`,
    "",
    vip
      ? `Você recebeu um convite de ${inviter} para viver a experiência Premium em ${input.eventTitle}. ${possessive} ${plural ? "são nominais" : "é nominal"} e ${plural ? "não podem" : "não pode"} ser transferido${plural ? "s" : ""}.`
      : transfer
      ? `${transfer.fromName} transferiu ${ticketLine} para ${input.eventTitle} para você, e já ${plural ? "estão disponíveis" : "está disponível"}.`
      : `${input.courtesy ? "Seu convite foi confirmado" : input.free ? "Sua inscrição foi confirmada" : "Seu pagamento foi aprovado"} e ${ticketLine} já ${plural ? "estão disponíveis" : "está disponível"}.`,
    "",
    `Evento: ${input.eventTitle}`,
    `Local: ${input.eventVenue}`,
    `Data: ${when}`,
    ...(transfer || vip ? [] : [`Pedido: ${code}`]),
    "",
    ...input.tickets.flatMap((ticket) => [
      `- ${ticket.attendeeName} | ${ticket.ticketTypeName} | código ${ticket.shortCode}`,
      `  Baixar PDF: ${ticket.pdfUrl}`
    ]),
    "",
    `Ver seus ingressos: ${input.orderUrl}`,
    "",
    input.tickets.every((ticket) => ticket.qrImageSrc)
      ? "O QR Code de cada ingresso já está liberado: ele vai neste e-mail e também no PDF e no link acima. Cada código só pode ser usado uma vez na entrada."
      : vip
        ? "O QR Code será liberado conforme a programação do evento. Baixe o PDF novamente depois da liberação."
        : "O QR Code de cada ingresso só fica disponível dentro do link acima (não vai por e-mail, por segurança).",
    vip
      ? "Este convite é pessoal e intransferível. Apresente um documento com foto na entrada e não compartilhe o QR Code."
      : "Este link é pessoal: quem tiver o endereço consegue ver este pedido. Não compartilhe.",
    ...(transfer || vip
      ? []
      : ["", `Quer todos os seus ingressos em um lugar só? Crie uma conta: ${input.createAccountUrl}`]),
    "",
    BRAND
  ].join("\n");

  const html = renderHtml(input, { code, when, ticketLine, possessive, verb, preheader, inviter, theme });

  return { subject, text, html };
}

function asset(base: string, name: string) {
  return `${base.replace(/\/+$/, "")}/${name}`;
}

function infoCell(iconUrl: string, label: string, value: string, theme: EmailTheme) {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td width="40" valign="top"><img src="${escapeAttr(iconUrl)}" width="40" height="40" alt="" style="display:block;border:0" /></td>
        <td width="10"></td>
        <td valign="middle" style="font-family:Arial,Helvetica,sans-serif">
          <div class="ef-muted" style="font-size:11px;font-weight:700;letter-spacing:1px;color:${theme.muted};text-transform:uppercase">${label}</div>
          <div class="ef-ink" style="font-size:15px;font-weight:700;color:${theme.ink};margin-top:2px">${value}</div>
        </td>
      </tr>
    </table>`;
}

function metaPill(iconUrl: string, label: string, value: string, theme: EmailTheme) {
  return `
    <td class="ef-meta-cell" width="33%" valign="top" style="padding-right:8px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.14);border-radius:12px">
        <tr>
          <td style="padding:10px 12px;font-family:Arial,Helvetica,sans-serif">
            <img src="${escapeAttr(iconUrl)}" width="16" height="16" alt="" style="display:block;border:0" />
            <div style="font-size:10px;font-weight:700;letter-spacing:1px;color:${theme.vip ? "#b9a782" : "#c9c1de"};text-transform:uppercase;margin-top:7px">${label}</div>
            <div style="font-size:15px;font-weight:700;color:${theme.vip ? "#f2efe8" : "#ffffff"};margin-top:2px">${value}</div>
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
  theme: EmailTheme;
}) {
  const isPrimary = opts.variant === "primary";
  const bg = isPrimary
    ? `background-color:${opts.theme.vip ? "#282420" : "#1c1140"};background:${opts.theme.gradient};${opts.theme.vip ? "border:1px solid #51483a;" : ""}`
    : `background-color:${opts.theme.vip ? "#fffefd" : "#ffffff"};border:1px solid ${opts.theme.vip ? "#d9d3c8" : "#e3ddef"};`;
  const color = isPrimary ? "#ffffff" : opts.textColor ?? opts.theme.ink;
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
    theme: EmailTheme;
  }
) {
  const qrReleased = Boolean(ticket.qrImageSrc);
  const qrCaption = qrReleased
    ? "QR Code liberado. Apresente na entrada."
    : ctx.qrCodeLocked && ctx.qrCodeReleaseAt
      ? `Libera em ${formatEventDate(ctx.qrCodeReleaseAt)}.`
      : "Toque em “Abrir ingresso” para ver e usar na entrada.";
  // The real QR is dense (uuid + order + signature), so it gets the full
  // width of the stub; the placeholder is decorative and stays small.
  const qrImage = qrReleased
    ? `<img src="${escapeAttr(ticket.qrImageSrc!)}" width="148" alt="QR Code do ingresso" style="display:block;border:0;width:100%;max-width:148px;height:auto" />`
    : `<img src="${escapeAttr(ctx.qrLockedImageUrl)}" width="104" height="104" alt="QR Code protegido" style="display:block;border:0;border-radius:8px" />`;

  const iconWhite = (name: string) => asset(ctx.assetsBaseUrl, `icon-white-${name}.png`);

  const leftBlock = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td valign="middle" width="84"><img src="${escapeAttr(ctx.logoDarkUrl)}" width="84" alt="${BRAND}" style="display:block;border:0" /></td>
      </tr>
    </table>

    <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:700;letter-spacing:2px;color:${ctx.theme.cardLabel};text-transform:uppercase;margin-top:16px">${ctx.theme.vip ? "CONVITE VIP · ACESSO PREMIUM" : escapeHtml(ctx.eventTitle)}</div>
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:24px;line-height:1.15;font-weight:800;color:${ctx.theme.vip ? "#f2efe8" : "#ffffff"};margin-top:4px">${escapeHtml(ctx.eventTitle)}</div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:14px">
      <tr>
        ${metaPill(iconWhite("calendar"), "Data", formatShortDayMonth(ctx.startsAt), ctx.theme)}
        ${metaPill(iconWhite("clock"), "Hora", formatHourMinute(ctx.startsAt), ctx.theme)}
        ${metaPill(iconWhite("ticket"), "Setor", escapeHtml(ticket.ticketTypeName), ctx.theme)}
      </tr>
    </table>

    <div style="border-top:1px dashed rgba(255,255,255,0.22);margin-top:18px;padding-top:14px">
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:700;letter-spacing:1px;color:${ctx.theme.cardLabel};text-transform:uppercase">${ctx.theme.vip ? "Convidado" : "Participante"}</div>
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
            <td valign="middle" style="padding-right:5px"><img src="${escapeAttr(asset(ctx.assetsBaseUrl, qrReleased ? "icon-dark-ticket.png" : "icon-dark-lock.png"))}" width="11" height="11" alt="" style="display:block;border:0" /></td>
            <td valign="middle" style="font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:800;letter-spacing:1px;color:${ctx.theme.ink};text-transform:uppercase;white-space:nowrap">${ctx.theme.vip ? "Ingresso VIP" : "Seu ingresso"}</td>
          </tr></table>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding:8px 14px 14px 14px">
          ${qrImage}
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:800;letter-spacing:1px;color:${ctx.theme.ink};margin-top:7px">${escapeHtml(formatShortCode(ticket.shortCode))}</div>
        </td>
      </tr>
    </table>
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;color:${ctx.theme.cardCaption};margin-top:9px;line-height:1.4;text-align:center;${ctx.theme.vip ? "background-color:rgba(0,0,0,0.64);padding:6px 4px;border-radius:8px" : ""}">${qrCaption}</div>
    ${ctx.showInlineDownload
      ? `<div style="text-align:center;margin-top:10px">
           <a href="${escapeAttr(ticket.pdfUrl)}" style="font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;color:${ctx.theme.cardCaption};text-decoration:underline">Baixar PDF deste ingresso</a>
         </div>`
      : ""}
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:9px;letter-spacing:1px;color:${ctx.theme.vip ? "#b9a782" : "#8477a3"};text-transform:uppercase;margin-top:14px;text-align:center;border-top:1px solid rgba(255,255,255,0.14);padding-top:10px">${BRAND}<br/>Ingressos que aproximam</div>`;

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
      <td style="background-color:${ctx.theme.card};background-image:${ctx.theme.vip ? "linear-gradient(rgba(12,11,10,0.52),rgba(12,11,10,0.52))," : ""}url(${escapeAttr(asset(ctx.assetsBaseUrl, ctx.theme.backgroundFile))})${ctx.theme.vip ? "" : `,url(${escapeAttr(asset(ctx.assetsBaseUrl, "ticket-notch-left.png"))}),url(${escapeAttr(asset(ctx.assetsBaseUrl, "ticket-notch-right.png"))})`};background-repeat:no-repeat${ctx.theme.vip ? ",no-repeat" : ",no-repeat,no-repeat"};background-position:center${ctx.theme.vip ? ",center" : ",left center,right center"};background-size:cover${ctx.theme.vip ? ",cover" : ",20px 56px,20px 56px"};border-radius:24px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td class="ef-ticket-left" width="62%" valign="top" style="padding:26px 16px 24px 28px">${leftBlock}</td>
            <td class="ef-ticket-right" width="38%" valign="top" style="padding:26px 24px 22px 16px">${rightBlock}</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>`;
}

function renderHtml(
  input: PurchaseConfirmedTemplateInput,
  ctx: { code: string; when: string; ticketLine: string; possessive: string; verb: string; preheader: string; inviter: string; theme: EmailTheme }
) {
  const theme = ctx.theme;
  const iconBadge = (name: string) => asset(input.assetsBaseUrl, `${theme.badgeIconPrefix}-${name}.png`);
  const iconWhite = (name: string) => asset(input.assetsBaseUrl, `icon-white-${name}.png`);
  const iconAccent = (name: string) => asset(input.assetsBaseUrl, `${theme.accentIconPrefix}-${name}.png`);
  const iconAmber = (name: string) => asset(input.assetsBaseUrl, `icon-amber-${name}.png`);
  const isTransfer = Boolean(input.transfer);

  const showInlineDownload = input.ticketCount > 1;
  const qrReleased = input.tickets.every((ticket) => ticket.qrImageSrc);

  const cards = input.tickets
    .map((ticket) =>
      ticketCard(ticket, {
        eventTitle: input.eventTitle,
        startsAt: input.eventStartsAt,
        assetsBaseUrl: input.assetsBaseUrl,
        logoDarkUrl: theme.vip ? asset(input.assetsBaseUrl, "vip-logo-white.png") : input.logoDarkUrl,
        qrLockedImageUrl: input.qrLockedImageUrl,
        qrCodeLocked: input.qrCodeLocked,
        qrCodeReleaseAt: input.qrCodeReleaseAt,
        showInlineDownload,
        theme,
      })
    )
    .join("");

  return `
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="color-scheme" content="light dark" />
    <meta name="supported-color-schemes" content="light dark" />
    <title>${theme.vip ? "Bem-vindo à experiência Premium" : `${escapeHtml(ctx.possessive)} já ${ctx.verb}`}</title>
    <style>
      @media (prefers-color-scheme: dark) {
        .ef-outer { background-color:${theme.darkOuter} !important; }
        .ef-sheet { background-color:${theme.darkSheet} !important; }
        .ef-info { background-color:${theme.darkInfo} !important; }
        .ef-ink { color:${theme.darkInk} !important; }
        .ef-muted { color:${theme.darkMuted} !important; }
        .ef-warning { background-color:${theme.darkWarning} !important; }
        .ef-warning-title { color:${theme.darkWarningTitle} !important; }
        .ef-warning-copy { color:${theme.darkWarningCopy} !important; }
        .ef-footer { border-top-color:${theme.darkBorder} !important; }
        .ef-link { color:${theme.vip ? "#cbb68f" : "#cbb1ff"} !important; }
        .ef-light-logo { display:none !important; }
        .ef-dark-logo { display:block !important; }
      }
      [data-ogsc] .ef-outer { background-color:${theme.darkOuter} !important; }
      [data-ogsc] .ef-sheet { background-color:${theme.darkSheet} !important; }
      [data-ogsc] .ef-info { background-color:${theme.darkInfo} !important; }
      [data-ogsc] .ef-ink { color:${theme.darkInk} !important; }
      [data-ogsc] .ef-muted { color:${theme.darkMuted} !important; }
      [data-ogsc] .ef-warning { background-color:${theme.darkWarning} !important; }
      [data-ogsc] .ef-warning-title { color:${theme.darkWarningTitle} !important; }
      [data-ogsc] .ef-warning-copy { color:${theme.darkWarningCopy} !important; }
      [data-ogsc] .ef-footer { border-top-color:${theme.darkBorder} !important; }
      [data-ogsc] .ef-light-logo { display:none !important; }
      [data-ogsc] .ef-dark-logo { display:block !important; }
      @media screen and (max-width:600px) {
        .ef-shell-padding { padding:12px !important; }
        .ef-sheet { width:100% !important; }
        .ef-section { padding-left:20px !important; padding-right:20px !important; }
        .ef-info-cell { display:block !important; width:auto !important; padding:12px 16px !important; }
        .ef-ticket-left, .ef-ticket-right { display:block !important; width:auto !important; padding:20px !important; }
        .ef-ticket-right { padding-top:0 !important; }
        .ef-meta-cell { padding-right:4px !important; }
        .ef-cta-cell { display:block !important; padding-right:0 !important; }
        .ef-footer-copy, .ef-footer-brand { display:block !important; width:auto !important; text-align:left !important; }
        .ef-footer-brand { padding-top:18px !important; }
      }
    </style>
  </head>
  <body class="ef-outer" style="margin:0;padding:0;background-color:${theme.outer}">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(ctx.preheader)}</div>
    <table class="ef-outer" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${theme.outer}">
      <tr>
        <td class="ef-shell-padding" align="center" style="padding:24px 16px">
          <table class="ef-sheet" role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background-color:${theme.sheet};border-radius:22px;overflow:hidden">

            <!-- Hero -->
            <tr>
              <td class="ef-section" style="background-color:${theme.hero};background-image:${theme.vip ? "linear-gradient(rgba(12,11,10,0.54),rgba(12,11,10,0.54))," : ""}url(${escapeAttr(asset(input.assetsBaseUrl, theme.vip ? "vip-bg.png" : "hero-bg.png"))});background-size:cover;background-position:center right;background-repeat:no-repeat;padding:32px 32px 28px 32px">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td valign="middle" width="110"><img src="${escapeAttr(theme.vip ? asset(input.assetsBaseUrl, "vip-logo-white.png") : input.logoDarkUrl)}" width="110" alt="${BRAND}" style="display:block;border:0" /></td>
                  </tr>
                </table>
                <div style="font-family:Arial,Helvetica,sans-serif;font-size:34px;line-height:1.15;font-weight:800;color:${theme.vip ? "#f2efe8" : "#ffffff"};margin-top:26px">${theme.vip ? "Bem-vindo à" : escapeHtml(ctx.possessive)}</div>
                <div style="font-family:Arial,Helvetica,sans-serif;font-size:34px;line-height:1.15;font-weight:800;color:${theme.vip ? "#f2efe8" : theme.accent};margin-top:2px">${theme.vip ? "experiência Premium." : `já ${escapeHtml(ctx.verb)}.`}</div>
                <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;letter-spacing:3px;color:${theme.vip ? "#c4b596" : "#c9c1de"};text-transform:uppercase;margin-top:14px">${theme.vip ? "UM CONVITE FEITO PARA VOCÊ" : "Nos vemos no evento!"}</div>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td class="ef-section" style="padding:30px 32px 8px 32px;font-family:Arial,Helvetica,sans-serif">
                <div class="ef-ink" style="font-size:20px;font-weight:800;color:${theme.ink}">Olá, ${escapeHtml(input.buyerName)}!</div>
                <div class="ef-muted" style="font-size:14px;line-height:1.6;color:${theme.muted};margin-top:8px">
                  ${theme.vip
                    ? `Você recebeu ${input.ticketCount === 1 ? "um convite especial" : `${input.ticketCount} convites especiais`} de ${escapeHtml(ctx.inviter)} para ${escapeHtml(input.eventTitle)}. ${input.ticketCount === 1 ? "Seu ingresso VIP foi reservado em seu nome e é pessoal e intransferível" : "Seus ingressos VIP foram reservados em seu nome e são pessoais e intransferíveis"}.`
                    : isTransfer
                    ? `${escapeHtml(input.transfer!.fromName)} transferiu ${escapeHtml(ctx.ticketLine)} para você e já ${input.ticketCount !== 1 ? "estão disponíveis" : "está disponível"} abaixo.`
                    : `${input.courtesy ? "Seu convite foi confirmado" : input.free ? "Sua inscrição foi confirmada" : "Sua compra foi aprovada"} e ${escapeHtml(ctx.ticketLine)} já ${input.ticketCount !== 1 ? "estão disponíveis" : "está disponível"} abaixo.`}
                  ${qrReleased
                    ? "O QR Code de entrada já está liberado: use o que aparece abaixo, o PDF ou o botão para abrir o ingresso."
                    : theme.vip
                      ? "O QR Code será liberado conforme a programação do evento; você poderá baixar o PDF atualizado depois."
                      : "O QR Code de entrada fica protegido dentro do ingresso — abra pelo botão abaixo quando for usar."}
                </div>
              </td>
            </tr>

            <!-- Info grid -->
            <tr>
              <td class="ef-section" style="padding:18px 32px 8px 32px">
                <table class="ef-info" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${theme.info};border-radius:16px">
                  <tr>
                    <td class="ef-info-cell" style="padding:18px 20px 10px 20px" width="50%">${infoCell(iconBadge("calendar"), "Evento", escapeHtml(input.eventTitle), theme)}</td>
                    <td class="ef-info-cell" style="padding:18px 20px 10px 20px" width="50%">${infoCell(iconBadge("clock"), "Quando", formatLongDayMonthTime(input.eventStartsAt), theme)}</td>
                  </tr>
                  <tr>
                    <td class="ef-info-cell" style="padding:6px 20px 18px 20px" width="50%">${infoCell(iconBadge("pin"), "Local", escapeHtml(input.eventVenue), theme)}</td>
                    <td class="ef-info-cell" style="padding:6px 20px 18px 20px" width="50%">${isTransfer || theme.vip
                      ? infoCell(iconBadge("ticket"), theme.vip ? "Convite VIP" : "Ingresso", escapeHtml(formatShortCode(input.tickets[0]?.shortCode ?? "")), theme)
                      : infoCell(iconBadge("ticket"), "Pedido", ctx.code, theme)}</td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Ticket card(s) -->
            <tr>
              <td class="ef-section" style="padding:22px 32px 0 32px">
                ${cards}
              </td>
            </tr>

            <!-- CTAs -->
            <tr>
              <td class="ef-section" style="padding:0 32px 24px 32px">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td class="ef-cta-cell" style="padding-right:10px;padding-bottom:10px">${pillButton({ href: input.orderUrl, iconUrl: iconWhite("ticket-open"), label: theme.vip ? input.ticketCount === 1 ? "Ver meu convite" : "Ver meus convites" : "Abrir ingresso", variant: "primary", theme })}</td>
                    ${input.ticketCount === 1 && input.tickets[0]
                      ? `<td class="ef-cta-cell" style="padding-right:10px;padding-bottom:10px">${pillButton({ href: input.tickets[0].pdfUrl, iconUrl: iconAccent("download"), label: "Baixar PDF", variant: "light", textColor: theme.ink, theme })}</td>`
                      : ""}
                    <td class="ef-cta-cell" style="padding-right:10px;padding-bottom:10px">${pillButton({ href: input.createAccountUrl, iconUrl: iconAccent("person"), label: isTransfer ? "Meus ingressos" : "Criar conta / Entrar", variant: "light", textColor: theme.accentText, theme })}</td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Warning -->
            <tr>
              <td class="ef-section" style="padding:0 32px 28px 32px">
                <table class="ef-warning" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${theme.vip ? "#f3f0e9" : "#fdf3d9"};border-radius:14px">
                  <tr>
                    <td width="44" valign="top" style="padding:16px 0 16px 18px"><img src="${iconAmber("shield")}" width="26" height="26" alt="" style="display:block;border:0" /></td>
                    <td style="padding:16px 18px 16px 12px;font-family:Arial,Helvetica,sans-serif">
                      <div class="ef-warning-title" style="font-size:13px;font-weight:800;color:${theme.vip ? "#514637" : "#6b4e0a"}">${theme.vip ? "Convite VIP nominal e intransferível." : qrReleased ? "Este e-mail é o seu ingresso: o QR Code acima já vale na entrada." : "Este link é pessoal e o QR Code só existe dentro do ingresso."}</div>
                      <div class="ef-warning-copy" style="font-size:12px;color:${theme.vip ? "#71695c" : "#8a6d1f"};margin-top:4px;line-height:1.5">${theme.vip ? "Apresente um documento com foto na entrada. Não encaminhe este convite nem compartilhe o QR Code; ele só pode ser usado uma vez." : `${qrReleased ? "Não encaminhe nem publique este e-mail: quem apresentar o QR Code primeiro entra." : "Não compartilhe este e-mail."} Cada QR Code é único e só pode ser usado uma vez na entrada.`}</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td class="ef-footer ef-section" style="padding:20px 32px 30px 32px;border-top:1px solid ${theme.vip ? "#e1ddd5" : "#efeaf7"}">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td class="ef-muted ef-footer-copy" valign="middle" style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${theme.muted};line-height:1.5">
                      ${theme.vip ? `Convite pessoal enviado por ${BRAND}.` : isTransfer ? `Transferência confirmada com segurança pela ${BRAND}.` : `${input.courtesy ? "Convite emitido" : input.free ? "Inscrição processada" : "Compra processada"} com segurança pela ${BRAND}.`}<br />
                      Em caso de dúvidas, <a class="ef-link" href="${escapeAttr(input.createAccountUrl)}" style="color:${theme.vip ? theme.accentText : theme.accent}">fale com nosso time de suporte</a>.
                    </td>
                    <td class="ef-footer-brand" valign="middle" align="right">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
                        <td class="ef-muted" valign="middle" align="right" style="padding-right:10px;font-family:Arial,Helvetica,sans-serif;font-size:10px;color:${theme.muted};line-height:1.3;white-space:nowrap">Mais encontros,<br/>mais hist&oacute;rias.</td>
                        <td valign="middle"><img class="ef-light-logo" src="${escapeAttr(theme.vip ? asset(input.assetsBaseUrl, "vip-logo-dark.png") : input.logoLightUrl)}" width="92" alt="${BRAND}" style="display:block;border:0" /><img class="ef-dark-logo" src="${escapeAttr(theme.vip ? asset(input.assetsBaseUrl, "vip-logo-white.png") : input.logoDarkUrl)}" width="92" alt="" style="display:none;border:0" /></td>
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
