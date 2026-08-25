"use client";

import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Link as LinkIcon, Plus, Megaphone, Copy, Pencil, Trash2, ToggleLeft, ToggleRight, Trophy } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { money } from "@/lib/utils";

type PromoterLink = {
  id: string;
  promoterId: string;
  code: string;
  commissionType: string;
  commissionValue: number;
  clicks: number;
  conversions: number;
  revenueCents: number;
  commissionAcumCents: number;
  isActive: boolean;
  promoter: { user: { name: string; email: string } };
};

type Promoter = {
  id: string;
  status: string;
  user: { name: string; email: string };
};

export default function EventPromotersPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedLink, setSelectedLink] = useState<PromoterLink | null>(null);
  const [promoterId, setPromoterId] = useState("");
  const [commType, setCommType] = useState("PERCENTAGE");
  const [commValue, setCommValue] = useState("");
  const [copied, setCopied] = useState("");

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

  const { data: ranking } = useQuery<any[]>({
    queryKey: ["event-promoter-ranking", id],
    queryFn: () => api(`/promoters/events/${id}/ranking`),
    enabled: (links?.length ?? 0) > 0
  });

  const activePromoters = (promoters ?? []).filter(p => p.status === "ACTIVE");
  const linkedIds = new Set((links ?? []).map(l => l.promoterId));
  const availablePromoters = activePromoters.filter(p => !linkedIds.has(p.id));

  const addMutation = useMutation({
    mutationFn: () => api(`/promoters/events/${id}/links`, {
      method: "POST",
      body: JSON.stringify({
        promoterId,
        commissionType: commType,
        commissionValue: Number(commValue) * 100
      })
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["event-promoter-links", id] });
      setAddOpen(false);
      setPromoterId("");
      setCommValue("");
    }
  });

  const editMutation = useMutation({
    mutationFn: (data: { commissionType: string; commissionValue: number }) =>
      api(`/promoters/events/${id}/links/${selectedLink?.id}`, {
        method: "PATCH",
        body: JSON.stringify(data)
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["event-promoter-links", id] });
      setEditOpen(false);
      setSelectedLink(null);
    }
  });

  const toggleMutation = useMutation({
    mutationFn: ({ linkId, isActive }: { linkId: string; isActive: boolean }) =>
      api(`/promoters/events/${id}/links/${linkId}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive })
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["event-promoter-links", id] })
  });

  const removeMutation = useMutation({
    mutationFn: (linkId: string) =>
      api(`/promoters/events/${id}/links/${linkId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["event-promoter-links", id] })
  });

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  const copyLink = (code: string, eventSlug: string) => {
    const url = `${baseUrl}/checkout/${eventSlug}?p=${code}`;
    navigator.clipboard.writeText(url);
    setCopied(code);
    setTimeout(() => setCopied(""), 2000);
  };

  const openEdit = (link: PromoterLink) => {
    setSelectedLink(link);
    setCommType(link.commissionType);
    setCommValue(String(link.commissionValue / 100));
    setEditOpen(true);
  };

  if (loadingEvent) return <Skeleton className="h-96 w-full rounded-xl" />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/events/${id}`}><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-normal">{event?.title}</h1>
              <Badge variant="secondary">Promoters</Badge>
            </div>
            <p className="text-sm text-muted-foreground">Gerencie os promoters vinculados a este evento.</p>
          </div>
        </div>

        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" disabled={availablePromoters.length === 0}>
              <Plus className="h-4 w-4" /> Adicionar Promoter
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Vincular Promoter</DialogTitle>
              <DialogDescription>Selecione um promoter ativo e defina a comissão para este evento.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Promoter</Label>
                <Select value={promoterId} onValueChange={setPromoterId}>
                  <SelectTrigger><SelectValue placeholder="Selecione um promoter..." /></SelectTrigger>
                  <SelectContent>
                    {availablePromoters.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.user.name} ({p.user.email})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {availablePromoters.length === 0 && (
                  <p className="text-xs text-amber-600">Nenhum promoter ativo disponível para vincular.</p>
                )}
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
              <Button variant="outline" onClick={() => setAddOpen(false)}>Cancelar</Button>
              <Button disabled={!promoterId || !commValue || addMutation.isPending} onClick={() => addMutation.mutate()}>
                {addMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Vincular
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit commission dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Comissão — {selectedLink?.promoter.user.name}</DialogTitle>
            <DialogDescription>Altere o tipo e valor da comissão deste promoter para o evento.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
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
              <Label>Valor</Label>
              <Input type="number" value={commValue} onChange={e => setCommValue(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button
              disabled={!commValue || editMutation.isPending}
              onClick={() => editMutation.mutate({ commissionType: commType, commissionValue: Number(commValue) * 100 })}
            >
              {editMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Links table */}
      <Card>
        <CardHeader>
          <CardTitle>Promoters Vinculados</CardTitle>
          <CardDescription>{links?.length ?? 0} promoter(s) neste evento</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingLinks ? (
            <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
          ) : links?.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-muted-foreground border-2 border-dashed rounded-xl">
              <Megaphone className="h-10 w-10 opacity-30 mb-2" />
              <p className="text-sm">Nenhum promoter vinculado a este evento.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {links?.map(link => (
                <div key={link.id} className={`flex flex-col lg:flex-row justify-between items-start lg:items-center p-4 border rounded-xl transition-colors gap-4 ${!link.isActive ? "opacity-60 bg-muted/30" : "hover:bg-muted/20"}`}>
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-full ${link.isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                      <LinkIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm">{link.promoter.user.name}</p>
                        {!link.isActive && <Badge variant="secondary" className="text-[10px]">Desativado</Badge>}
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge variant="outline" className="text-[10px]">
                          {link.commissionType === "PERCENTAGE" ? `${link.commissionValue / 100}%` : money(link.commissionValue)}
                        </Badge>
                        <span className="text-xs text-muted-foreground font-mono">{link.code}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-5 text-center text-sm ml-0 lg:ml-auto">
                    <div><p className="text-xs text-muted-foreground">Cliques</p><p className="font-semibold">{link.clicks}</p></div>
                    <div><p className="text-xs text-muted-foreground">Vendas</p><p className="font-semibold">{link.conversions}</p></div>
                    <div><p className="text-xs text-muted-foreground">Receita</p><p className="font-semibold text-emerald-600">{money(link.revenueCents)}</p></div>
                    <div><p className="text-xs text-muted-foreground">Comissão</p><p className="font-semibold text-primary">{money(link.commissionAcumCents)}</p></div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      size="sm" variant="outline"
                      onClick={() => copyLink(link.code, event?.slug ?? "")}
                      className="gap-1"
                    >
                      <Copy className="h-3 w-3" />
                      {copied === link.code ? "Copiado!" : "Link"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => openEdit(link)} className="gap-1">
                      <Pencil className="h-3 w-3" /> Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={toggleMutation.isPending}
                      onClick={() => toggleMutation.mutate({ linkId: link.id, isActive: !link.isActive })}
                      className="gap-1"
                    >
                      {link.isActive ? <ToggleRight className="h-3 w-3" /> : <ToggleLeft className="h-3 w-3" />}
                      {link.isActive ? "Desativar" : "Ativar"}
                    </Button>
                    <Button
                      size="sm" variant="ghost"
                      className="text-destructive hover:text-destructive"
                      disabled={removeMutation.isPending}
                      onClick={() => {
                        if (confirm(`Remover ${link.promoter.user.name} deste evento?`)) {
                          removeMutation.mutate(link.id);
                        }
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ranking */}
      {ranking && ranking.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" />
              Ranking de Promoters
            </CardTitle>
            <CardDescription>Baseado em comissões acumuladas de vendas confirmadas</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {ranking.map((entry: any) => {
                const medals = ["🥇", "🥈", "🥉"];
                const medal = medals[entry.rank - 1] ?? `#${entry.rank}`;
                return (
                  <div key={entry.rank} className="flex items-center justify-between p-3 rounded-xl border hover:bg-muted/20">
                    <div className="flex items-center gap-3">
                      <span className="text-xl w-8 text-center">{medal}</span>
                      <div>
                        <p className="font-semibold text-sm">{entry.promoter.name}</p>
                        <p className="text-xs text-muted-foreground">{entry.clicks} cliques · {entry.conversions} vendas</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-emerald-600">{money(entry.revenueCents)}</p>
                      <p className="text-xs text-primary">{money(entry.commissionAcumCents)} comissão</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
