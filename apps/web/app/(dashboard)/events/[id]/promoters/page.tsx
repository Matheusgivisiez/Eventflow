"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Link as LinkIcon, Plus, Megaphone } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";

type PromoterLink = {
  id: string;
  promoterId: string;
  code: string;
  commissionType: string;
  commissionValue: number;
  clicks: number;
  conversions: number;
  revenueCents: number;
  isActive: boolean;
  promoter: { user: { name: string; email: string } };
};

type Promoter = {
  id: string;
  user: { name: string; email: string };
};

export default function EventPromotersPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [promoterId, setPromoterId] = useState("");
  const [commType, setCommType] = useState("PERCENTAGE");
  const [commValue, setCommValue] = useState("");

  const { data: event, isLoading: loadingEvent } = useQuery({
    queryKey: ["event", id],
    queryFn: () => api<any>(`/events/${id}`)
  });

  const { data: links, isLoading: loadingLinks } = useQuery<PromoterLink[]>({
    queryKey: ["event-promoter-links", id],
    queryFn: () => api(`/promoters/events/${id}/links`)
  });

  const { data: promoters } = useQuery<Promoter[]>({
    queryKey: ["admin-promoters"],
    queryFn: () => api("/promoters")
  });

  const addMutation = useMutation({
    mutationFn: () => api(`/promoters/events/${id}/links`, {
      method: "POST",
      body: JSON.stringify({
        promoterId,
        commissionType: commType,
        commissionValue: commType === "PERCENTAGE" ? Number(commValue) * 100 : Number(commValue) * 100 // PERCENTAGE = 10% = 1000 bps
      })
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["event-promoter-links", id] });
      setOpen(false);
      setPromoterId("");
      setCommValue("");
    }
  });

  if (loadingEvent) return <Skeleton className="h-96 w-full rounded-xl" />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/events/${id}`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-normal">{event?.title}</h1>
              <Badge variant="secondary">Promoters</Badge>
            </div>
            <p className="text-sm text-muted-foreground">Gerencie os promoters vinculados a este evento.</p>
          </div>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> Adicionar Promoter
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Vincular Promoter</DialogTitle>
              <DialogDescription>Selecione o promoter e defina a comissão para este evento.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Promoter</Label>
                <Select value={promoterId} onValueChange={setPromoterId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um promoter..." />
                  </SelectTrigger>
                  <SelectContent>
                    {promoters?.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.user.name} ({p.user.email})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo de Comissão</Label>
                  <Select value={commType} onValueChange={setCommType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PERCENTAGE">Percentual (%)</SelectItem>
                      <SelectItem value="FIXED">Fixo (R$)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Valor ({commType === "PERCENTAGE" ? "%" : "R$"})</Label>
                  <Input type="number" placeholder={commType === "PERCENTAGE" ? "10" : "50"} value={commValue} onChange={e => setCommValue(e.target.value)} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button disabled={!promoterId || !commValue || addMutation.isPending} onClick={() => addMutation.mutate()}>
                {addMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Vincular
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Links Ativos</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingLinks ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : links?.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-muted-foreground border-2 border-dashed rounded-xl">
              <Megaphone className="h-10 w-10 opacity-30 mb-2" />
              <p className="text-sm">Nenhum promoter vinculado a este evento.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {links?.map(link => (
                <div key={link.id} className="flex flex-col sm:flex-row justify-between items-center p-4 border rounded-xl hover:bg-muted/30">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-primary/10 text-primary rounded-full">
                      <LinkIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{link.promoter.user.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-[10px]">
                          {link.commissionType === "PERCENTAGE" ? `${link.commissionValue / 100}%` : `R$ ${link.commissionValue / 100}`}
                        </Badge>
                        <span className="text-xs text-muted-foreground">Código: <span className="font-mono text-foreground">{link.code}</span></span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-6 mt-4 sm:mt-0 text-center">
                    <div>
                      <p className="text-xs text-muted-foreground">Cliques</p>
                      <p className="font-semibold">{link.clicks}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Vendas</p>
                      <p className="font-semibold">{link.conversions}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Receita</p>
                      <p className="font-semibold text-emerald-600">
                        {(link.revenueCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
