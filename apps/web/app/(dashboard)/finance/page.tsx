"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Wallet, TrendingUp, ArrowDownToLine, ReceiptText, AlertTriangle,
  Loader2, ArrowUpRight, ArrowDownRight, CheckCircle2
} from "lucide-react";
import { useState, useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { cn, dateTime, money } from "@/lib/utils";

type LedgerEntry = {
  id: string;
  description: string;
  amountCents: number;
  feeCents: number;
  createdAt: string;
};

type FinanceSummary = {
  balanceCents: number;
  totalFeesCents: number;
  withdrawnCents: number;
  statement: LedgerEntry[];
};

export default function FinancePage() {
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const [confirmStep, setConfirmStep] = useState(false);

  const { data, isLoading } = useQuery<FinanceSummary>({
    queryKey: ["finance"],
    queryFn: () => api<FinanceSummary>("/finance/summary"),
  });

  const withdrawal = useMutation({
    mutationFn: () =>
      api("/finance/withdrawals", {
        method: "POST",
        body: JSON.stringify({ amountCents: Math.round(Number(amount) * 100) }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finance"] });
      setAmount("");
      setConfirmStep(false);
    },
  });

  // Memoized: spread+reverse+slice+map only reruns when statement changes, not on every keystroke
  const chartData = useMemo(() => [...(data?.statement ?? [])].reverse().slice(-10).map((e, i) => ({
    name: `#${i + 1}`,
    Receita: e.amountCents / 100,
    Taxa: e.feeCents / 100,
  })), [data?.statement]);

  const amountCents = useMemo(() => Math.round(Number(amount) * 100), [amount]);
  const insufficientBalance = useMemo(() => amountCents > (data?.balanceCents ?? 0), [amountCents, data?.balanceCents]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Financeiro</h1>
        <p className="text-sm text-muted-foreground mt-1">Saldo, taxas, extrato e solicitação de saque.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard
          label="Saldo disponível"
          value={isLoading ? "—" : money(data?.balanceCents ?? 0)}
          icon={<Wallet className="h-5 w-5 text-primary" />}
          highlight="text-primary"
          isLoading={isLoading}
        />
        <KpiCard
          label="Total recebido (bruto)"
          value={isLoading ? "—" : money((data?.balanceCents ?? 0) + (data?.withdrawnCents ?? 0))}
          icon={<TrendingUp className="h-5 w-5 text-emerald-500" />}
          highlight="text-emerald-600"
          isLoading={isLoading}
        />
        <KpiCard
          label="Taxas retidas"
          value={isLoading ? "—" : money(data?.totalFeesCents ?? 0)}
          icon={<ArrowUpRight className="h-5 w-5 text-rose-500" />}
          highlight="text-rose-600"
          isLoading={isLoading}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Statement + Chart */}
        <div className="space-y-6">
          {/* Sparkline Chart */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <ReceiptText className="h-4 w-4 text-primary" /> Últimas movimentações
              </CardTitle>
              <CardDescription>Receita bruta vs. taxas das últimas transações</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : chartData.length === 0 ? (
                <div className="flex h-48 items-center justify-center text-muted-foreground text-sm border-2 border-dashed rounded-xl">
                  Nenhuma movimentação registrada.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gReceita" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `R$${v}`} />
                    <Tooltip formatter={(v: number, n: string) => [money(v * 100), n]} />
                    <Area type="monotone" dataKey="Receita" stroke="hsl(var(--primary))" fill="url(#gReceita)" strokeWidth={2} dot={false} />
                    <Area type="monotone" dataKey="Taxa" stroke="hsl(var(--destructive))" fill="none" strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Full Statement */}
          <Card className="shadow-sm">
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-base">Extrato completo</CardTitle>
              <Badge variant="outline">{data?.statement.length ?? 0} lançamentos</Badge>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
              {isLoading && <Skeleton className="h-48 w-full" />}
              {!isLoading && (data?.statement.length === 0) && (
                <div className="flex h-24 items-center justify-center text-muted-foreground text-sm">
                  Nenhum lançamento encontrado.
                </div>
              )}
              {data?.statement.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between rounded-xl border bg-muted/20 p-3 text-sm hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
                      <ArrowDownRight className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-medium leading-none">{entry.description}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{dateTime(entry.createdAt)}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-semibold text-emerald-600">+{money(entry.amountCents)}</p>
                    {entry.feeCents > 0 && (
                      <p className="text-xs text-rose-500">taxa: -{money(entry.feeCents)}</p>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Withdrawal Card */}
        <div className="space-y-4">
          <Card className="shadow-sm border-primary/20 sticky top-6">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2 mb-1">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                  <ArrowDownToLine className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-base">Solicitar saque</CardTitle>
              </div>
              <CardDescription>Valor mínimo: R$ 5,00. O saldo disponível é transferido em até 2 dias úteis.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Valor do saque (R$)</Label>
                  {data && (
                    <button
                      onClick={() => setAmount(String((data.balanceCents / 100).toFixed(2)))}
                      className="text-xs text-primary hover:underline"
                    >
                      Usar saldo total
                    </button>
                  )}
                </div>
                <Input
                  type="number"
                  min="5"
                  step="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => { setAmount(e.target.value); setConfirmStep(false); }}
                  className="h-12 text-lg font-mono"
                />
                {amount && insufficientBalance && (
                  <p className="text-xs text-destructive mt-1.5 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> Saldo insuficiente.
                  </p>
                )}
              </div>

              {/* Balance preview */}
              {amount && !insufficientBalance && Number(amount) >= 5 && (
                <div className="rounded-xl bg-muted/50 p-3 text-sm space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Saldo atual</span>
                    <span className="font-medium">{money(data?.balanceCents ?? 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Saque</span>
                    <span className="font-medium text-rose-600">-{money(amountCents)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-1.5">
                    <span className="font-semibold">Saldo restante</span>
                    <span className="font-bold">{money((data?.balanceCents ?? 0) - amountCents)}</span>
                  </div>
                </div>
              )}

              {!confirmStep ? (
                <Button
                  className="w-full h-11"
                  disabled={!amount || insufficientBalance || Number(amount) < 5}
                  onClick={() => setConfirmStep(true)}
                >
                  Solicitar saque
                </Button>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-center">Confirmar saque de <span className="text-primary font-bold">{money(amountCents)}</span>?</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" onClick={() => setConfirmStep(false)}>Cancelar</Button>
                    <Button
                      onClick={() => withdrawal.mutate()}
                      disabled={withdrawal.isPending}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      {withdrawal.isPending
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <CheckCircle2 className="h-4 w-4" />}
                      Confirmar
                    </Button>
                  </div>
                </div>
              )}
              {withdrawal.error && (
                <p className="text-sm text-destructive text-center">{withdrawal.error.message}</p>
              )}
              {withdrawal.isSuccess && (
                <p className="text-sm text-emerald-600 text-center flex items-center justify-center gap-1">
                  <CheckCircle2 className="h-4 w-4" /> Saque solicitado com sucesso!
                </p>
              )}
            </CardContent>
          </Card>

          {/* Withdrawn Summary */}
          <Card className="shadow-sm">
            <CardContent className="pt-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total sacado</p>
                  <p className="text-2xl font-extrabold">{money(data?.withdrawnCents ?? 0)}</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
                  <ArrowDownToLine className="h-6 w-6 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, icon, highlight, isLoading }: {
  label: string; value: string; icon: React.ReactNode; highlight: string; isLoading?: boolean;
}) {
  return (
    <Card className="shadow-sm">
      <CardContent className="pt-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm text-muted-foreground">{label}</p>
          <div className="p-2 rounded-xl bg-muted/60">{icon}</div>
        </div>
        {isLoading
          ? <Skeleton className="h-8 w-32" />
          : <p className={cn("text-2xl font-extrabold tracking-tight", highlight)}>{value}</p>
        }
      </CardContent>
    </Card>
  );
}
