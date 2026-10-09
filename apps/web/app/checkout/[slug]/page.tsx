"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Mail,
  ShieldCheck,
  Tag,
  UserRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthHydration } from "@/hooks/use-auth-hydration";
import { api, ApiError } from "@/lib/api";
import { safeCheckoutReturnPath, withCheckoutReturn } from "@/lib/checkout-return";
import { formatBrazilPhone, formatCpfOrCnpj, hasFullName, normalizeBrazilPhone, onlyDigits } from "@/lib/br-format";
import { getCurrentTicketLots } from "@/lib/ticket-lots";
import { money } from "@/lib/utils";
import { type AuthUser, useAuthStore } from "@/stores/auth-store";
import type { EventFlowEvent } from "@/types/eventflow";

type CheckoutResponse = {
  id: string;
  orderId: string;
  orderAccessToken?: string;
  status: string;
  totalCents: number;
  checkoutUrl?: string;
};

const buyerSchema = z.object({
  buyerName: z
    .string()
    .min(2, "Informe seu nome.")
    .refine(hasFullName, "Informe nome e sobrenome."),
  buyerDocument: z
    .string()
    .min(1, "Informe seu CPF ou CNPJ.")
    .refine(
      (value) => [11, 14].includes(onlyDigits(value).length),
      "Informe um CPF ou CNPJ válido.",
    ),
  buyerPhone: z
    .string()
    .min(1, "Informe seu telefone.")
    .refine(
      (value) => normalizeBrazilPhone(value).length === 11,
      "Informe um telefone com DDD.",
    ),
  paymentMethod: z.literal("PIX"),
});

/** Parse items from query string: "id1:qty1,id2:qty2" */
function parseItemsParam(raw: string | null): Record<string, number> {
  if (!raw) return {};
  const result: Record<string, number> = {};

  for (const pair of raw.split(",")) {
    const [id, qtyStr] = pair.split(":");
    if (id && qtyStr) {
      const qty = parseInt(qtyStr, 10);
      if (!isNaN(qty) && qty > 0) {
        result[id] = qty;
      }
    }
  }

  return result;
}

function CheckoutForm() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialItems = useMemo(
    () => parseItemsParam(searchParams.get("items")),
    [searchParams],
  );
  const invite = searchParams.get("invite") ?? undefined;

  const [quantities, setQuantities] =
    useState<Record<string, number>>(initialItems);

  // Read promoter code from URL (?p=CODE or ?promoter=CODE) and persist in sessionStorage
  // so attribution survives any navigation within the checkout flow.
  const promoterCode = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    const fromUrl =
      searchParams.get("p") ?? searchParams.get("promoter") ?? undefined;
    if (fromUrl) {
      sessionStorage.setItem(`promoter_code_${slug}`, fromUrl);
      return fromUrl;
    }
    return sessionStorage.getItem(`promoter_code_${slug}`) ?? undefined;
  }, [searchParams, slug]);

  // Compra só com conta logada e e-mail confirmado: o pedido sai sempre no
  // e-mail da conta, então compra e conta nunca ficam em endereços diferentes.
  const authHydrated = useAuthHydration();
  const user = useAuthStore((state) => state.user);
  const updateUser = useAuthStore((state) => state.updateUser);

  // Para onde voltar depois de entrar, criar conta ou confirmar o e-mail: este
  // mesmo checkout, com os ingressos escolhidos e o código do promoter.
  const [returnPath, setReturnPath] = useState(`/checkout/${slug}`);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (promoterCode && !params.get("p") && !params.get("promoter")) {
      params.set("p", promoterCode);
    }
    const query = params.toString();
    const current = `/checkout/${slug}${query ? `?${query}` : ""}`;
    setReturnPath(safeCheckoutReturnPath(current) ?? `/checkout/${slug}`);
  }, [promoterCode, searchParams, slug]);

  const { data: event, isLoading } = useQuery({
    queryKey: ["checkout-event", slug, invite],
    queryFn: () =>
      api<EventFlowEvent>(`/events/public/${slug}${invite ? `?invite=${encodeURIComponent(invite)}` : ""}`, { auth: false }),
  });

  const currentLots = useMemo(
    () => (event ? getCurrentTicketLots(event.ticketTypes) : []),
    [event],
  );
  const currentTicketIds = useMemo(
    () => new Set(currentLots.map(({ ticket }) => ticket.id)),
    [currentLots],
  );
  const purchasableQuantities = useMemo(
    () => Object.fromEntries(Object.entries(quantities).filter(([ticketId, quantity]) => currentTicketIds.has(ticketId) && quantity > 0)),
    [currentTicketIds, quantities],
  );

  useEffect(() => {
    if (!event) return;
    setQuantities((prev) => {
      const next = Object.fromEntries(Object.entries(prev).filter(([ticketId, quantity]) => currentTicketIds.has(ticketId) && quantity > 0));
      return Object.keys(next).length === Object.keys(prev).length ? prev : next;
    });
  }, [currentTicketIds, event]);

  // Cupom: validado na API antes de pagar; o uso só é contado quando o pedido é criado.
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
  const couponMutation = useMutation({
    mutationFn: (code: string) =>
      api<AppliedCoupon>(`/checkout/${slug}/coupon`, {
        method: "POST",
        auth: false,
        body: JSON.stringify({ code, inviteToken: invite }),
      }),
    onSuccess: (coupon) => {
      setAppliedCoupon(coupon);
      setCouponInput("");
    },
  });
  const applyCoupon = () => {
    const code = couponInput.trim();
    if (!code || couponMutation.isPending) return;
    couponMutation.mutate(code);
  };
  const removeCoupon = () => {
    setAppliedCoupon(null);
    couponMutation.reset();
  };

  const form = useForm<z.infer<typeof buyerSchema>>({
    resolver: zodResolver(buyerSchema),
    defaultValues: { paymentMethod: "PIX" },
  });

  // Conveniência: nome e telefone da conta já vêm preenchidos (podem ser editados).
  useEffect(() => {
    if (!user) return;
    if (!form.getValues("buyerName") && user.name) {
      form.setValue("buyerName", user.name);
    }
    if (!form.getValues("buyerPhone") && user.phone) {
      form.setValue("buyerPhone", formatBrazilPhone(user.phone));
    }
  }, [form, user]);

  const mutation = useMutation({
    mutationFn: (data: z.infer<typeof buyerSchema>) =>
      api<CheckoutResponse>(`/checkout/${slug}`, {
        method: "POST",
        body: JSON.stringify({
          ...data,
          // A API usa sempre o e-mail da conta; enviado só por compatibilidade.
          buyerEmail: user?.email,
          returnOrigin: window.location.origin,
          inviteToken: invite,
          promoterCode,
          couponCode: appliedCoupon?.code,
          buyerName: data.buyerName.trim().replace(/\s+/g, " "),
          buyerDocument: onlyDigits(data.buyerDocument),
          buyerPhone: normalizeBrazilPhone(data.buyerPhone),
          items: Object.entries(purchasableQuantities)
            .filter(([, quantity]) => quantity > 0)
            .map(([ticketTypeId, quantity]) => ({ ticketTypeId, quantity })),
        }),
      }),
    onSuccess: (data) => {
      sessionStorage.removeItem(`promoter_code_${slug}`);
      if (data.orderId && data.orderAccessToken) {
        window.localStorage.setItem(
          "eventflow:last-checkout",
          JSON.stringify({
            orderId: data.orderId,
            accessToken: data.orderAccessToken,
            createdAt: Date.now(),
          }),
        );
      }
      if (data.checkoutUrl) {
        window.location.assign(data.checkoutUrl);
      } else if (data.status === "PAID" && data.orderId && data.orderAccessToken) {
        // Pedido de total zero: já foi confirmado pela API, sem etapa de pagamento.
        router.push(freeOrderSuccessHref(data));
      }
    },
    onError: (error) => {
      // A API recusou por e-mail não confirmado: atualiza a conta para a tela
      // de confirmação aparecer no lugar do formulário.
      if (error instanceof ApiError && error.status === 403) {
        void api<AuthUser>("/auth/me")
          .then((currentUser) => updateUser(currentUser))
          .catch(() => undefined);
      }
    },
  });

  const subtotal = useMemo(() => {
    return (
      event?.ticketTypes.reduce(
        (sum, ticket) => sum + (purchasableQuantities[ticket.id] ?? 0) * ticket.priceCents,
        0,
      ) ?? 0
    );
  }, [event, purchasableQuantities]);
  // Mesma regra da API: desconto sobre o subtotal, taxa de 8% sobre o valor já com desconto.
  const discount = appliedCoupon
    ? Math.min(
        subtotal,
        Math.round(subtotal * (appliedCoupon.discountPercent / 100)) +
          appliedCoupon.discountFixedCents,
      )
    : 0;
  const discountedSubtotal = subtotal - discount;
  const feeAbsorbed = Boolean(event?.feeAbsorbedByOrganizer);
  const fee = feeAbsorbed ? 0 : Math.round(discountedSubtotal * 0.08);
  const total = discountedSubtotal + fee;
  const hasItems = Object.values(purchasableQuantities).some((q) => q > 0);
  // Evento gratuito ou cupom de 100%: a API confirma na hora, sem InfinitePay.
  const isFree = hasItems && total === 0;

  if (isLoading || !authHydrated) return <Skeleton className="m-6 h-[620px]" />;

  if (!user) {
    return <CheckoutAccountGate slug={slug} eventTitle={event?.title} returnPath={returnPath} />;
  }

  if (user.emailVerified === false && !mutation.data) {
    return <CheckoutVerifyEmailGate slug={slug} eventTitle={event?.title} email={user.email} returnPath={returnPath} />;
  }

  if (mutation.data && mutation.data.status === "PAID" && !mutation.data.checkoutUrl) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-6">
        <Card className="max-w-lg">
          <CardHeader>
            <CheckCircle2 className="h-10 w-10 text-primary" />
            <CardTitle>Inscrição confirmada</CardTitle>
            <CardDescription>
              Seu ingresso já foi emitido. Estamos abrindo a página do pedido.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href={freeOrderSuccessHref(mutation.data)}>Ver meu ingresso</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (mutation.data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-6">
        <Card className="max-w-lg">
          <CardHeader>
            <CheckCircle2 className="h-10 w-10 text-primary" />
            <CardTitle>Pedido criado</CardTitle>
            <CardDescription>
              Seu pagamento está pendente. A confirmação emitirá seus QR Codes
              automaticamente.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>Pedido: {mutation.data.orderId ?? mutation.data.id}</p>
            <p>Total: {money(mutation.data.totalCents)}</p>
            {mutation.data.checkoutUrl && (
              <Button asChild className="w-full gap-2">
                <a href={mutation.data.checkoutUrl}>
                  <ExternalLink className="h-4 w-4" />
                  Abrir checkout seguro
                </a>
              </Button>
            )}
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-30 glass border-b">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-5">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="gap-2 text-muted-foreground hover:text-foreground"
          >
            <Link href={`/eventos/${slug}`}>
              <ArrowLeft className="h-4 w-4" />
              Voltar ao evento
            </Link>
          </Button>
          <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-green-600" />
            Checkout seguro
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-6xl gap-6 px-5 py-8 lg:grid-cols-[1fr_380px]">
        <form
          className="space-y-6"
          onSubmit={form.handleSubmit((data) => mutation.mutate(data))}
        >
          <div>
            <h1 className="text-2xl font-semibold tracking-normal">Checkout</h1>
            <p className="text-sm text-muted-foreground">{event?.title}</p>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Seus ingressos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {currentLots.map(({ ticket, available }) => {
                const qty = purchasableQuantities[ticket.id] ?? 0;
                if (qty <= 0) return null;
                return (
                  <div
                    key={ticket.id}
                    className="flex items-center justify-between gap-4 rounded-xl border p-4"
                  >
                    <div>
                      <p className="font-medium">{ticket.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {money(ticket.priceCents)} × {qty}
                      </p>
                    </div>
                    <Input
                      className="w-20 text-center"
                      type="number"
                      min={0}
                      max={Math.min(available, ticket.limitPerBuy)}
                      value={qty}
                      onChange={(e) =>
                        setQuantities((state) => ({
                          ...state,
                          [ticket.id]: Math.min(
                            Number(e.target.value),
                            available,
                            ticket.limitPerBuy,
                          ),
                        }))
                      }
                    />
                  </div>
                );
              })}
              {Object.values(purchasableQuantities).every((q) => q <= 0) && (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  Nenhum ingresso selecionado.{" "}
                  <Link
                    href={`/eventos/${slug}`}
                    className="text-primary hover:underline"
                  >
                    Voltar ao evento
                  </Link>
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Dados pessoais</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Nome"
                error={form.formState.errors.buyerName?.message}
              >
                <Input {...form.register("buyerName")} />
              </Field>
              <Field label="E-mail da conta">
                <Input type="email" value={user.email} readOnly disabled aria-describedby="buyer-email-hint" />
                <p id="buyer-email-hint" className="text-xs text-muted-foreground">
                  Os ingressos ficam na sua conta e vão para este e-mail.
                </p>
              </Field>
              <Field
                label="CPF/CNPJ"
                error={form.formState.errors.buyerDocument?.message}
              >
                <Input
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="000.000.000-00"
                  {...form.register("buyerDocument", {
                    onChange: (event) => {
                      event.target.value = formatCpfOrCnpj(event.target.value);
                    },
                  })}
                />
              </Field>
              <Field
                label="Telefone"
                error={form.formState.errors.buyerPhone?.message}
              >
                <Input
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="+55 (33) 99999-9999"
                  {...form.register("buyerPhone", {
                    onChange: (event) => {
                      event.target.value = formatBrazilPhone(event.target.value);
                    },
                  })}
                />
              </Field>
              <input type="hidden" {...form.register("paymentMethod")} />
              <p className="text-sm text-muted-foreground">
                {isFree
                  ? "Inscrição gratuita: não há pagamento. Seu ingresso é emitido assim que você confirmar."
                  : "Na próxima etapa você escolhe como pagar (PIX ou cartão de crédito) no ambiente seguro da InfinitePay."}
              </p>
            </CardContent>
          </Card>
        </form>
        <Card className="h-fit sticky top-20">
          <CardHeader>
            <CardTitle>Resumo</CardTitle>
            <CardDescription>
              Revise os valores antes de confirmar.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="coupon-code">Cupom de desconto</Label>
              {appliedCoupon ? (
                <div className="flex items-center justify-between gap-2 rounded-md border border-green-600/30 bg-green-600/10 px-3 py-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2 font-medium text-green-700 dark:text-green-400">
                    <Tag className="h-4 w-4 shrink-0" />
                    <span className="truncate">
                      {appliedCoupon.code} aplicado ({describeCoupon(appliedCoupon)})
                    </span>
                  </span>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 shrink-0"
                    aria-label="Remover cupom"
                    disabled={mutation.isPending}
                    onClick={removeCoupon}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    id="coupon-code"
                    value={couponInput}
                    onChange={(e) => {
                      setCouponInput(e.target.value.toUpperCase());
                      if (couponMutation.isError) couponMutation.reset();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        applyCoupon();
                      }
                    }}
                    placeholder="Digite o código"
                    maxLength={40}
                    autoComplete="off"
                    className="uppercase"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!couponInput.trim() || couponMutation.isPending}
                    onClick={applyCoupon}
                  >
                    {couponMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Aplicar"
                    )}
                  </Button>
                </div>
              )}
              {couponMutation.error && (
                <p className="text-sm text-destructive">
                  {couponMutation.error.message}
                </p>
              )}
            </div>
            <Summary label="Subtotal" value={money(subtotal)} />
            {discount > 0 && (
              <Summary label="Desconto" value={`- ${money(discount)}`} />
            )}
            {!feeAbsorbed && <Summary label="Taxas" value={money(fee)} />}
            <Summary label="Total" value={money(total)} strong />
            {mutation.error && (
              <div className="space-y-2 rounded-md border border-destructive/30 bg-destructive/10 p-3">
                <p className="text-sm text-destructive">
                  {mutation.error.message}
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="w-full"
                  disabled={mutation.isPending}
                  onClick={form.handleSubmit((data) => mutation.mutate(data))}
                >
                  Tentar novamente
                </Button>
              </div>
            )}
            <Button
              className="w-full"
              disabled={mutation.isPending || !hasItems}
              onClick={form.handleSubmit((data) => mutation.mutate(data))}
            >
              {mutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              {mutation.isPending
                ? isFree ? "Confirmando inscrição..." : "Criando checkout..."
                : isFree ? "Confirmar inscrição" : "Confirmar compra"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function CheckoutGateShell({
  slug,
  children,
}: {
  slug: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-background">
      <div className="sticky top-0 z-30 glass border-b">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-5">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="gap-2 text-muted-foreground hover:text-foreground"
          >
            <Link href={`/eventos/${slug}`}>
              <ArrowLeft className="h-4 w-4" />
              Voltar ao evento
            </Link>
          </Button>
          <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-green-600" />
            Checkout seguro
          </div>
        </div>
      </div>
      <div className="mx-auto flex max-w-6xl justify-center px-5 py-10">
        <Card className="w-full max-w-md">{children}</Card>
      </div>
    </main>
  );
}

/** Sem conta não há compra: entra ou cria a conta e volta para este checkout. */
function CheckoutAccountGate({
  slug,
  eventTitle,
  returnPath,
}: {
  slug: string;
  eventTitle?: string;
  returnPath: string;
}) {
  return (
    <CheckoutGateShell slug={slug}>
      <CardHeader>
        <UserRound className="h-9 w-9 text-primary" />
        <CardTitle>Entre na sua conta para comprar</CardTitle>
        <CardDescription>
          {eventTitle ? `${eventTitle}: os` : "Os"} ingressos ficam guardados na sua conta.
          Depois de entrar ou criar a conta, você volta para esta compra com os
          mesmos ingressos selecionados.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button asChild className="w-full">
          <Link href={withCheckoutReturn("/register", returnPath)}>Criar conta</Link>
        </Button>
        <Button asChild variant="outline" className="w-full">
          <Link href={withCheckoutReturn("/login", returnPath)}>Já tenho conta</Link>
        </Button>
      </CardContent>
    </CheckoutGateShell>
  );
}

/** Conta logada, mas e-mail ainda não confirmado: confirma e segue a compra aqui. */
function CheckoutVerifyEmailGate({
  slug,
  eventTitle,
  email,
  returnPath,
}: {
  slug: string;
  eventTitle?: string;
  email: string;
  returnPath: string;
}) {
  const updateUser = useAuthStore((state) => state.updateUser);
  const resend = useMutation({
    mutationFn: () =>
      api<{ message: string }>(withCheckoutReturn("/auth/resend-verification", returnPath), {
        method: "POST",
        body: JSON.stringify({ email }),
        auth: false,
      }),
  });
  const check = useMutation({
    mutationFn: () => api<AuthUser>("/auth/me"),
    onSuccess: (currentUser) => updateUser(currentUser),
  });
  const stillPending = check.isSuccess && check.data.emailVerified === false;

  return (
    <CheckoutGateShell slug={slug}>
      <CardHeader>
        <Mail className="h-9 w-9 text-primary" />
        <CardTitle>Confirme seu e-mail para comprar</CardTitle>
        <CardDescription>
          {eventTitle ? `Para comprar ${eventTitle}, ` : "Para comprar, "}
          confirme o e-mail {email}. Envie o link, abra a mensagem e toque em
          confirmar. O link vale por 24 horas.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button
          type="button"
          className="w-full"
          disabled={resend.isPending}
          onClick={() => resend.mutate()}
        >
          {resend.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          {resend.isSuccess ? "Enviar outro link" : "Enviar link de confirmação"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={check.isPending}
          onClick={() => check.mutate()}
        >
          {check.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Já confirmei
        </Button>
        {resend.isSuccess && (
          <p className="text-sm text-muted-foreground">
            Link enviado para {email}. Se não chegar em alguns minutos, confira o
            spam ou envie outro.
          </p>
        )}
        {resend.error && (
          <p className="text-sm text-destructive">{resend.error.message}</p>
        )}
        {stillPending && (
          <p className="text-sm text-destructive">
            O e-mail ainda não está confirmado. Abra o link que enviamos e tente de novo.
          </p>
        )}
        {check.error && (
          <p className="text-sm text-destructive">{check.error.message}</p>
        )}
      </CardContent>
    </CheckoutGateShell>
  );
}

function freeOrderSuccessHref(data: CheckoutResponse) {
  const params = new URLSearchParams({ orderId: data.orderId });
  if (data.orderAccessToken) params.set("accessToken", data.orderAccessToken);
  return `/checkout/success?${params.toString()}`;
}

type AppliedCoupon = {
  code: string;
  discountPercent: number;
  discountFixedCents: number;
};

function describeCoupon(coupon: AppliedCoupon) {
  const parts: string[] = [];
  if (coupon.discountPercent > 0) parts.push(`${coupon.discountPercent}% off`);
  if (coupon.discountFixedCents > 0) parts.push(`${money(coupon.discountFixedCents)} off`);
  return parts.join(" + ");
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

function Summary({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={strong ? "text-lg font-semibold" : "font-medium"}>
        {value}
      </span>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background p-6 flex justify-center">
          <Skeleton className="h-[620px] w-full max-w-6xl" />
        </div>
      }
    >
      <CheckoutForm />
    </Suspense>
  );
}
