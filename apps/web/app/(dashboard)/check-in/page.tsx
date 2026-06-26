"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, ScanLine, XCircle, AlertTriangle, Camera, Keyboard } from "lucide-react";
import type { Html5QrcodeScanner } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import type { EventHubEvent, Paginated } from "@/types/eventhub";

export default function CheckInPage() {
  const [eventId, setEventId] = useState("");
  const [code, setCode] = useState("");
  const [mode, setMode] = useState<"usb" | "camera">("usb");
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  const events = useQuery({ queryKey: ["events-checkin"], queryFn: () => api<Paginated<EventHubEvent>>("/events?status=PUBLISHED") });
  const mutation = useMutation({
    mutationFn: (scannedCode: string) => api<{ status: string; message: string; ticket: any }>(`/check-in/events/${eventId}/validate`, { method: "POST", body: JSON.stringify({ code: scannedCode }) }),
    onSuccess: () => {
      if (mode === "usb") setCode(""); // Limpa o input apos a leitura
    }
  });

  useEffect(() => {
    if (mode === "camera" && eventId) {
      import("html5-qrcode").then(({ Html5QrcodeScanner }) => {
        if (!scannerRef.current) {
          scannerRef.current = new Html5QrcodeScanner("reader", { fps: 10, qrbox: { width: 250, height: 250 } }, false);
          scannerRef.current.render(
            (decodedText) => {
              // Se já estiver validando algo, ignora
              if (mutation.isPending) return;
              // Toca um som de bipe opcional
              try { new Audio("/beep.mp3").play().catch(() => {}); } catch(e) {}
              mutation.mutate(decodedText);
            },
            (error) => {
              // Ignorar erros de leitura de frame vazio
            }
          );
        }
      }).catch(console.error);
    } else {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error);
        scannerRef.current = null;
      }
    }

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error);
        scannerRef.current = null;
      }
    };
  }, [mode, eventId, mutation.isPending]);

  const getStatusDisplay = () => {
    if (mutation.isPending) return null;
    if (mutation.error) {
      return (
        <div className="flex flex-col items-center justify-center p-6 bg-destructive/10 text-destructive rounded-xl border border-destructive/20 animate-in zoom-in-95 duration-200 w-full h-full text-center">
          <AlertTriangle className="h-16 w-16 mb-4" />
          <h2 className="text-2xl font-bold">Erro de Leitura</h2>
          <p className="mt-2">{mutation.error.message}</p>
        </div>
      );
    }
    if (!mutation.data) return (
      <div className="flex flex-col items-center justify-center p-10 text-muted-foreground border-2 border-dashed rounded-xl bg-muted/20 w-full h-full text-center">
        <ScanLine className="h-12 w-12 mb-4 opacity-50" />
        <p>Pronto para escanear ingressos.</p>
      </div>
    );

    const { status, message, ticket } = mutation.data;
    
    if (status === "ENTERED") {
      return (
        <div className="flex flex-col items-center justify-center p-6 bg-green-500/10 text-green-700 dark:text-green-400 rounded-xl border border-green-500/20 animate-in zoom-in-95 duration-200 w-full h-full text-center">
          <CheckCircle2 className="h-16 w-16 mb-4 text-green-500" />
          <h2 className="text-3xl font-bold">Liberado!</h2>
          <p className="font-semibold text-lg mt-1">{ticket?.attendeeName}</p>
          <p className="text-sm opacity-80 mt-1">{ticket?.ticketType?.name}</p>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center p-6 bg-red-500/10 text-red-700 dark:text-red-400 rounded-xl border border-red-500/20 animate-in zoom-in-95 duration-200 w-full h-full text-center">
        <XCircle className="h-16 w-16 mb-4 text-red-500" />
        <h2 className="text-3xl font-bold">{status === "DUPLICATED" ? "Duplicado" : "Recusado"}</h2>
        <p className="font-semibold text-lg mt-1">{ticket?.attendeeName}</p>
        <p className="text-sm opacity-80 mt-2">{message}</p>
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-20">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">App de Check-in</h1>
        <p className="text-muted-foreground mt-2">Valide ingressos rapidamente na porta do seu evento usando um leitor externo ou a camera (PWA).</p>
      </div>
      
      <div className="grid gap-6 lg:grid-cols-2 items-start">
        <Card className="shadow-lg border-primary/20">
          <CardHeader className="bg-primary/5 pb-6 border-b">
            <CardTitle className="flex items-center gap-2">
              <ScanLine className="h-5 w-5 text-primary" />
              Scanner de Ingresso
            </CardTitle>
            <CardDescription>Selecione o evento e o modo de leitura.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div className="space-y-3">
              <Label className="text-base font-semibold">1. Qual evento estamos validando?</Label>
              <select 
                className="h-12 w-full rounded-xl border bg-background px-4 text-base focus:ring-primary focus:border-primary" 
                value={eventId} 
                onChange={(event) => setEventId(event.target.value)}
              >
                <option value="">Selecione um evento...</option>
                {events.data?.data.map((event) => (
                  <option key={event.id} value={event.id}>{event.title}</option>
                ))}
              </select>
            </div>
            
            <div className="space-y-3">
              <Label className="text-base font-semibold">2. Como deseja ler o ingresso?</Label>
              <Tabs value={mode} onValueChange={(v) => setMode(v as any)} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="usb"><Keyboard className="w-4 h-4 mr-2" /> Leitor USB</TabsTrigger>
                  <TabsTrigger value="camera"><Camera className="w-4 h-4 mr-2" /> Câmera</TabsTrigger>
                </TabsList>
                
                <TabsContent value="usb" className="space-y-4 pt-4">
                  <div className="relative">
                    <Input 
                      autoFocus
                      className="h-14 rounded-xl pr-12 text-lg font-mono placeholder:text-muted-foreground/50"
                      value={code} 
                      onChange={(event) => setCode(event.target.value)} 
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && eventId && code) {
                          mutation.mutate(code);
                        }
                      }}
                      placeholder='Ex: {"uuid":"...", "signature":"..."}' 
                      disabled={!eventId}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Dica: Leitores USB geralmente pressionam "Enter" sozinhos no final do codigo.
                  </p>
                  <Button 
                    size="default"
                    className="w-full h-14 text-lg font-bold rounded-xl"
                    disabled={!eventId || !code || mutation.isPending} 
                    onClick={() => mutation.mutate(code)}
                  >
                    {mutation.isPending ? "Validando..." : "Validar Entrada"}
                  </Button>
                </TabsContent>
                
                <TabsContent value="camera" className="pt-4">
                  {!eventId ? (
                    <div className="p-4 text-sm text-center text-muted-foreground border rounded-md bg-muted/30">
                      Selecione um evento primeiro para ativar a câmera.
                    </div>
                  ) : (
                    <div className="border-2 border-primary/20 rounded-xl overflow-hidden bg-black">
                      <div id="reader" className="w-full"></div>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
            
          </CardContent>
        </Card>

        <Card className="shadow-md border-border/50 sticky top-24">
          <CardHeader>
            <CardTitle>Visor do Operador</CardTitle>
          </CardHeader>
          <CardContent className="min-h-[300px] flex items-center justify-center p-6">
            {getStatusDisplay()}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
