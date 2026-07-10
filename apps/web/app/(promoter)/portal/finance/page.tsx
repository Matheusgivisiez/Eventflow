"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Wallet, Landmark, Clock, CheckCircle2, XCircle, ArrowUpRight, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { dateTime } from "@/lib/utils";

const STATUS_MAP: Record<string, { label: string, color: string, icon: any }> = {
  PENDING: { label: "Pendente", color: "text-amber-600 bg-amber-100", icon: Clock },
  APPROVED: { label: "Aprovado", color: "text-blue-600 bg-blue-100", icon: CheckCircle2 },
  PAID: { label: "Pago", color: "text-emerald-600 bg-emerald-100", icon: CheckCircle2 },
  REJECTED: { label: "Rejeitado", color: "text-rose-600 bg-rose-100", icon: XCircle },
  CANCELED: { label: "Cancelado", color: "text-slate-600 bg-slate-100", icon: XCircle },
};

export default function PromoterFinancePage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");

  const { data: dashboard, isLoading: loadingDash } = useQuery<any>({
    queryKey: ["promoter-dashboard"],
    queryFn: () => api("/promoter-portal/dashboard")
  });

  const { data: withdrawals, isLoading: loadingWithdrawals } = useQuery<any[]>({
    queryKey: ["promoter-withdrawals"],
    queryFn: () => api("/promoter-portal/withdrawals")
  });

  const requestMutation = useMutation({
    mutationFn: () => api("/promoter-portal/withdrawals", {
      method: "POST",
      body: JSON.stringify({ amountCents: Number(amount) * 100 })
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["promoter-withdrawals"] });
      qc.invalidateQueries({ queryKey: ["promoter-dashboard"] });
      setOpen(false);
      setAmount("");
    }
  });

  const available = dashboard?.stats?.availableBalanceCents ?? 0;
  const pixKey = dashboard?.promoter?.pixKey;

  if (loadingDash || loadingWithdrawals) {
    return <Skeleton className="h-96 w-full rounded-xl" />;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Financeiro</h1>
        <p className="text-muted-foreground mt-1">Gerencie seus ganhos e solicite saques.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="shadow-sm bg-primary text-primary-foreground">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-primary-foreground/80">Saldo Disponível</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-extrabold tracking-tight">
              {(available / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </div>
          </CardContent>
          <CardFooter>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button variant="secondary" className="w-full font-bold shadow-sm" disabled={available <= 0 || !pixKey}>
                  <Wallet className="mr-2 h-4 w-4" /> Solicitar Saque
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Solicitar Saque</DialogTitle>
                  <DialogDescription>
                    O valor será transferido para sua chave PIX cadastrada: <span className="font-mono font-bold text-foreground">{pixKey}</span>
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Valor do saque (R$)</Label>
                    <Input 
                      type="number" 
                      placeholder="0.00" 
                      value={amount} 
                      onChange={e => setAmount(e.target.value)} 
                      max={available / 100}
                    />
                    <p className="text-xs text-muted-foreground">
                      Disponível: {(available / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button 
                    disabled={!amount || Number(amount) <= 0 || Number(amount) * 100 > available || requestMutation.isPending} 
                    onClick={() => requestMutation.mutate()}
                  >
                    {requestMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Confirmar Saque
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardFooter>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Sacado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold tracking-tight">
              {((dashboard?.stats?.withdrawnCents ?? 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Chave PIX</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-muted rounded-full"><Landmark className="h-5 w-5" /></div>
              <div>
                {pixKey ? (
                  <p className="font-mono font-semibold">{pixKey}</p>
                ) : (
                  <p className="text-sm text-amber-600">Nenhuma chave cadastrada</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Histórico de Saques</CardTitle>
          <CardDescription>Acompanhe o status das suas solicitações</CardDescription>
        </CardHeader>
        <CardContent>
          {withdrawals?.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-muted-foreground border-2 border-dashed rounded-xl">
              <Wallet className="h-10 w-10 opacity-30 mb-2" />
              <p className="text-sm">Nenhum saque solicitado ainda.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {withdrawals?.map(w => {
                const cfg = STATUS_MAP[w.status];
                const Icon = cfg.icon;
                return (
                  <div key={w.id} className="flex items-center justify-between p-4 border rounded-xl hover:bg-muted/30">
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-full ${cfg.color}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">Saque para PIX</p>
                        <p className="text-xs text-muted-foreground">{dateTime(w.requestedAt)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{(w.amountCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>
                      <Badge variant="outline" className={`text-[10px] mt-1 ${cfg.color} border-none`}>{cfg.label}</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
