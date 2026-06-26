"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Wallet } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { money } from "@/lib/utils";

type FinanceSummary = {
  balanceCents: number;
  totalFeesCents: number;
  withdrawnCents: number;
  statement: { id: string; description: string; amountCents: number; feeCents: number; createdAt: string }[];
};

export default function FinancePage() {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const { data } = useQuery({ queryKey: ["finance"], queryFn: () => api<FinanceSummary>("/finance/summary") });
  const withdrawal = useMutation({
    mutationFn: () => api("/finance/withdrawals", { method: "POST", body: JSON.stringify({ amountCents: Math.round(Number(amount) * 100) }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["finance"] })
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal">Financeiro</h1>
        <p className="text-sm text-muted-foreground">Saldo, taxas, extrato e solicitacao de saque.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <FinanceCard label="Saldo" value={money(data?.balanceCents)} />
        <FinanceCard label="Taxas" value={money(data?.totalFeesCents)} />
        <FinanceCard label="Sacado" value={money(data?.withdrawnCents)} />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader>
            <CardTitle>Extrato</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data?.statement.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
                <span>{entry.description}</span>
                <span className="font-medium">{money(entry.amountCents)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Wallet className="h-5 w-5 text-primary" />
            <CardTitle>Solicitar saque</CardTitle>
            <CardDescription>Informe o valor em reais.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input type="number" min="1" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} />
            <Button className="w-full" onClick={() => withdrawal.mutate()} disabled={withdrawal.isPending || !amount}>Solicitar</Button>
            {withdrawal.error && <p className="text-sm text-destructive">{withdrawal.error.message}</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function FinanceCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}
