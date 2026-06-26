"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Plus, Tag, Trash2, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { money } from "@/lib/utils";

type Coupon = {
  id: string;
  code: string;
  discountPercent: number;
  discountFixedCents: number;
  maxUses: number;
  usedCount: number;
  validFrom: string;
  validUntil: string;
  isActive: boolean;
};

const couponSchema = z.object({
  code: z.string().min(3, "Minimo 3 caracteres.").toUpperCase().regex(/^[A-Z0-9_-]+$/, "Use letras, numeros, _ e -."),
  discountPercent: z.coerce.number().int().min(0).max(100).optional(),
  discountFixedCents: z.coerce.number().min(0).optional().transform((value) => Math.round((value ?? 0) * 100)),
  maxUses: z.coerce.number().int().min(0, "0 = ilimitado"),
  validFrom: z.string().min(1, "Informe a data de inicio."),
  validUntil: z.string().min(1, "Informe a validade."),
  isActive: z.boolean().optional()
}).refine((data) => (data.discountPercent ?? 0) > 0 || (data.discountFixedCents ?? 0) > 0, {
  message: "Informe percentual ou valor fixo.",
  path: ["discountPercent"]
});

type CouponForm = z.infer<typeof couponSchema>;

export default function CouponsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Coupon | null>(null);
  const coupons = useQuery({ queryKey: ["coupons"], queryFn: () => api<Coupon[]>("/coupons") });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["coupons"] });
  const create = useMutation({
    mutationFn: (data: CouponForm) => api("/coupons", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      invalidate();
      setShowForm(false);
    }
  });
  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: CouponForm }) => api(`/coupons/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => {
      invalidate();
      setEditing(null);
    }
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/coupons/${id}`, { method: "DELETE" }),
    onSuccess: invalidate
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Cupons</h1>
          <p className="text-sm text-muted-foreground">Crie, edite e limite cupons por percentual ou valor fixo.</p>
        </div>
        <Button onClick={() => setShowForm(true)} disabled={showForm}>
          <Plus className="h-4 w-4" />
          Novo cupom
        </Button>
      </div>

      {showForm && (
        <CouponEditor
          title="Novo cupom"
          onCancel={() => setShowForm(false)}
          onSubmit={(data) => create.mutate(data)}
          isPending={create.isPending}
          error={create.error?.message}
        />
      )}

      {coupons.isLoading && <Skeleton className="h-72 w-full" />}

      {!coupons.isLoading && coupons.data?.length === 0 && !showForm && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-14 text-center">
            <Tag className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-lg font-medium">Nenhum cupom criado</p>
            <p className="mt-1 text-sm text-muted-foreground">Clique em "Novo cupom" para criar o primeiro desconto.</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {coupons.data?.map((coupon) =>
          editing?.id === coupon.id ? (
            <CouponEditor
              key={coupon.id}
              title={`Editando ${coupon.code}`}
              coupon={coupon}
              onCancel={() => setEditing(null)}
              onSubmit={(data) => update.mutate({ id: coupon.id, data })}
              isPending={update.isPending}
              error={update.error?.message}
            />
          ) : (
            <Card key={coupon.id}>
              <CardContent className="grid gap-3 p-4 md:grid-cols-[1fr_180px_160px_180px_110px] md:items-center">
                <div>
                  <code className="rounded bg-muted px-2 py-1 text-sm font-semibold">{coupon.code}</code>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Valido de {formatDate(coupon.validFrom)} ate {formatDate(coupon.validUntil)}
                  </p>
                </div>
                <p className="font-medium text-primary">{discountLabel(coupon)}</p>
                <p className="text-sm text-muted-foreground">
                  {coupon.usedCount}/{coupon.maxUses === 0 ? "ilimitado" : coupon.maxUses} usos
                </p>
                <Badge variant={!coupon.isActive ? "secondary" : isExpired(coupon.validUntil) ? "destructive" : "default"}>
                  {!coupon.isActive ? "Inativo" : isExpired(coupon.validUntil) ? "Expirado" : "Ativo"}
                </Badge>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" title="Editar cupom" onClick={() => setEditing(coupon)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" title="Excluir cupom" className="text-destructive hover:text-destructive" onClick={() => confirm(`Excluir ${coupon.code}?`) && remove.mutate(coupon.id)}>
                    {remove.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        )}
      </div>
    </div>
  );
}

function CouponEditor({
  title,
  coupon,
  onCancel,
  onSubmit,
  isPending,
  error
}: {
  title: string;
  coupon?: Coupon;
  onCancel: () => void;
  onSubmit: (data: CouponForm) => void;
  isPending: boolean;
  error?: string;
}) {
  const form = useForm<CouponForm>({
    resolver: zodResolver(couponSchema),
    defaultValues: {
      code: coupon?.code ?? "",
      discountPercent: coupon?.discountPercent ?? 10,
      discountFixedCents: coupon ? coupon.discountFixedCents / 100 : 0,
      maxUses: coupon?.maxUses ?? 0,
      validFrom: coupon?.validFrom.slice(0, 10) ?? "",
      validUntil: coupon?.validUntil.slice(0, 10) ?? "",
      isActive: coupon?.isActive ?? true
    } as any
  });

  return (
    <Card className="border-primary/40 shadow-md">
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>Codigo, quantidade, validade, percentual e valor fixo.</CardDescription>
        </div>
        <Button variant="ghost" size="icon" onClick={onCancel}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="grid gap-4 sm:grid-cols-4">
            <Field label="Codigo" error={form.formState.errors.code?.message}>
              <Input {...form.register("code")} onChange={(event) => form.setValue("code", event.target.value.toUpperCase())} />
            </Field>
            <Field label="Percentual (%)" error={form.formState.errors.discountPercent?.message}>
              <Input type="number" min={0} max={100} {...form.register("discountPercent")} />
            </Field>
            <Field label="Valor fixo (R$)" error={form.formState.errors.discountFixedCents?.message}>
              <Input type="number" min={0} step={0.01} {...form.register("discountFixedCents")} />
            </Field>
            <Field label="Quantidade" error={form.formState.errors.maxUses?.message}>
              <Input type="number" min={0} {...form.register("maxUses")} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Valido de" error={form.formState.errors.validFrom?.message}>
              <Input type="date" {...form.register("validFrom")} />
            </Field>
            <Field label="Valido ate" error={form.formState.errors.validUntil?.message}>
              <Input type="date" {...form.register("validUntil")} />
            </Field>
          </div>
          <label className="flex cursor-pointer items-center gap-3">
            <input type="checkbox" className="h-4 w-4 accent-primary" {...form.register("isActive")} />
            <span className="text-sm font-medium">Cupom ativo</span>
          </label>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button disabled={isPending}>{isPending && <Loader2 className="h-4 w-4 animate-spin" />}Salvar cupom</Button>
            <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function isExpired(until: string) {
  return new Date(until) < new Date();
}

function discountLabel(coupon: Coupon) {
  const parts = [];
  if (coupon.discountPercent > 0) parts.push(`${coupon.discountPercent}%`);
  if (coupon.discountFixedCents > 0) parts.push(money(coupon.discountFixedCents));
  return `${parts.join(" + ")} OFF`;
}
