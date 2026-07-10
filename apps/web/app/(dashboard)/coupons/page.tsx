"use client";

import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  Tag, Plus, Save, X, Pencil, Trash2, Loader2, CalendarX2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { dateTime, money } from "@/lib/utils";
import type { CouponType } from "@/types/eventhub";

const couponSchema = z.object({
  code: z.string().min(3, "O código deve ter pelo menos 3 caracteres.").toUpperCase(),
  discountPercent: z.coerce.number().min(0).max(100).optional(),
  discountFixedBrl: z.coerce.number().min(0).optional(),
  validFrom: z.string().min(1, "Informe a data de início."),
  validUntil: z.string().min(1, "Informe a data de término."),
  maxUses: z.coerce.number().int().min(0),
  isActive: z.boolean().optional()
}).refine((data) => (data.discountPercent ?? 0) > 0 || (data.discountFixedBrl ?? 0) > 0, {
  message: "Informe pelo menos um tipo de desconto (percentual ou fixo).",
  path: ["discountPercent"]
});

type CouponForm = z.infer<typeof couponSchema>;

function brlToCents(brl?: number) {
  return brl ? Math.round(brl * 100) : 0;
}

export default function CouponsPage() {
  const qc = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: coupons, isLoading } = useQuery<CouponType[]>({
    queryKey: ["coupons"],
    queryFn: () => api<CouponType[]>("/coupons")
  });

  const invalidate = useCallback(() => qc.invalidateQueries({ queryKey: ["coupons"] }), [qc]);

  const createMutation = useMutation({
    mutationFn: (data: CouponForm) =>
      api("/coupons", {
        method: "POST",
        body: JSON.stringify({
          ...data,
          discountFixedCents: brlToCents(data.discountFixedBrl),
          discountFixedBrl: undefined
        })
      }),
    onSuccess: () => {
      invalidate();
      setShowNew(false);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: CouponForm }) =>
      api(`/coupons/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...data,
          discountFixedCents: brlToCents(data.discountFixedBrl),
          discountFixedBrl: undefined
        })
      }),
    onSuccess: () => {
      invalidate();
      setEditingId(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api(`/coupons/${id}`, { method: "DELETE" }),
    onSuccess: invalidate
  });

  // Stable handler – avoids recreating the function on every render
  const handleDelete = useCallback((id: string, code: string) => {
    if (confirm(`Excluir cupom ${code}?`)) deleteMutation.mutate(id);
  }, [deleteMutation]);

  // Pre-compute once per render; avoids allocating a Date object per coupon in the map
  const now = useMemo(() => new Date(), []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Cupons de Desconto</h1>
          <p className="text-sm text-muted-foreground mt-1">Crie e gerencie cupons promocionais para seus eventos.</p>
        </div>
        <Button onClick={() => setShowNew(true)} disabled={showNew} className="bg-primary hover:bg-primary/90 text-white shadow-sm shadow-primary/30">
          <Plus className="h-4 w-4" /> Novo cupom
        </Button>
      </div>

      {showNew && (
        <Card className="border-primary/40 shadow-md">
          <CardHeader className="flex-row items-center justify-between pb-4">
            <CardTitle className="text-base">Novo cupom</CardTitle>
            <Button variant="ghost" size="icon" onClick={() => setShowNew(false)}>
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <CouponFormComponent
              onSubmit={(d) => createMutation.mutate(d)}
              isPending={createMutation.isPending}
              error={createMutation.error?.message}
              submitLabel="Criar cupom"
            />
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full rounded-2xl" />)}
        </div>
      )}

      {!isLoading && coupons?.length === 0 && !showNew && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed bg-white dark:bg-card p-12 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
            <Tag className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-lg font-bold">Nenhum cupom criado</h3>
          <p className="text-sm text-muted-foreground mt-2 max-w-sm">Crie cupons promocionais para impulsionar suas vendas.</p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {coupons?.map(coupon => 
          editingId === coupon.id ? (
            <Card key={coupon.id} className="border-primary/30 shadow-sm md:col-span-2">
              <CardHeader className="flex-row items-center justify-between pb-4">
                <CardTitle className="text-base">Editando: {coupon.code}</CardTitle>
                <Button variant="ghost" size="icon" onClick={() => setEditingId(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent>
                <CouponFormComponent
                  defaultValues={{
                    code: coupon.code,
                    discountPercent: coupon.discountPercent ?? 0,
                    discountFixedBrl: (coupon.discountFixedCents ?? 0) / 100,
                    validFrom: coupon.validFrom.slice(0, 16),
                    validUntil: coupon.validUntil.slice(0, 16),
                    maxUses: coupon.maxUses,
                    isActive: coupon.isActive
                  }}
                  onSubmit={(d) => updateMutation.mutate({ id: coupon.id, data: d })}
                  isPending={updateMutation.isPending}
                  error={updateMutation.error?.message}
                  submitLabel="Salvar"
                />
              </CardContent>
            </Card>
          ) : (
            <div key={coupon.id} className="group rounded-2xl border bg-white dark:bg-card shadow-sm p-5 transition-all duration-200 hover:shadow-lg hover:border-primary/20 hover:-translate-y-0.5">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-lg">{coupon.code}</h3>
                    <Badge variant={coupon.isActive ? "default" : "secondary"}>
                      {coupon.isActive ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <CalendarX2 className="h-3.5 w-3.5" />
                    Validade: {new Date(coupon.validUntil) < now ? (
                      <span className="text-rose-500 font-medium">Expirado</span>
                    ) : (
                      dateTime(coupon.validUntil)
                    )}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => setEditingId(coupon.id)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDelete(coupon.id, coupon.code)}>
                    {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Desconto</p>
                  <p className="font-semibold mt-0.5">
                    {coupon.discountPercent ? `${coupon.discountPercent}%` : ""}
                    {coupon.discountPercent && coupon.discountFixedCents ? " + " : ""}
                    {coupon.discountFixedCents ? money(coupon.discountFixedCents) : ""}
                  </p>
                </div>
                <div className="rounded-xl bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Uso</p>
                  <p className="font-semibold mt-0.5">
                    {coupon.usedCount} {coupon.maxUses > 0 ? `/ ${coupon.maxUses}` : " (Ilimitado)"}
                  </p>
                </div>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}

function CouponFormComponent({
  defaultValues, onSubmit, isPending, error, submitLabel
}: {
  defaultValues?: Partial<CouponForm>;
  onSubmit: (data: CouponForm) => void;
  isPending: boolean;
  error?: string;
  submitLabel: string;
}) {
  const form = useForm<CouponForm>({
    resolver: zodResolver(couponSchema),
    defaultValues: { maxUses: 0, isActive: true, discountPercent: 0, discountFixedBrl: 0, ...defaultValues }
  });

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Código do cupom</Label>
          <Input {...form.register("code")} placeholder="Ex: PROMO20" className="uppercase" />
          {form.formState.errors.code && <p className="text-xs text-destructive">{form.formState.errors.code.message}</p>}
        </div>
        <div className="space-y-2">
          <Label>Limite de usos (0 = ilimitado)</Label>
          <Input type="number" min={0} {...form.register("maxUses")} />
        </div>
      </div>
      
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Desconto Percentual (%)</Label>
          <Input type="number" min={0} max={100} {...form.register("discountPercent")} />
          {form.formState.errors.discountPercent && <p className="text-xs text-destructive">{form.formState.errors.discountPercent.message}</p>}
        </div>
        <div className="space-y-2">
          <Label>Desconto Fixo (R$)</Label>
          <Input type="number" step={0.01} min={0} {...form.register("discountFixedBrl")} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Início</Label>
          <Input type="datetime-local" {...form.register("validFrom")} />
          {form.formState.errors.validFrom && <p className="text-xs text-destructive">{form.formState.errors.validFrom.message}</p>}
        </div>
        <div className="space-y-2">
          <Label>Término</Label>
          <Input type="datetime-local" {...form.register("validUntil")} />
          {form.formState.errors.validUntil && <p className="text-xs text-destructive">{form.formState.errors.validUntil.message}</p>}
        </div>
      </div>

      <div className="flex items-center gap-2 pt-2">
        <input type="checkbox" id="isActive" className="h-4 w-4 rounded border accent-primary" {...form.register("isActive")} />
        <Label htmlFor="isActive">Cupom ativo para uso</Label>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      
      <div className="pt-2">
        <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
