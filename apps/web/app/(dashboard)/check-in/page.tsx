"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  CheckCircle2, ScanLine, XCircle, AlertTriangle, Camera, Keyboard, Search, UserCheck, History, Clock, Ticket
} from "lucide-react";
import type { Html5QrcodeScanner } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { dateTime } from "@/lib/utils";
import type { EventFlowEvent, Paginated } from "@/types/eventflow";

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => { setDebouncedValue(value); }, delay);
    return () => { clearTimeout(handler); };
  }, [value, delay]);
  return debouncedValue;
}

export default function CheckInPage() {
  const qc = useQueryClient();
  const [eventId, setEventId] = useState("");
  const [code, setCode] = useState("");
  const [mode, setMode] = useState<"usb" | "camera" | "search">("usb");
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 500);

  const { data: events } = useQuery({
    queryKey: ["events-checkin"],
    queryFn: () => api<Paginated<EventFlowEvent>>("/events?status=PUBLISHED")
  });

  const invalidateLogs = () => qc.invalidateQueries({ queryKey: ["checkin-logs", eventId] });

  const validateMutation = useMutation({
    mutationFn: (scannedCode: string) => 
      api<{ status: string; message: string; ticket: any }>(`/check-in/events/${eventId}/validate`, { 
        method: "POST", body: JSON.stringify({ code: scannedCode }) 
      }),
    onSuccess: (data) => {
      if (mode === "usb") setCode("");
      invalidateLogs();
    }
  });

  // Fetch Participants for Search mode
  const { data: participants, isLoading: isSearching } = useQuery({
    queryKey: ["participants-search", eventId, debouncedSearch],
    queryFn: () => api<Paginated<any>>(`/participants?eventId=${eventId}&search=${debouncedSearch}&perPage=10`),
    enabled: !!eventId && mode === "search"
  });

  // Fetch History (Timeline)
  const { data: logs } = useQuery({
    queryKey: ["checkin-logs", eventId],
    queryFn: () => api<any[]>(`/check-in/events/${eventId}/logs`),
    enabled: !!eventId
  });

  useEffect(() => {
    if (mode === "camera" && eventId) {
      import("html5-qrcode").then(({ Html5QrcodeScanner }) => {
        if (!scannerRef.current) {
          scannerRef.current = new Html5QrcodeScanner("reader", { fps: 10, qrbox: { width: 250, height: 250 } }, false);
          scannerRef.current.render(
            (decodedText) => {
              if (validateMutation.isPending) return;
              try { new Audio("/beep.mp3").play().catch(() => {}); } catch(e) {}
              validateMutation.mutate(decodedText);
            },
            () => {}
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
  }, [mode, eventId, validateMutation.isPending]);

  const getStatusDisplay = () => {
    if (validateMutation.isPending) {
      return (
        <div className="flex flex-col items-center justify-center p-10 h-[250px] animate-pulse">
          <ScanLine className="h-12 w-12 mb-4 opacity-50 animate-bounce" />
          <p>Processando...</p>
        </div>
      );
    }
    if (validateMutation.error) {
      return (
        <div className="flex flex-col items-center justify-center p-6 h-[250px] bg-destructive/10 text-destructive rounded-xl border border-destructive/20 animate-in zoom-in-95 duration-200 w-full text-center">
          <AlertTriangle className="h-16 w-16 mb-4" />
          <h2 className="text-2xl font-bold">Erro de Leitura</h2>
          <p className="mt-2">{validateMutation.error.message}</p>
        </div>
      );
    }
    if (!validateMutation.data) {
      return (
        <div className="flex flex-col items-center justify-center p-10 h-[250px] text-muted-foreground border-2 border-dashed rounded-xl bg-muted/20 w-full text-center">
          <ScanLine className="h-12 w-12 mb-4 opacity-50" />
          <p>Pronto para escanear ingressos.</p>
        </div>
      );
    }

    const { status, message, ticket } = validateMutation.data;
    
    if (status === "ENTERED") {
      return (
        <div className="flex flex-col items-center justify-center p-6 h-[250px] bg-green-500/10 text-green-700 dark:text-green-400 rounded-xl border border-green-500/20 animate-in zoom-in-95 duration-200 w-full text-center">
          <CheckCircle2 className="h-16 w-16 mb-4 text-green-500" />
          <h2 className="text-3xl font-bold">Liberado!</h2>
          <p className="font-semibold text-lg mt-1">{ticket?.attendeeName}</p>
          <p className="text-sm opacity-80 mt-1">{ticket?.ticketType?.name}</p>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center p-6 h-[250px] bg-red-500/10 text-red-700 dark:text-red-400 rounded-xl border border-red-500/20 animate-in zoom-in-95 duration-200 w-full text-center">
        <XCircle className="h-16 w-16 mb-4 text-red-500" />
        <h2 className="text-3xl font-bold">{status === "DUPLICATED" ? "Duplicado" : "Recusado"}</h2>
        <p className="font-semibold text-lg mt-1">{ticket?.attendeeName}</p>
        <p className="text-sm opacity-80 mt-2">{message}</p>
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-20">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Check-in de Evento</h1>
        <p className="text-muted-foreground mt-2">Valide ingressos rapidamente com leitor, câmera ou busca manual, e acompanhe o histórico.</p>
      </div>
      
      <div className="grid gap-6 lg:grid-cols-2 items-start">
        <div className="space-y-6">
          <Card className="shadow-sm border-primary/20">
            <CardHeader className="bg-primary/5 pb-6 border-b">
              <CardTitle className="flex items-center gap-2">
                <ScanLine className="h-5 w-5 text-primary" />
                Operação de Entrada
              </CardTitle>
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
                  {events?.data?.map((event) => (
                    <option key={event.id} value={event.id}>{event.title}</option>
                  ))}
                </select>
              </div>
              
              <div className="space-y-3">
                <Label className="text-base font-semibold">2. Escolha o método de validação</Label>
                <Tabs value={mode} onValueChange={(v) => setMode(v as any)} className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="usb"><Keyboard className="w-4 h-4 mr-2" /> Leitor</TabsTrigger>
                    <TabsTrigger value="camera"><Camera className="w-4 h-4 mr-2" /> Câmera</TabsTrigger>
                    <TabsTrigger value="search"><Search className="w-4 h-4 mr-2" /> Busca</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="usb" className="space-y-4 pt-4 min-h-[200px]">
                    <div className="relative">
                      <Input 
                        autoFocus
                        className="h-14 rounded-xl pr-12 text-lg font-mono placeholder:text-muted-foreground/50"
                        value={code} 
                        onChange={(event) => setCode(event.target.value)} 
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && eventId && code) {
                            validateMutation.mutate(code);
                          }
                        }}
                        placeholder='Escaneie o código do ingresso...' 
                        disabled={!eventId}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Dica: Leitores USB geralmente pressionam &quot;Enter&quot; sozinhos no final do codigo.
                    </p>
                    <Button 
                      size="default"
                      className="w-full h-14 text-lg font-bold rounded-xl"
                      disabled={!eventId || !code || validateMutation.isPending} 
                      onClick={() => validateMutation.mutate(code)}
                    >
                      {validateMutation.isPending ? "Validando..." : "Validar Entrada"}
                    </Button>
                  </TabsContent>
                  
                  <TabsContent value="camera" className="pt-4 min-h-[200px]">
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

                  <TabsContent value="search" className="pt-4 space-y-4 min-h-[200px]">
                    {!eventId ? (
                      <div className="p-4 text-sm text-center text-muted-foreground border rounded-md bg-muted/30">
                        Selecione um evento primeiro para buscar participantes.
                      </div>
                    ) : (
                      <>
                        <Input 
                          placeholder="Buscar por nome, e-mail ou documento..." 
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          className="h-12 rounded-xl"
                        />
                        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                          {isSearching ? (
                            <div className="text-center p-4 text-muted-foreground text-sm">Buscando...</div>
                          ) : participants?.data?.length === 0 ? (
                            <div className="text-center p-4 text-muted-foreground text-sm">Nenhum participante encontrado.</div>
                          ) : (
                            participants?.data?.map((t: any) => (
                              <div key={t.id} className="flex items-center justify-between p-3 border rounded-xl hover:bg-muted/50 transition-colors">
                                <div>
                                  <p className="font-semibold">{t.attendeeName}</p>
                                  <p className="text-xs text-muted-foreground flex items-center gap-2">
                                    <Ticket className="h-3 w-3" /> {t.ticketType?.name}
                                  </p>
                                </div>
                                <Button 
                                  variant="secondary" 
                                  size="sm"
                                  disabled={validateMutation.isPending}
                                  onClick={() => validateMutation.mutate(t.code)}
                                >
                                  Fazer Check-in
                                </Button>
                              </div>
                            ))
                          )}
                        </div>
                      </>
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="shadow-md border-border/50 sticky top-6">
            <CardHeader className="pb-4">
              <CardTitle>Visor do Operador</CardTitle>
            </CardHeader>
            <CardContent>
              {getStatusDisplay()}

              <div className="mt-8 pt-6 border-t">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold flex items-center gap-2">
                    <History className="h-4 w-4" /> Histórico Recente
                  </h3>
                  <Badge variant="outline" className="font-normal">{logs?.length || 0} check-ins</Badge>
                </div>
                
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                  {!logs || logs.length === 0 ? (
                    <div className="text-center text-sm text-muted-foreground p-4">Nenhum check-in recente.</div>
                  ) : (
                    logs.map((log: any) => (
                      <div key={log.id} className="flex items-start gap-3 p-3 rounded-xl bg-muted/40 border border-muted">
                        <div className="bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400 p-2 rounded-full shrink-0">
                          <UserCheck className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate">{log.ticket.attendeeName}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                            <Clock className="h-3 w-3" /> {dateTime(log.createdAt)}
                          </p>
                        </div>
                        {log.user && (
                          <div className="text-[10px] text-muted-foreground text-right shrink-0 mt-0.5">
                            Por: {log.user.name.split(" ")[0]}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
