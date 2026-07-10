"use client";

import { useQuery } from "@tanstack/react-query";
import { Link as LinkIcon, Copy, QrCode, ArrowUpRight, Megaphone, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { dateTime } from "@/lib/utils";

export default function PromoterLinksPage() {
  const { data: dashboard, isLoading: loadingDash } = useQuery<any>({
    queryKey: ["promoter-dashboard"],
    queryFn: () => api("/promoter-portal/dashboard")
  });

  const { data: sales, isLoading: loadingSales } = useQuery<any[]>({
    queryKey: ["promoter-sales"],
    queryFn: () => api("/promoter-portal/sales")
  });

  const [copied, setCopied] = useState("");
  const [qrOpen, setQrOpen] = useState(false);
  const [qrLink, setQrLink] = useState("");

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(""), 2000);
  };

  const openQr = (link: string) => {
    setQrLink(link);
    setQrOpen(true);
  };

  if (loadingDash || loadingSales) {
    return <Skeleton className="h-96 w-full rounded-xl" />;
  }

  const originUrl = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Links & Vendas</h1>
        <p className="text-muted-foreground mt-1">Obtenha seus links exclusivos e acompanhe suas conversões em tempo real.</p>
      </div>

      <Card className="shadow-sm border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-primary">Meus Links de Venda</CardTitle>
          <CardDescription>Compartilhe estes links para ganhar comissões nas vendas.</CardDescription>
        </CardHeader>
        <CardContent>
          {dashboard?.links?.length === 0 ? (
            <div className="text-center p-6 text-muted-foreground">
              Você ainda não foi vinculado a nenhum evento.
            </div>
          ) : (
            <div className="space-y-4">
              {dashboard?.links?.map((link: any) => {
                const fullLink = `${originUrl}/checkout/${link.event.slug}?p=${link.code}`;
                return (
                  <div key={link.id} className="flex flex-col lg:flex-row justify-between lg:items-center p-4 bg-white dark:bg-card border rounded-xl gap-4">
                    <div>
                      <p className="font-bold text-base">{link.event.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="text-xs">
                          Comissão: {link.commissionType === "PERCENTAGE" ? `${link.commissionValue / 100}%` : `R$ ${link.commissionValue / 100}`}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{link.clicks} cliques · {link.conversions} vendas</span>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center gap-2">
                      <div className="bg-muted px-3 py-2 rounded-lg text-sm font-mono truncate w-full sm:w-64">
                        {fullLink}
                      </div>
                      <div className="flex gap-2 w-full sm:w-auto">
                        <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => copyToClipboard(fullLink, link.id)}>
                          <Copy className="h-4 w-4 mr-2" />
                          {copied === link.id ? "Copiado!" : "Copiar"}
                        </Button>
                        <Button variant="default" size="sm" className="w-full sm:w-auto" onClick={() => openQr(fullLink)}>
                          <QrCode className="h-4 w-4 mr-2" />
                          QR Code
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Histórico de Vendas</CardTitle>
          <CardDescription>Todas as vendas aprovadas geradas pelos seus links.</CardDescription>
        </CardHeader>
        <CardContent>
          {sales?.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-muted-foreground border-2 border-dashed rounded-xl">
              <Megaphone className="h-10 w-10 opacity-30 mb-2" />
              <p className="text-sm">Nenhuma venda registrada ainda.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sales?.map((sale: any) => (
                <div key={sale.id} className="flex items-center justify-between p-4 border rounded-xl hover:bg-muted/30">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-emerald-100 text-emerald-600 rounded-full">
                      <ArrowUpRight className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">Venda Aprovada · {sale.event.title}</p>
                      <p className="text-xs text-muted-foreground">{dateTime(sale.createdAt)} · Comprador: {sale.buyerName}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-emerald-600">
                      +{(sale.promoterCommissionCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </p>
                    <p className="text-xs text-muted-foreground">Valor pago: {(sale.totalCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Seu QR Code Exclusivo</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center p-6 space-y-4">
            {qrLink && (
              <img src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrLink)}`} alt="QR Code" className="rounded-xl shadow-md border" />
            )}
            <p className="text-xs text-center text-muted-foreground">
              Aponte a câmera para o QR Code acima para acessar o link de compra com sua indicação garantida.
            </p>
            <Button variant="outline" className="w-full" onClick={() => copyToClipboard(qrLink, "qr")}>
              {copied === "qr" ? "Link Copiado!" : "Copiar Link"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
