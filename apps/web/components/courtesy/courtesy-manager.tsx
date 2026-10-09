"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, CheckCircle2, Clock, Copy, ListPlus, Loader2, MailCheck, MailWarning, Plus, Search, Send, Trash2, XCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { MAX_GUESTS_PER_REQUEST, MAX_TICKETS_PER_GUEST, parseGuestList, validateGuests, type GuestDraft } from "@/lib/courtesy-guests";
import { dateTime } from "@/lib/utils";

type CourtesyTicket = {
  id: string;
  code: string;
  guestName: string;
  guestEmail: string;
  label: string;
  status: "AVAILABLE" | "USED" | "CANCELED";
  usedAt: string | null;
  createdAt: string;
  issuedBy: string | null;
  emailStatus: "PENDING" | "SENT" | "FAILED" | "SKIPPED" | null;
  ticketUrl: string | null;
};

type CourtesyList = {
  summary: { issued: number; checkedIn: number; pending: number; canceled: number };
  tickets: CourtesyTicket[];
};

export type CourtesyManagerProps = {
  /** Chave de cache do React Query: muda junto com o evento selecionado. */
  queryKey: readonly unknown[];
  listUrl: string;
  issueUrl: string;
  cancelUrl: (ticketId: string) => string;
  /** Nome impresso no ingresso quando o campo fica em branco. */
  defaultLabel: string;
  /** Texto do cartão de emissão, diferente para o admin e para o organizador. */
  issueTitle: string;
  issueDescription: string;
  /** Só consulta: esconde a emissão e o cancelamento (admin auditando cortesias do organizador). */
  readOnly?: boolean;
  requireExistingAccount?: boolean;
};

type VipRecipient = { id: string; name: string; email: string };
type VipRecipientLookup = { exists: boolean; user: VipRecipient | null };

const emptyGuest = (): GuestDraft => ({ name: "", email: "", quantity: 1 });

export function CourtesyManager({ queryKey, listUrl, issueUrl, cancelUrl, defaultLabel, issueTitle, issueDescription, readOnly = false, requireExistingAccount = false }: CourtesyManagerProps) {
  const queryClient = useQueryClient();
  const [guests, setGuests] = useState<GuestDraft[]>([emptyGuest()]);
  const [label, setLabel] = useState("");
  const [note, setNote] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [foundRecipient, setFoundRecipient] = useState<{ index: number; email: string; user: VipRecipient | null } | null>(null);

  const findRecipient = useMutation({
    mutationFn: ({ email }: { index: number; email: string }) => api<VipRecipientLookup>("/admin/courtesy/recipient", {
      method: "POST",
      body: JSON.stringify({ email: email.trim().toLowerCase() })
    }),
    onSuccess: (result, variables) => setFoundRecipient({ index: variables.index, email: variables.email.trim().toLowerCase(), user: result.user }),
    onError: () => setFoundRecipient(null)
  });

  const list = useQuery<CourtesyList>({ queryKey, queryFn: () => api<CourtesyList>(listUrl) });

  const issue = useMutation({
    mutationFn: (payload: { guests: GuestDraft[]; label?: string; note?: string; sendEmail: boolean }) =>
      api<CourtesyList & { issuedTickets: number; issuedOrders: number }>(issueUrl, { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: (result) => {
      queryClient.setQueryData(queryKey, { summary: result.summary, tickets: result.tickets });
      setGuests([emptyGuest()]);
      setFoundRecipient(null);
      setNote("");
      setPasteText("");
      setPasteOpen(false);
      setFormError(null);
      setFeedback(
        `${result.issuedTickets} ${result.issuedTickets === 1 ? "ingresso emitido" : "ingressos emitidos"} para ${result.issuedOrders} ${result.issuedOrders === 1 ? "convidado" : "convidados"}.` +
        (sendEmail ? " O envio do e-mail foi solicitado; confira o status na lista abaixo." : " Nenhum e-mail foi enviado: copie o link de cada ingresso na lista abaixo.")
      );
    },
    onError: () => setFeedback(null)
  });

  const cancel = useMutation({
    mutationFn: (ticketId: string) => api(cancelUrl(ticketId), { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey })
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const tickets = list.data?.tickets ?? [];
    if (!term) return tickets;
    return tickets.filter((ticket) =>
      ticket.guestName.toLowerCase().includes(term) || ticket.guestEmail.toLowerCase().includes(term) || ticket.code.toLowerCase().includes(term));
  }, [list.data, search]);

  const totalToIssue = guests.reduce((sum, guest) => sum + (guest.name.trim() || guest.email.trim() ? guest.quantity : 0), 0);

  function updateGuest(index: number, patch: Partial<GuestDraft>) {
    setGuests((current) => current.map((guest, i) => (i === index ? { ...guest, ...patch } : guest)));
  }

  function applyPaste() {
    const parsed = parseGuestList(pasteText);
    if (parsed.errors.length) {
      setFormError(parsed.errors.join(" "));
      return;
    }
    if (!parsed.guests.length) {
      setFormError("Cole pelo menos uma linha com nome e e-mail.");
      return;
    }
    const typed = guests.filter((guest) => guest.name.trim() || guest.email.trim());
    const merged = [...typed, ...parsed.guests];
    if (merged.length > MAX_GUESTS_PER_REQUEST) {
      setFormError(`Envie no máximo ${MAX_GUESTS_PER_REQUEST} convidados por vez. Divida a lista em partes.`);
      return;
    }
    setGuests(merged);
    setPasteText("");
    setPasteOpen(false);
    setFormError(null);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const problem = validateGuests(guests);
    if (problem) {
      setFormError(problem);
      return;
    }
    if (requireExistingAccount && guests.some((guest) => !guest.userId)) {
      setFormError("Pesquise e selecione uma conta existente para cada convidado VIP.");
      return;
    }
    setFormError(null);
    setFeedback(null);
    issue.mutate({
      guests: guests
        .filter((guest) => guest.name.trim() || guest.email.trim())
        .map((guest) => ({ name: guest.name.trim(), email: guest.email.trim().toLowerCase(), quantity: guest.quantity, userId: guest.userId })),
      label: label.trim() || undefined,
      note: note.trim() || undefined,
      sendEmail
    });
  }

  async function copyLink(ticket: CourtesyTicket) {
    if (!ticket.ticketUrl) return;
    try {
      await navigator.clipboard.writeText(ticket.ticketUrl);
      setCopiedId(ticket.id);
      setTimeout(() => setCopiedId((current) => (current === ticket.id ? null : current)), 2000);
    } catch {
      window.prompt("Copie o link do ingresso:", ticket.ticketUrl);
    }
  }

  const summary = list.data?.summary;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryTile label="Emitidos" value={summary?.issued} loading={list.isLoading} />
        <SummaryTile label="Entraram" value={summary?.checkedIn} loading={list.isLoading} tone="text-emerald-600 dark:text-emerald-400" />
        <SummaryTile label="Ainda não entraram" value={summary?.pending} loading={list.isLoading} />
        <SummaryTile label="Cancelados" value={summary?.canceled} loading={list.isLoading} tone="text-muted-foreground" />
      </div>

      {!readOnly && <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">{issueTitle}</CardTitle>
          <CardDescription>{issueDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={submit}>
            <div className="space-y-2">
              {guests.map((guest, index) => (
                <div key={index} className="space-y-2">
                  <div className="grid gap-2 sm:grid-cols-[1fr_1fr_88px_40px]">
                    <Input aria-label={`Nome do convidado ${index + 1}`} placeholder={requireExistingAccount ? "Selecione uma conta" : "Nome completo"} value={guest.name}
                      readOnly={requireExistingAccount}
                      onChange={(e) => updateGuest(index, { name: e.target.value })} />
                    <div className="flex gap-2">
                      <Input aria-label={`E-mail do convidado ${index + 1}`} type="email" placeholder="email@exemplo.com" value={guest.email}
                        onChange={(e) => {
                          updateGuest(index, { email: e.target.value, name: requireExistingAccount ? "" : guest.name, userId: undefined });
                          setFoundRecipient(null);
                        }} />
                      {requireExistingAccount && (
                        <Button type="button" variant="outline" size="icon" title="Buscar conta" aria-label={`Buscar conta do convidado ${index + 1}`}
                          disabled={!guest.email.trim() || findRecipient.isPending}
                          onClick={() => findRecipient.mutate({ index, email: guest.email })}>
                          {findRecipient.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                        </Button>
                      )}
                    </div>
                    <Input aria-label={`Quantidade de ingressos do convidado ${index + 1}`} type="number" min={1} max={MAX_TICKETS_PER_GUEST} value={guest.quantity}
                      onChange={(e) => updateGuest(index, { quantity: Math.max(1, Math.min(MAX_TICKETS_PER_GUEST, Number(e.target.value) || 1)) })} />
                    <Button type="button" variant="ghost" size="icon" title="Remover convidado" disabled={guests.length === 1}
                      onClick={() => { setGuests((current) => current.filter((_, i) => i !== index)); setFoundRecipient(null); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  {requireExistingAccount && guest.userId && (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400">Conta selecionada: {guest.name} ({guest.email})</p>
                  )}
                  {requireExistingAccount && foundRecipient?.index === index && foundRecipient.email === guest.email.trim().toLowerCase() && !guest.userId && (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
                      {foundRecipient.user ? (
                        <>
                          <span>Conta encontrada: <strong>{foundRecipient.user.name}</strong> ({foundRecipient.user.email})</span>
                          <Button type="button" size="sm" onClick={() => {
                            updateGuest(index, { name: foundRecipient.user!.name, email: foundRecipient.user!.email, userId: foundRecipient.user!.id });
                            setFoundRecipient(null);
                          }}>Selecionar esta conta</Button>
                        </>
                      ) : <span>Nenhuma conta encontrada. Confira o e-mail antes de emitir o VIP.</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" disabled={guests.length >= MAX_GUESTS_PER_REQUEST}
                onClick={() => setGuests((current) => [...current, emptyGuest()])}>
                <Plus className="h-4 w-4" /> Adicionar convidado
              </Button>
              {!requireExistingAccount && (
                <Button type="button" variant="outline" size="sm" onClick={() => setPasteOpen((open) => !open)}>
                  <ListPlus className="h-4 w-4" /> Colar lista
                </Button>
              )}
            </div>

            {pasteOpen && (
              <div className="space-y-2 rounded-xl border bg-muted/30 p-3">
                <Label htmlFor="courtesy-paste">Uma pessoa por linha: nome, e-mail e, se quiser, a quantidade</Label>
                <textarea id="courtesy-paste" rows={5} value={pasteText} onChange={(e) => setPasteText(e.target.value)}
                  placeholder={"Ana Souza, ana@exemplo.com\nLeo Lima, leo@exemplo.com, 2"}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                <Button type="button" size="sm" variant="secondary" onClick={applyPaste}>Adicionar à lista</Button>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="courtesy-label">Nome no ingresso</Label>
                <Input id="courtesy-label" maxLength={60} placeholder={defaultLabel} value={label} onChange={(e) => setLabel(e.target.value)} />
                <p className="text-xs text-muted-foreground">É o que aparece no ingresso e na tela da portaria. Em branco: {defaultLabel}.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="courtesy-note">Observação interna</Label>
                <Input id="courtesy-note" maxLength={300} placeholder="Opcional. Ex.: patrocinador, imprensa" value={note} onChange={(e) => setNote(e.target.value)} />
                <p className="text-xs text-muted-foreground">Fica só no registro de quem emitiu. O convidado não vê.</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <input type="checkbox" id="courtesy-send-email" className="h-4 w-4 rounded border accent-primary" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} />
              <Label htmlFor="courtesy-send-email">Enviar o ingresso por e-mail para cada convidado</Label>
            </div>

            {(formError || issue.error) && <p className="text-sm text-destructive" role="alert">{formError ?? issue.error?.message}</p>}
            {findRecipient.error && <p className="text-sm text-destructive" role="alert">Não foi possível buscar a conta. Tente novamente.</p>}
            {feedback && <p className="text-sm text-emerald-600 dark:text-emerald-400" role="status">{feedback}</p>}

            <Button type="submit" disabled={issue.isPending}>
              {issue.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {issue.isPending ? "Emitindo…" : totalToIssue > 1 ? `Emitir ${totalToIssue} ingressos` : "Emitir ingresso"}
            </Button>
          </form>
        </CardContent>
      </Card>}

      <Card className="shadow-sm">
        <CardHeader className="flex-col gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base">Ingressos emitidos</CardTitle>
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar por nome, e-mail ou código" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {list.isLoading && <Skeleton className="h-40 w-full" />}
          {list.error && <p className="text-sm text-destructive">{list.error.message}</p>}
          {cancel.error && <p className="text-sm text-destructive" role="alert">{cancel.error.message}</p>}
          {!list.isLoading && !list.error && filtered.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {search ? "Nenhum ingresso encontrado para essa busca." : "Nenhum ingresso emitido ainda."}
            </p>
          )}
          {filtered.map((ticket) => (
            <div key={ticket.id} className="flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-semibold">{ticket.guestName}</p>
                  <Badge variant="outline">{ticket.label}</Badge>
                  <StatusBadge ticket={ticket} />
                </div>
                <p className="truncate text-xs text-muted-foreground">{ticket.guestEmail}</p>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="font-mono">{ticket.code}</span>
                  <span>Emitido em {dateTime(ticket.createdAt)}{ticket.issuedBy ? ` por ${ticket.issuedBy}` : ""}</span>
                  <EmailStatus status={ticket.emailStatus} />
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                {!readOnly && ticket.ticketUrl && ticket.status !== "CANCELED" && (
                  <Button type="button" variant="outline" size="sm" onClick={() => copyLink(ticket)}>
                    <Copy className="h-4 w-4" /> {copiedId === ticket.id ? "Link copiado" : "Copiar link"}
                  </Button>
                )}
                {!readOnly && ticket.status === "AVAILABLE" && (
                  <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" disabled={cancel.isPending}
                    onClick={() => {
                      if (confirm(`Cancelar o ingresso de ${ticket.guestName}? O QR Code deixa de valer na portaria.`)) cancel.mutate(ticket.id);
                    }}>
                    <Ban className="h-4 w-4" /> Cancelar
                  </Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryTile({ label, value, loading, tone }: { label: string; value?: number; loading: boolean; tone?: string }) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm dark:bg-card">
      <p className="text-xs text-muted-foreground">{label}</p>
      {loading ? <Skeleton className="mt-1 h-7 w-12" /> : <p className={`text-xl font-extrabold tracking-tight ${tone ?? "text-foreground"}`}>{value ?? 0}</p>}
    </div>
  );
}

function StatusBadge({ ticket }: { ticket: CourtesyTicket }) {
  if (ticket.status === "USED") {
    return (
      <Badge variant="default" className="gap-1">
        <CheckCircle2 className="h-3 w-3" /> Entrou{ticket.usedAt ? ` em ${dateTime(ticket.usedAt)}` : ""}
      </Badge>
    );
  }
  if (ticket.status === "CANCELED") {
    return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Cancelado</Badge>;
  }
  return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" /> Ainda não entrou</Badge>;
}

function EmailStatus({ status }: { status: CourtesyTicket["emailStatus"] }) {
  if (status === "SENT") return <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400"><MailCheck className="h-3 w-3" /> E-mail enviado</span>;
  if (status === "FAILED") return <span className="inline-flex items-center gap-1 text-destructive"><MailWarning className="h-3 w-3" /> E-mail falhou: envie o link</span>;
  if (status === "PENDING") return <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> E-mail na fila</span>;
  return <span>Sem e-mail: envie o link</span>;
}
