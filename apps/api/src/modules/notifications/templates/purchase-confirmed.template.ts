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
// Bump the version when the art changes: mail clients cache images by URL.
const VIP_LOGO_WHITE = "vip-logo-white.png?v=2";
const VIP_LOGO_DARK = "vip-logo-dark.png?v=2";
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
};

const STANDARD_THEME: EmailTheme = {
  vip: false, card: CARD_SOLID, hero: HERO_SOLID, accent: ACCENT_SOLID,
  accentText: ACCENT_TEXT, gradient: PRIMARY_BTN_GRADIENT, ink: INK, muted: MUTED,
  outer: "#f2eef9", sheet: "#ffffff", info: "#f7f5fb", cardLabel: "#b8a9e0",
  cardCaption: "#c9c1de", badgeIconPrefix: "icon-badge", accentIconPrefix: "icon-accent",
  backgroundFile: "ticket-card-bg.png",
};

const VIP_THEME: EmailTheme = {
  vip: true, card: "#11100f", hero: "#11100f", accent: "#b59a68",
  accentText: "#705a35", gradient: "#282420",
  ink: "#24211d", muted: "#716b63", outer: "#f1efeb", sheet: "#fffefd",
  info: "#f3f1ed", cardLabel: "#b9a782", cardCaption: "#e2dbce",
  badgeIconPrefix: "vip-icon-badge", accentIconPrefix: "vip-icon-accent",
  backgroundFile: "vip-bg.png",
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
  // Always opens a sentence ("A Event Flow emitiu ..."), hence the article on the default.
  const invitedBy = input.vipInvite?.invitedBy?.trim();
  const inviter = !invitedBy || invitedBy === BRAND ? `A ${BRAND}` : invitedBy;
  const vipTicketLine = vipTicketCount(input.ticketCount);
  const theme = vip ? VIP_THEME : STANDARD_THEME;
  // VIP wording note: keep it a confirmation of an issued ticket ("emitiu", "confirmado").
  // Campaign-style wording ("convite Premium", "convite especial", "feito para você")
  // made Gmail file this e-mail under Promotions instead of the main inbox.

  const subject = vip
    ? `${plural ? "Seus ingressos VIP" : "Seu ingresso VIP"} para ${input.eventTitle} ${plural ? "estão confirmados" : "está confirmado"}`
    : transfer
    ? `${possessive} para ${input.eventTitle} chegou!`
    : `${possessive} para ${input.eventTitle} já ${verb}!`;
  const preheader = vip
    ? `${plural ? "Ingressos VIP confirmados" : "Ingresso VIP confirmado"}. ${inviter} emitiu ${vipTicketLine} em seu nome para ${input.eventTitle}.`
    : transfer
    ? `${transfer.fromName} transferiu ${ticketLine} para você. ${possessive} para ${input.eventTitle} já ${plural ? "estão disponíveis" : "está disponível"}.`
    : `${input.courtesy ? "Convite confirmado" : input.free ? "Inscrição confirmada" : "Pagamento aprovado"}. ${possessive} para ${input.eventTitle} já ${plural ? "estão disponíveis" : "está disponível"}.`;

  const text = [
    `Olá, ${input.buyerName}.`,
    "",
    vip
      ? `${plural ? "Seus ingressos VIP estão confirmados" : "Seu ingresso VIP está confirmado"}. ${inviter} emitiu ${vipTicketLine} em seu nome para ${input.eventTitle}. ${plural ? "Eles são nominais e não podem ser transferidos" : "Ele é nominal e não pode ser transferido"}.`
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

/** "1 ingresso VIP" / "3 ingressos VIP" */
function vipTicketCount(count: number) {
  return count === 1 ? "1 ingresso VIP" : `${count} ingressos VIP`;
}

function asset(base: string, name: string) {
  return `${base.replace(/\/+$/, "")}/${name}`;
}

/*
 * Layout rules (read before touching the HTML below).
 *
 * The e-mail is ONE compact layout that holds from ~300px (a phone inside the
 * Gmail app) up to 600px. Every inline size is the phone size; the single
 * `min-width` media query only enlarges type and padding on wide screens. So a
 * client that drops the <style> block still gets the compact layout, never a
 * broken one, and nothing ever stacks into a long single column.
 *
 * Symmetry comes from `table-layout:fixed` plus percentage widths: columns keep
 * their share no matter how long the text inside is.
 */
const FONT = "font-family:Arial,Helvetica,sans-serif";

function infoCell(iconUrl: string, label: string, value: string, theme: EmailTheme) {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td class="ef-info-icon-cell" width="26" valign="top"><img class="ef-info-icon" src="${escapeAttr(iconUrl)}" width="26" height="26" alt="" style="display:block;border:0;width:26px;height:26px" /></td>
        <td width="8" style="font-size:0;line-height:0">&nbsp;</td>
        <td valign="top" style="${FONT}">
          <div class="ef-muted ef-info-label" style="font-size:9px;line-height:12px;font-weight:700;letter-spacing:1px;color:${theme.muted};text-transform:uppercase">${label}</div>
          <div class="ef-ink ef-info-value" style="font-size:12px;line-height:16px;font-weight:700;color:${theme.ink};margin-top:1px;word-wrap:break-word">${value}</div>
        </td>
      </tr>
    </table>`;
}

/** Glass box inside the ticket card: small icon + label on one line, value below. */
function metaPill(iconUrl: string, label: string, value: string, theme: EmailTheme) {
  return `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.14);border-radius:10px">
        <tr>
          <td class="ef-pill" style="padding:8px 9px;${FONT}">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
              <td valign="middle" style="padding-right:5px"><img src="${escapeAttr(iconUrl)}" width="11" height="11" alt="" style="display:block;border:0" /></td>
              <td class="ef-pill-label" valign="middle" style="${FONT};font-size:8.5px;line-height:11px;font-weight:700;letter-spacing:1px;color:${theme.vip ? "#b9a782" : "#c9c1de"};text-transform:uppercase">${label}</td>
            </tr></table>
            <div class="ef-pill-value" style="font-size:13px;line-height:16px;font-weight:700;color:${theme.vip ? "#f2efe8" : "#ffffff"};margin-top:4px;word-wrap:break-word">${value}</div>
          </td>
        </tr>
      </table>`;
}

/**
 * One button of the action row. Buttons share the row in equal parts, so the
 * icon plus label must fit a third of a phone screen on one line (see CTA labels).
 */
function pillButton(opts: {
  href: string;
  iconUrl: string;
  label: string;
  variant: "primary" | "light";
  textColor?: string;
  theme: EmailTheme;
}) {
  const isPrimary = opts.variant === "primary";
  const primaryColor = opts.theme.vip ? "#282420" : "#1c1140";
  const bg = isPrimary
    ? `background-color:${primaryColor};background:${opts.theme.gradient};border:1px solid ${opts.theme.vip ? "#51483a" : primaryColor};`
    : `background-color:${opts.theme.vip ? "#fffefd" : "#ffffff"};border:1px solid ${opts.theme.vip ? "#d9d3c8" : "#e3ddef"};`;
  const color = isPrimary ? "#ffffff" : opts.textColor ?? opts.theme.ink;
  return `<a class="ef-btn" href="${escapeAttr(opts.href)}" style="display:block;text-decoration:none;text-align:center;border-radius:11px;${bg}padding:12px 0;${FONT};font-size:10.5px;line-height:14px;font-weight:700;color:${color};white-space:nowrap"><img class="ef-btn-icon" src="${escapeAttr(opts.iconUrl)}" width="11" height="11" alt="" style="display:inline-block;border:0;width:11px;height:11px;vertical-align:-1px;margin-right:4px" />${escapeHtml(opts.label)}</a>`;
}

/**
 * Ticket card: a horizontal stub at every width - event, date/time, sector and
 * holder on the left, the QR on the right. Date and time share a row in equal
 * halves; the sector gets the full row below because sector names ("LOTE NO
 * ESCURO", "Convidado VIP") do not fit a third of the column on a phone.
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
    orderUrl: string;
    theme: EmailTheme;
  }
) {
  const vip = ctx.theme.vip;
  const qrReleased = Boolean(ticket.qrImageSrc);
  const qrCaption = qrReleased
    ? "QR Code liberado. Apresente na entrada."
    : ctx.qrCodeLocked && ctx.qrCodeReleaseAt
      ? `Libera em ${formatEventDate(ctx.qrCodeReleaseAt)}.`
      : "Toque em “Abrir ingresso” para ver e usar na entrada.";
  // Fluid on purpose: the QR takes the whole stub width. Tapping it opens the
  // ticket page, where the code is shown full size for the door scanner.
  const qrImage = qrReleased
    ? `<img src="${escapeAttr(ticket.qrImageSrc!)}" width="148" alt="QR Code do ingresso" style="display:block;border:0;width:100%;max-width:148px;height:auto;margin:0 auto" />`
    : `<img src="${escapeAttr(ctx.qrLockedImageUrl)}" width="104" alt="QR Code protegido" style="display:block;border:0;border-radius:8px;width:100%;max-width:104px;height:auto;margin:0 auto" />`;

  const iconWhite = (name: string) => asset(ctx.assetsBaseUrl, `icon-white-${name}.png`);
  const titleColor = vip ? "#f2efe8" : "#ffffff";

  const leftBlock = `
    <img class="ef-card-logo" src="${escapeAttr(ctx.logoDarkUrl)}" width="66" alt="${BRAND}" style="display:block;border:0;width:66px;height:auto" />
    ${vip ? `<div class="ef-card-eyebrow" style="${FONT};font-size:8.5px;line-height:11px;font-weight:700;letter-spacing:2px;color:${ctx.theme.cardLabel};text-transform:uppercase;margin-top:12px">Convite VIP</div>` : ""}
    <div class="ef-card-title" style="${FONT};font-size:17px;line-height:20px;font-weight:800;color:${titleColor};margin-top:${vip ? "3px" : "12px"};word-wrap:break-word">${escapeHtml(ctx.eventTitle)}</div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:12px;table-layout:fixed">
      <tr>
        <td width="50%" valign="top" style="padding-right:3px">${metaPill(iconWhite("calendar"), "Data", formatShortDayMonth(ctx.startsAt), ctx.theme)}</td>
        <td width="50%" valign="top" style="padding-left:3px">${metaPill(iconWhite("clock"), "Hora", formatHourMinute(ctx.startsAt), ctx.theme)}</td>
      </tr>
      <tr>
        <td colspan="2" valign="top" style="padding-top:6px">${metaPill(iconWhite("ticket"), "Setor", escapeHtml(ticket.ticketTypeName), ctx.theme)}</td>
      </tr>
    </table>

    <div style="border-top:1px dashed rgba(255,255,255,0.22);margin-top:13px;padding-top:11px;${FONT};font-size:8.5px;line-height:11px;font-weight:700;letter-spacing:1px;color:${ctx.theme.cardLabel};text-transform:uppercase">${vip ? "Convidado" : "Participante"}</div>
    <div class="ef-card-name" style="${FONT};font-size:14px;line-height:18px;font-weight:800;color:#ffffff;margin-top:2px;word-wrap:break-word">${escapeHtml(ticket.attendeeName)}</div>`;

  // One white surface holding label + QR + code, centred in the stub.
  const rightBlock = `
    <table role="presentation" align="center" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff;border-radius:14px;width:100%;max-width:176px;margin:0 auto">
      <tr>
        <td class="ef-qr-label" align="center" style="padding:9px 4px 0 4px;${FONT};font-size:8.5px;line-height:11px;font-weight:800;letter-spacing:1px;color:${ctx.theme.ink};text-transform:uppercase;white-space:nowrap">${vip ? "Ingresso VIP" : "Seu ingresso"}</td>
      </tr>
      <tr>
        <td align="center" style="padding:6px 8px 9px 8px">
          <a href="${escapeAttr(ctx.orderUrl)}" style="display:block;text-decoration:none">${qrImage}</a>
          <div class="ef-qr-code" style="${FONT};font-size:9.5px;line-height:12px;font-weight:800;letter-spacing:1px;color:${ctx.theme.ink};margin-top:6px;white-space:nowrap">${escapeHtml(formatShortCode(ticket.shortCode))}</div>
        </td>
      </tr>
    </table>
    <div class="ef-qr-caption" style="${FONT};font-size:9.5px;line-height:13px;color:${ctx.theme.cardCaption};margin-top:8px;text-align:center;${vip ? "background-color:rgba(0,0,0,0.5);padding:5px 4px;border-radius:8px" : ""}">${qrCaption}</div>
    ${ctx.showInlineDownload
      ? `<div style="text-align:center;margin-top:7px">
           <a class="ef-qr-caption" href="${escapeAttr(ticket.pdfUrl)}" style="${FONT};font-size:9.5px;line-height:13px;font-weight:700;color:${ctx.theme.cardCaption};text-decoration:underline">Baixar PDF</a>
         </div>`
      : ""}`;

  // Background is the brand art (grid mesh + glow ribbon + glowing border)
  // used with `cover`, so it holds at any content height. On the standard
  // card two small notch overlays punch cutouts at the outer edges, vertically
  // centred regardless of height.
  const background = vip
    ? `background-image:linear-gradient(rgba(12,11,10,0.52),rgba(12,11,10,0.52)),url(${escapeAttr(asset(ctx.assetsBaseUrl, ctx.theme.backgroundFile))});background-repeat:no-repeat,no-repeat;background-position:center,center;background-size:cover,cover`
    : `background-image:url(${escapeAttr(asset(ctx.assetsBaseUrl, ctx.theme.backgroundFile))}),url(${escapeAttr(asset(ctx.assetsBaseUrl, "ticket-notch-left.png"))}),url(${escapeAttr(asset(ctx.assetsBaseUrl, "ticket-notch-right.png"))});background-repeat:no-repeat,no-repeat,no-repeat;background-position:center,left center,right center;background-size:cover,12px 34px,12px 34px`;

  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:14px">
    <tr>
      <td class="${vip ? "ef-ticket" : "ef-ticket ef-ticket-notched"}" style="background-color:${ctx.theme.card};${background};border-radius:20px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="table-layout:fixed">
          <tr>
            <td class="ef-ticket-left" width="55%" valign="top" style="padding:18px 6px 16px 18px">${leftBlock}</td>
            <td class="ef-ticket-right" width="45%" valign="top" style="padding:18px 16px 16px 8px">${rightBlock}</td>
          </tr>
          <tr>
            <td class="ef-ticket-foot" colspan="2" style="padding:0 18px 14px 18px">
              <div class="ef-ticket-tagline" style="border-top:1px solid rgba(255,255,255,0.14);padding-top:10px;text-align:center;${FONT};font-size:8px;line-height:11px;letter-spacing:1.5px;color:${vip ? "#b9a782" : "#8477a3"};text-transform:uppercase">${BRAND} &middot; Ingressos que aproximam</div>
            </td>
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
  const plural = input.ticketCount !== 1;

  const showInlineDownload = input.ticketCount > 1;
  const qrReleased = input.tickets.every((ticket) => ticket.qrImageSrc);

  const cards = input.tickets
    .map((ticket) =>
      ticketCard(ticket, {
        eventTitle: input.eventTitle,
        startsAt: input.eventStartsAt,
        assetsBaseUrl: input.assetsBaseUrl,
        logoDarkUrl: theme.vip ? asset(input.assetsBaseUrl, VIP_LOGO_WHITE) : input.logoDarkUrl,
        qrLockedImageUrl: input.qrLockedImageUrl,
        qrCodeLocked: input.qrCodeLocked,
        qrCodeReleaseAt: input.qrCodeReleaseAt,
        showInlineDownload,
        orderUrl: input.orderUrl,
        theme,
      })
    )
    .join("");

  // "06 de novembro, 22h00": the two halves never break inside, so on a phone
  // it wraps cleanly as date / time instead of leaving a word alone on a line.
  const [whenDay, whenTime] = formatLongDayMonthTime(input.eventStartsAt).split(", ");
  const whenHtml = `<span style="white-space:nowrap">${whenDay},</span> <span style="white-space:nowrap">${whenTime}</span>`;

  // Action row: equal-width buttons, so every label has to fit a third of a
  // phone screen on one line, icon included. "Abrir ingresso" is the widest
  // that fits: keep new labels no wider than it.
  const buttons = [
    pillButton({ href: input.orderUrl, iconUrl: iconWhite("ticket-open"), label: theme.vip ? (plural ? "Ver convites" : "Ver convite") : "Abrir ingresso", variant: "primary", theme }),
    ...(input.ticketCount === 1 && input.tickets[0]
      ? [pillButton({ href: input.tickets[0].pdfUrl, iconUrl: iconAccent("download"), label: "Baixar PDF", variant: "light", textColor: theme.ink, theme })]
      : []),
    pillButton({ href: input.createAccountUrl, iconUrl: iconAccent("person"), label: isTransfer ? "Minha conta" : "Criar conta", variant: "light", textColor: theme.accentText, theme }),
  ];
  const buttonWidth = `${(100 / buttons.length).toFixed(2)}%`;
  const buttonCells = buttons
    .map((button, index) => {
      const padding = index === 0 ? "0 4px 0 0" : index === buttons.length - 1 ? "0 0 0 4px" : "0 2px";
      return `<td width="${buttonWidth}" valign="top" style="padding:${padding}">${button}</td>`;
    })
    .join("");

  return `
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="color-scheme" content="light only" />
    <meta name="supported-color-schemes" content="light only" />
    <title>${theme.vip ? "Bem-vindo à experiência Premium" : `${escapeHtml(ctx.possessive)} já ${ctx.verb}`}</title>
    <style>
      :root { color-scheme: light only; supported-color-schemes: light only; }
      /* Inline sizes are the phone layout. This only enlarges it on wide screens. */
      /* Phones narrower than any current model: the icon gives way so the label still fits. */
      @media screen and (max-width:309px) {
        .ef-btn-icon { display:none !important; }
      }
      @media screen and (min-width:620px) {
        .ef-shell-padding { padding:24px 16px !important; }
        .ef-section { padding-left:32px !important; padding-right:32px !important; }
        .ef-hero { padding:32px 32px 28px 32px !important; }
        .ef-hero-logo { width:110px !important; }
        .ef-hero-title { font-size:34px !important; line-height:39px !important; }
        .ef-hero-tagline { font-size:12px !important; letter-spacing:3px !important; }
        .ef-greeting { font-size:20px !important; line-height:26px !important; }
        .ef-copy { font-size:14px !important; line-height:22px !important; }
        .ef-info-cell { padding-left:20px !important; padding-right:20px !important; }
        .ef-info-icon-cell { width:40px !important; }
        .ef-info-icon { width:40px !important; height:40px !important; }
        .ef-info-label { font-size:11px !important; line-height:14px !important; }
        .ef-info-value { font-size:15px !important; line-height:20px !important; }
        .ef-ticket-notched { background-size:cover,20px 56px,20px 56px !important; }
        .ef-ticket-left { padding:26px 12px 22px 30px !important; }
        .ef-ticket-right { padding:26px 26px 22px 12px !important; }
        .ef-ticket-foot { padding:0 30px 18px 30px !important; }
        .ef-ticket-tagline { font-size:9px !important; letter-spacing:2px !important; }
        .ef-card-logo { width:84px !important; }
        .ef-card-eyebrow { font-size:10px !important; }
        .ef-card-title { font-size:24px !important; line-height:28px !important; }
        .ef-card-name { font-size:16px !important; line-height:21px !important; }
        .ef-pill { padding:10px 12px !important; }
        .ef-pill-label { font-size:10px !important; line-height:12px !important; }
        .ef-pill-value { font-size:15px !important; line-height:19px !important; }
        .ef-qr-label { font-size:10px !important; padding-top:12px !important; }
        .ef-qr-code { font-size:10.5px !important; }
        .ef-qr-caption { font-size:10.5px !important; line-height:15px !important; }
        .ef-btn { font-size:14px !important; line-height:18px !important; padding-top:13px !important; padding-bottom:13px !important; }
        .ef-btn-icon { width:15px !important; height:15px !important; vertical-align:-3px !important; margin-right:7px !important; }
        .ef-warning-title { font-size:13px !important; line-height:18px !important; }
        .ef-warning-copy { font-size:12px !important; line-height:18px !important; }
        .ef-footer-copy { font-size:12px !important; line-height:18px !important; }
        .ef-footer-logo { width:92px !important; }
        .ef-footer-slogan { font-size:10px !important; line-height:13px !important; }
      }
    </style>
  </head>
  <body class="ef-outer" style="margin:0;padding:0;background-color:${theme.outer}">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(ctx.preheader)}</div>
    <table class="ef-outer" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${theme.outer}">
      <tr>
        <td class="ef-shell-padding" align="center" style="padding:8px 0">
          <table class="ef-sheet" role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background-color:${theme.sheet};border-radius:20px;overflow:hidden">

            <!-- Hero -->
            <tr>
              <td class="ef-hero" style="background-color:${theme.hero};background-image:${theme.vip ? "linear-gradient(rgba(12,11,10,0.54),rgba(12,11,10,0.54))," : ""}url(${escapeAttr(asset(input.assetsBaseUrl, theme.vip ? "vip-bg.png" : "hero-bg.png"))});background-size:cover;background-position:center right;background-repeat:no-repeat;padding:24px 18px 22px 18px">
                <img class="ef-hero-logo" src="${escapeAttr(theme.vip ? asset(input.assetsBaseUrl, VIP_LOGO_WHITE) : input.logoDarkUrl)}" width="92" alt="${BRAND}" style="display:block;border:0;width:92px;height:auto" />
                <div class="ef-hero-title" style="${FONT};font-size:27px;line-height:31px;font-weight:800;color:${theme.vip ? "#f2efe8" : "#ffffff"};margin-top:20px">${theme.vip ? "Bem-vindo à" : escapeHtml(ctx.possessive)}</div>
                <div class="ef-hero-title" style="${FONT};font-size:27px;line-height:31px;font-weight:800;color:${theme.vip ? "#f2efe8" : theme.accent};margin-top:1px">${theme.vip ? "experiência Premium." : `já ${escapeHtml(ctx.verb)}.`}</div>
                <div class="ef-hero-tagline" style="${FONT};font-size:10px;line-height:14px;font-weight:700;letter-spacing:2.5px;color:${theme.vip ? "#c4b596" : "#c9c1de"};text-transform:uppercase;margin-top:12px">${theme.vip ? (plural ? "Ingressos VIP confirmados" : "Ingresso VIP confirmado") : "Nos vemos no evento!"}</div>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td class="ef-section" style="padding:22px 12px 0 12px;${FONT}">
                <div class="ef-ink ef-greeting" style="font-size:18px;line-height:23px;font-weight:800;color:${theme.ink}">Olá, ${escapeHtml(input.buyerName)}!</div>
                <div class="ef-muted ef-copy" style="font-size:13px;line-height:20px;color:${theme.muted};margin-top:6px">
                  ${theme.vip
                    ? `${escapeHtml(ctx.inviter)} emitiu ${vipTicketCount(input.ticketCount)} em seu nome para ${escapeHtml(input.eventTitle)}. ${plural ? "Eles são pessoais e intransferíveis" : "Ele é pessoal e intransferível"}.`
                    : isTransfer
                    ? `${escapeHtml(input.transfer!.fromName)} transferiu ${escapeHtml(ctx.ticketLine)} para você e já ${plural ? "estão disponíveis" : "está disponível"} abaixo.`
                    : `${input.courtesy ? "Seu convite foi confirmado" : input.free ? "Sua inscrição foi confirmada" : "Sua compra foi aprovada"} e ${escapeHtml(ctx.ticketLine)} já ${plural ? "estão disponíveis" : "está disponível"} abaixo.`}
                  ${qrReleased
                    ? "O QR Code de entrada já está liberado: use o que aparece abaixo, o PDF ou o botão para abrir o ingresso."
                    : theme.vip
                      ? "O QR Code será liberado conforme a programação do evento; você poderá baixar o PDF atualizado depois."
                      : "O QR Code de entrada fica protegido dentro do ingresso — abra pelo botão abaixo quando for usar."}
                </div>
              </td>
            </tr>

            <!-- Info grid: 2 x 2, equal columns -->
            <tr>
              <td class="ef-section" style="padding:16px 12px 0 12px">
                <table class="ef-info" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${theme.info};border-radius:14px;table-layout:fixed">
                  <tr>
                    <td class="ef-info-cell" width="50%" valign="top" style="padding:14px 6px 7px 10px">${infoCell(iconBadge("calendar"), "Evento", escapeHtml(input.eventTitle), theme)}</td>
                    <td class="ef-info-cell" width="50%" valign="top" style="padding:14px 10px 7px 6px">${infoCell(iconBadge("clock"), "Quando", whenHtml, theme)}</td>
                  </tr>
                  <tr>
                    <td class="ef-info-cell" width="50%" valign="top" style="padding:7px 6px 14px 10px">${infoCell(iconBadge("pin"), "Local", escapeHtml(input.eventVenue), theme)}</td>
                    <td class="ef-info-cell" width="50%" valign="top" style="padding:7px 10px 14px 6px">${isTransfer || theme.vip
                      ? infoCell(iconBadge("ticket"), theme.vip ? "Convite VIP" : "Ingresso", `<span style="white-space:nowrap">${escapeHtml(formatShortCode(input.tickets[0]?.shortCode ?? ""))}</span>`, theme)
                      : infoCell(iconBadge("ticket"), "Pedido", `<span style="white-space:nowrap">${ctx.code}</span>`, theme)}</td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Ticket card(s) -->
            <tr>
              <td class="ef-section" style="padding:16px 12px 0 12px">
                ${cards}
              </td>
            </tr>

            <!-- CTAs: equal-width buttons on one row -->
            <tr>
              <td class="ef-section" style="padding:0 12px 16px 12px">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="table-layout:fixed">
                  <tr>${buttonCells}</tr>
                </table>
              </td>
            </tr>

            <!-- Warning -->
            <tr>
              <td class="ef-section" style="padding:0 12px 20px 12px">
                <table class="ef-warning" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${theme.vip ? "#f3f0e9" : "#fdf3d9"};border-radius:14px">
                  <tr>
                    <td width="22" valign="top" style="padding:13px 0 13px 12px"><img src="${iconAmber("shield")}" width="22" height="22" alt="" style="display:block;border:0" /></td>
                    <td style="padding:13px 12px 13px 8px;${FONT}">
                      <div class="ef-warning-title" style="font-size:12px;line-height:16px;font-weight:800;color:${theme.vip ? "#514637" : "#6b4e0a"}">${theme.vip ? "Convite VIP nominal e intransferível." : qrReleased ? "Este e-mail é o seu ingresso: o QR Code acima já vale na entrada." : "Este link é pessoal e o QR Code só existe dentro do ingresso."}</div>
                      <div class="ef-warning-copy" style="font-size:11px;line-height:16px;color:${theme.vip ? "#71695c" : "#8a6d1f"};margin-top:3px">${theme.vip ? "Apresente um documento com foto na entrada. Não encaminhe este convite nem compartilhe o QR Code; ele só pode ser usado uma vez." : `${qrReleased ? "Não encaminhe nem publique este e-mail: quem apresentar o QR Code primeiro entra." : "Não compartilhe este e-mail."} Cada QR Code é único e só pode ser usado uma vez na entrada.`}</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Footer: copy on the left, brand on the right -->
            <tr>
              <td class="ef-footer ef-section" style="padding:16px 12px 20px 12px;border-top:1px solid ${theme.vip ? "#e1ddd5" : "#efeaf7"}">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td class="ef-muted ef-footer-copy" valign="middle" style="${FONT};font-size:11px;line-height:16px;color:${theme.muted};padding-right:12px">
                      ${theme.vip ? `Ingresso VIP emitido com segurança pela ${BRAND}.` : isTransfer ? `Transferência confirmada com segurança pela ${BRAND}.` : `${input.courtesy ? "Convite emitido" : input.free ? "Inscrição processada" : "Compra processada"} com segurança pela ${BRAND}.`}<br />
                      Em caso de dúvidas, <a class="ef-link" href="${escapeAttr(input.createAccountUrl)}" style="color:${theme.vip ? theme.accentText : theme.accent}">fale com nosso time de suporte</a>.
                    </td>
                    <td valign="middle" align="right" width="96">
                      <img class="ef-footer-logo" src="${escapeAttr(theme.vip ? asset(input.assetsBaseUrl, VIP_LOGO_DARK) : input.logoLightUrl)}" width="76" alt="${BRAND}" style="display:block;border:0;width:76px;height:auto;margin-left:auto" />
                      <div class="ef-muted ef-footer-slogan" style="${FONT};font-size:8.5px;line-height:11px;color:${theme.muted};margin-top:6px;text-align:right;white-space:nowrap">Mais encontros,<br />mais hist&oacute;rias.</div>
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
