"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2, ScanLine, XCircle, AlertTriangle, Camera, Keyboard,
  Search, UserCheck, History, Clock, Ticket, RefreshCw, SwitchCamera,
  ArrowRight, ShieldAlert
} from "lucide-react";
import type { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

// Bip sintético usando Web Audio API nativa
function playAudioFeedback(type: "success" | "duplicate" | "error") {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === "success") {
      // Tom agudo ascendente duplo
      osc.type = "sine";
      osc.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    } else if (type === "duplicate") {
      // Tom de aviso intermitente
      osc.type = "triangle";
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.setValueAtTime(349.23, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.35);
    } else {
      // Tom grave de erro
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.setValueAtTime(164.81, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    }
  } catch {
    // Ignora se o navegador restringir áudio
  }
}

export default function CheckInPage() {
  const qc = useQueryClient();
  const [eventId, setEventId] = useState("");
  const [code, setCode] = useState("");
  const [mode, setMode] = useState<"usb" | "camera" | "search">("camera");

  // Câmera
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCameraStarting, setIsCameraStarting] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);

  // Debounce e Cooldown pós-leitura
  const validationInFlightRef = useRef(false);
  const lastScannedCodeRef = useRef<string | null>(null);
  const cooldownRef = useRef(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Busca manual
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);

  // Consulta de eventos
  const { data: events, isLoading: isLoadingEvents } = useQuery({
    queryKey: ["events-checkin"],
    queryFn: () => api<Paginated<EventFlowEvent>>("/events?status=PUBLISHED")
  });

  // Se tiver apenas 1 evento publicado e nenhum selecionado, seleciona automaticamente
  useEffect(() => {
    if (!eventId && events?.data && events.data.length === 1) {
      setEventId(events.data[0].id);
    }
  }, [eventId, events]);

  const invalidateLogs = useCallback(() => {
    if (eventId) {
      qc.invalidateQueries({ queryKey: ["checkin-logs", eventId] });
    }
  }, [eventId, qc]);

  // Limpa o cooldown e permite novo scan imediatamente
  const resetCooldown = useCallback(() => {
    cooldownRef.current = false;
    lastScannedCodeRef.current = null;
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setCountdown(null);
  }, []);

  // Inicia contador de desbloqueio automático após leitura
  const startAutoReset = useCallback((seconds: number = 3) => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }
    setCountdown(seconds);
    countdownIntervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(countdownIntervalRef.current!);
          countdownIntervalRef.current = null;
          cooldownRef.current = false;
          lastScannedCodeRef.current = null;
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // Mutação de validação de ingresso
  const validateMutation = useMutation({
    mutationFn: (scannedCode: string) =>
      api<{ status: string; message: string; ticket: any }>(`/check-in/events/${eventId}/validate`, {
        method: "POST",
        body: JSON.stringify({ code: scannedCode })
      }),
    onMutate: () => {
      validationInFlightRef.current = true;
    },
    onSuccess: (data) => {
      if (mode === "usb") setCode("");
      invalidateLogs();

      if (data.status === "ENTERED") {
        playAudioFeedback("success");
      } else if (data.status === "DUPLICATED") {
        playAudioFeedback("duplicate");
      } else {
        playAudioFeedback("error");
      }

      // Inicia contagem regressiva para próximo scan
      startAutoReset(3);
    },
    onError: () => {
      playAudioFeedback("error");
      startAutoReset(4);
    },
    onSettled: () => {
      validationInFlightRef.current = false;
    }
  });

  // Fetch Participantes para a aba de busca
  const { data: participants, isLoading: isSearching } = useQuery({
    queryKey: ["participants-search", eventId, debouncedSearch],
    queryFn: () => api<Paginated<any>>(`/participants?eventId=${eventId}&search=${debouncedSearch}&perPage=10`),
    enabled: !!eventId && mode === "search"
  });

  // Fetch Histórico Recente de Check-ins
  const { data: logs } = useQuery({
    queryKey: ["checkin-logs", eventId],
    queryFn: () => api<any[]>(`/check-in/events/${eventId}/logs`),
    enabled: !!eventId
  });

  // Callback estável para leitura via Ref (não causa reinício da câmera quando o estado muda)
  const handleScannedCodeRef = useRef<(text: string) => void>(() => {});
  handleScannedCodeRef.current = (scannedText: string) => {
    if (!scannedText || validationInFlightRef.current || cooldownRef.current) {
      return;
    }

    const trimmed = scannedText.trim();
    if (trimmed === lastScannedCodeRef.current) {
      return;
    }

    lastScannedCodeRef.current = trimmed;
    cooldownRef.current = true;
    validateMutation.mutate(trimmed);
  };

  const [retryNonce, setRetryNonce] = useState(0);
  const restartCamera = useCallback(() => {
    setCameraError(null);
    setRetryNonce((n) => n + 1);
  }, []);

  // Alterna entre as câmeras disponíveis
  const toggleCamera = useCallback(() => {
    if (cameras.length <= 1) return;
    const currentIndex = cameras.findIndex(c => c.id === selectedCameraId);
    const nextIndex = (currentIndex + 1) % cameras.length;
    setSelectedCameraId(cameras[nextIndex].id);
  }, [cameras, selectedCameraId]);

  // Ciclo de vida estável da câmera
  useEffect(() => {
    let isCancelled = false;

    async function initCamera() {
      if (mode !== "camera" || !eventId) {
        return;
      }

      if (!window.isSecureContext) {
        setCameraError("A câmera requer uma conexão segura (HTTPS). Em desenvolvimento, use localhost.");
        return;
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError("Este navegador não disponibiliza acesso à câmera. Utilize Chrome, Safari ou Edge.");
        return;
      }

      setCameraError(null);
      setIsCameraStarting(true);

      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
        if (isCancelled) return;

        // Se houver uma instância anterior, limpa com segurança
        if (scannerRef.current) {
          const oldScanner = scannerRef.current;
          scannerRef.current = null;
          try {
            if (oldScanner.isScanning) {
              await oldScanner.stop();
            }
            oldScanner.clear();
          } catch {}
        }

        if (isCancelled) return;

        const readerElement = document.getElementById("reader");
        if (!readerElement) {
          setIsCameraStarting(false);
          return;
        }

        const scanner = new Html5Qrcode("reader", {
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          verbose: false
        });
        scannerRef.current = scanner;

        const cameraConfig = selectedCameraId
          ? { deviceId: { exact: selectedCameraId } }
          : { facingMode: "environment" };

        await scanner.start(
          cameraConfig,
          {
            fps: 10,
            qrbox: (viewfinderWidth, viewfinderHeight) => {
              const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
              const edge = Math.max(160, Math.floor(minEdge * 0.72));
              return { width: edge, height: edge };
            },
            aspectRatio: 1.0
          },
          (decodedText) => {
            handleScannedCodeRef.current(decodedText);
          },
          () => {
            // Ignora frames vazios
          }
        );

        if (isCancelled) {
          if (scanner.isScanning) await scanner.stop();
          scanner.clear();
          return;
        }

        setIsCameraActive(true);
        setIsCameraStarting(false);

        // Busca a lista de câmeras apenas se ainda não tiver buscado
        Html5Qrcode.getCameras()
          .then((devices) => {
            if (!isCancelled && devices && devices.length > 0) {
              setCameras(devices);
            }
          })
          .catch(() => {});

      } catch (err: any) {
        if (isCancelled) return;
        console.error("Falha ao iniciar a câmera:", err);
        setIsCameraStarting(false);
        setIsCameraActive(false);

        if (err?.name === "NotAllowedError" || err?.message?.includes("Permission")) {
          setCameraError("Permissão de câmera negada. Conceda permissão no navegador e clique em Tentar Novamente.");
        } else if (err?.name === "NotFoundError" || err?.message?.includes("No camera")) {
          setCameraError("Nenhuma câmera encontrada no dispositivo.");
        } else {
          setCameraError("Não foi possível acessar a câmera. Verifique se outro app está usando-a e tente novamente.");
        }
      }
    }

    void initCamera();

    return () => {
      isCancelled = true;
      if (scannerRef.current) {
        const currentScanner = scannerRef.current;
        scannerRef.current = null;
        if (currentScanner.isScanning) {
          currentScanner.stop().then(() => {
            try { currentScanner.clear(); } catch {}
          }).catch(() => {});
        } else {
          try { currentScanner.clear(); } catch {}
        }
      }
      setIsCameraActive(false);
      setIsCameraStarting(false);
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, [mode, eventId, selectedCameraId, retryNonce]);

  // Renderizador do Visor do Operador
  const renderOperatorScreen = () => {
    if (validateMutation.isPending) {
      return (
        <div className="flex flex-col items-center justify-center p-8 h-[270px] bg-primary/5 rounded-2xl border border-primary/20 animate-pulse text-center">
          <ScanLine className="h-14 w-14 text-primary mb-4 animate-bounce" />
          <h3 className="text-xl font-bold tracking-tight">Validando Ingresso...</h3>
          <p className="text-sm text-muted-foreground mt-1">Consultando autenticidade no banco de dados</p>
        </div>
      );
    }

    if (validateMutation.error) {
      return (
        <div className="flex flex-col items-center justify-center p-6 h-[270px] bg-red-500/10 text-destructive rounded-2xl border-2 border-red-500/30 animate-in zoom-in-95 duration-200 text-center">
          <AlertTriangle className="h-14 w-14 mb-3 text-red-500" />
          <h2 className="text-2xl font-black">Ingresso Não Encontrado</h2>
          <p className="mt-2 text-sm text-red-700 dark:text-red-300 font-medium max-w-sm">
            {validateMutation.error.message}
          </p>
          <div className="mt-4 flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                validateMutation.reset();
                resetCooldown();
              }}
              className="rounded-xl border-red-300 dark:border-red-800"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Ler Novamente
            </Button>
          </div>
        </div>
      );
    }

    if (!validateMutation.data) {
      return (
        <div className="flex flex-col items-center justify-center p-8 h-[270px] text-muted-foreground border-2 border-dashed rounded-2xl bg-muted/20 text-center">
          <ScanLine className="h-12 w-12 mb-3 opacity-40" />
          <h3 className="text-lg font-semibold text-foreground">Portaria Pronta</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">
            Posicione o QR Code do ingresso em frente à câmera ou digite o código ao lado.
          </p>
        </div>
      );
    }

    const { status, message, ticket } = validateMutation.data;

    if (status === "ENTERED") {
      return (
        <div className="flex flex-col items-center justify-center p-6 h-[270px] bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 rounded-2xl border-2 border-emerald-500/40 animate-in zoom-in-95 duration-200 text-center relative overflow-hidden">
          <div className="absolute top-3 right-3">
            <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white font-semibold">
              Check-in Confirmado
            </Badge>
          </div>
          <CheckCircle2 className="h-16 w-16 mb-2 text-emerald-500 animate-in zoom-in-50" />
          <h2 className="text-3xl font-black tracking-tight text-emerald-600 dark:text-emerald-400">ENTRADA LIBERADA!</h2>
          <p className="font-bold text-xl mt-1 text-foreground">{ticket?.attendeeName}</p>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className="text-xs bg-background/80 font-medium">
              {ticket?.ticketType?.name || "Ingresso Padrão"}
            </Badge>
            {ticket?.uuid && (
              <span className="font-mono text-xs text-muted-foreground">
                #{ticket.uuid.slice(0, 8).toUpperCase()}
              </span>
            )}
          </div>

          <div className="mt-4 flex items-center gap-3">
            <Button
              size="sm"
              onClick={() => {
                resetCooldown();
                validateMutation.reset();
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-sm"
            >
              Próximo Ingresso {countdown !== null && `(${countdown}s)`}
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </div>
        </div>
      );
    }

    const isDuplicated = status === "DUPLICATED";
    return (
      <div className="flex flex-col items-center justify-center p-6 h-[270px] bg-amber-500/10 text-amber-900 dark:text-amber-200 rounded-2xl border-2 border-amber-500/40 animate-in zoom-in-95 duration-200 text-center relative overflow-hidden">
        <div className="absolute top-3 right-3">
          <Badge variant="destructive" className={isDuplicated ? "bg-amber-600 hover:bg-amber-600 text-white" : ""}>
            {isDuplicated ? "Entrada Repetida" : "Entrada Recusada"}
          </Badge>
        </div>
        {isDuplicated ? (
          <ShieldAlert className="h-16 w-16 mb-2 text-amber-500 animate-in zoom-in-50" />
        ) : (
          <XCircle className="h-16 w-16 mb-2 text-red-500 animate-in zoom-in-50" />
        )}
        <h2 className={`text-2xl font-black tracking-tight ${isDuplicated ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}`}>
          {isDuplicated ? "INGRESSO JÁ UTILIZADO" : "ENTRADA RECUSADA"}
        </h2>
        <p className="font-bold text-lg mt-1 text-foreground">{ticket?.attendeeName || "Participante"}</p>
        <p className="text-sm font-medium opacity-90 mt-1 max-w-sm text-muted-foreground">{message}</p>

        <div className="mt-4 flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              resetCooldown();
              validateMutation.reset();
            }}
            className="rounded-xl font-semibold"
          >
            Escanear Outro {countdown !== null && `(${countdown}s)`}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-20">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Check-in de Evento</h1>
        <p className="text-muted-foreground mt-1">
          Validação em tempo real com câmera integrada, leitor USB de alta velocidade ou busca manual de participantes.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 items-start">
        {/* Painel Esquerdo: Métodos de Leitura */}
        <div className="space-y-6">
          <Card className="shadow-sm border-primary/20 rounded-2xl overflow-hidden">
            <CardHeader className="bg-primary/5 pb-5 border-b">
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <ScanLine className="h-5 w-5 text-primary" />
                  Terminal de Portaria
                </span>
                {eventId && (
                  <Badge variant="outline" className="bg-background text-xs font-normal">
                    Pronto para validação
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              {/* Seleção do Evento */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">1. Selecione o Evento</Label>
                <select
                  className="h-12 w-full rounded-xl border bg-background px-4 text-base font-medium focus:ring-2 focus:ring-primary focus:outline-none transition-all"
                  value={eventId}
                  onChange={(e) => {
                    setEventId(e.target.value);
                    resetCooldown();
                    validateMutation.reset();
                  }}
                  disabled={isLoadingEvents}
                >
                  <option value="">Selecione um evento publicado...</option>
                  {events?.data?.map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Abas de Modo */}
              <div className="space-y-3">
                <Label className="text-sm font-semibold">2. Método de Validação</Label>
                <Tabs value={mode} onValueChange={(v) => {
                  setMode(v as any);
                  resetCooldown();
                }} className="w-full">
                  <TabsList className="grid w-full grid-cols-3 p-1 rounded-xl bg-muted">
                    <TabsTrigger value="camera" className="rounded-lg font-semibold data-[state=active]:shadow-sm">
                      <Camera className="w-4 h-4 mr-2 text-primary" /> Câmera
                    </TabsTrigger>
                    <TabsTrigger value="usb" className="rounded-lg font-semibold data-[state=active]:shadow-sm">
                      <Keyboard className="w-4 h-4 mr-2" /> Leitor / USB
                    </TabsTrigger>
                    <TabsTrigger value="search" className="rounded-lg font-semibold data-[state=active]:shadow-sm">
                      <Search className="w-4 h-4 mr-2" /> Buscar
                    </TabsTrigger>
                  </TabsList>

                  {/* ABA: CÂMERA */}
                  <TabsContent value="camera" className="pt-4 min-h-[300px] space-y-3">
                    {!eventId ? (
                      <div className="p-8 text-center text-sm text-muted-foreground border-2 border-dashed rounded-xl bg-muted/20">
                        <Camera className="w-8 h-8 mx-auto mb-2 opacity-40" />
                        Selecione um evento acima para ativar a câmera.
                      </div>
                    ) : (
                      <>
                        {/* Controles de Câmera */}
                        <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                          <span className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${isCameraActive ? "bg-green-500 animate-pulse" : "bg-muted-foreground"}`} />
                            {isCameraActive ? "Câmera ao vivo" : isCameraStarting ? "Iniciando câmera..." : "Câmera pausada"}
                          </span>

                          {cameras.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={toggleCamera}
                              className="h-8 text-xs font-semibold gap-1.5"
                            >
                              <SwitchCamera className="w-3.5 h-3.5" />
                              Alternar Câmera ({cameras.length})
                            </Button>
                          )}
                        </div>

                        {/* Erro de Câmera */}
                        {cameraError ? (
                          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-5 text-sm text-destructive space-y-3">
                            <div className="flex items-center gap-2 font-bold text-base">
                              <AlertTriangle className="w-5 h-5 shrink-0" />
                              Acesso à Câmera Bloqueado
                            </div>
                            <p className="text-xs leading-relaxed text-destructive/90">
                              {cameraError}
                            </p>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={restartCamera}
                              className="rounded-xl border-destructive/30 hover:bg-destructive/20"
                            >
                              <RefreshCw className="w-3.5 h-3.5 mr-2" /> Tentar Novamente
                            </Button>
                          </div>
                        ) : (
                          /* Viewfinder da Câmera com Overlay Visual */
                          <div className="relative rounded-2xl overflow-hidden bg-black border-2 border-border shadow-inner aspect-square max-h-[380px] mx-auto flex items-center justify-center">
                            <div id="reader" className="w-full h-full overflow-hidden [&_video]:object-cover [&_video]:w-full [&_video]:h-full"></div>

                            {/* Overlay de Alinhamento e Leitura Laser */}
                            {isCameraActive && (
                              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                                {/* Moldura com cantos iluminados */}
                                <div className="relative w-56 h-56 rounded-2xl border-2 border-white/20">
                                  <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-primary rounded-tl-xl -mt-1 -ml-1" />
                                  <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-primary rounded-tr-xl -mt-1 -mr-1" />
                                  <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-primary rounded-bl-xl -mb-1 -ml-1" />
                                  <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-primary rounded-br-xl -mb-1 -mr-1" />

                                  {/* Linha laser de varredura */}
                                  <div className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent shadow-[0_0_12px_rgba(249,115,22,0.9)] animate-[bounce_2.2s_infinite]" />
                                </div>
                              </div>
                            )}

                            {/* Overlay de Cooldown / Sucesso Temporário */}
                            {cooldownRef.current && (
                              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center text-white p-4 text-center animate-in fade-in duration-150">
                                <CheckCircle2 className="w-12 h-12 text-emerald-400 mb-2 animate-in zoom-in-50" />
                                <p className="font-bold text-lg">Leitura Efetuada</p>
                                <p className="text-xs text-white/70 mt-0.5">
                                  Próxima leitura em {countdown !== null ? `${countdown}s` : "..."}
                                </p>
                                <Button
                                  size="sm"
                                  onClick={resetCooldown}
                                  className="mt-3 bg-white text-black hover:bg-white/90 rounded-xl font-bold text-xs"
                                >
                                  Ler Agora
                                </Button>
                              </div>
                            )}

                            {isCameraStarting && (
                              <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-white p-4 text-center">
                                <RefreshCw className="w-8 h-8 animate-spin text-primary mb-2" />
                                <p className="text-sm font-semibold">Iniciando feed de vídeo...</p>
                              </div>
                            )}
                          </div>
                        )}

                        <p className="text-xs text-muted-foreground text-center pt-1">
                          Aponte o código QR impresso ou na tela do celular para o centro do leitor.
                        </p>
                      </>
                    )}
                  </TabsContent>

                  {/* ABA: LEITOR USB / MANUAL */}
                  <TabsContent value="usb" className="space-y-4 pt-4 min-h-[250px]">
                    <div className="space-y-2">
                      <Label htmlFor="manual-code" className="text-xs font-semibold text-muted-foreground">
                        Código do Ingresso (UUID completo ou código de 8 dígitos)
                      </Label>
                      <Input
                        id="manual-code"
                        autoFocus
                        className="h-14 rounded-xl pr-12 text-lg font-mono uppercase placeholder:text-muted-foreground/40 font-bold"
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && eventId && code.trim()) {
                            validateMutation.mutate(code.trim());
                          }
                        }}
                        placeholder="Ex: 8F3B2075 ou UUID..."
                        disabled={!eventId || validateMutation.isPending}
                      />
                    </div>
                    <div className="p-3 bg-muted/40 rounded-xl border text-xs text-muted-foreground leading-relaxed">
                      💡 <strong>Dica:</strong> Leitores de código de barras USB/Bluetooth funcionam aqui automaticamente disparando &quot;Enter&quot;. Você também pode digitar o código impresso no voucher do participante.
                    </div>
                    <Button
                      size="default"
                      className="w-full h-14 text-base font-bold rounded-xl shadow-sm"
                      disabled={!eventId || !code.trim() || validateMutation.isPending}
                      onClick={() => validateMutation.mutate(code.trim())}
                    >
                      {validateMutation.isPending ? "Validando no Banco..." : "Confirmar Entrada Manual"}
                    </Button>
                  </TabsContent>

                  {/* ABA: BUSCA MANUAL */}
                  <TabsContent value="search" className="pt-4 space-y-4 min-h-[250px]">
                    {!eventId ? (
                      <div className="p-8 text-center text-sm text-muted-foreground border-2 border-dashed rounded-xl bg-muted/20">
                        Selecione um evento primeiro para buscar participantes.
                      </div>
                    ) : (
                      <>
                        <Input
                          placeholder="Buscar por nome do participante, e-mail ou CPF..."
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          className="h-12 rounded-xl"
                        />
                        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                          {isSearching ? (
                            <div className="text-center p-6 text-muted-foreground text-sm flex items-center justify-center gap-2">
                              <RefreshCw className="w-4 h-4 animate-spin" /> Buscando na base de dados...
                            </div>
                          ) : participants?.data?.length === 0 ? (
                            <div className="text-center p-6 text-muted-foreground text-sm border rounded-xl bg-muted/10">
                              Nenhum participante encontrado para este evento.
                            </div>
                          ) : (
                            participants?.data?.map((t: any) => (
                              <div
                                key={t.id}
                                className="flex items-center justify-between p-3.5 border rounded-xl hover:bg-muted/40 transition-colors bg-card"
                              >
                                <div className="min-w-0 pr-3">
                                  <p className="font-bold text-sm truncate text-foreground">{t.attendeeName}</p>
                                  <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                                    <Ticket className="h-3 w-3 text-primary" />
                                    {t.ticketType?.name || "Ingresso"}
                                    {t.status === "USED" && (
                                      <Badge variant="outline" className="text-[10px] text-amber-600 bg-amber-50 dark:bg-amber-950/40 ml-1.5">
                                        Já Entrou
                                      </Badge>
                                    )}
                                  </p>
                                </div>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  className="rounded-xl font-semibold shrink-0"
                                  disabled={validateMutation.isPending}
                                  onClick={() => validateMutation.mutate(t.uuid || t.id)}
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

        {/* Painel Direito: Visor do Operador & Histórico */}
        <div className="space-y-6">
          <Card className="shadow-md border-border/60 sticky top-6 rounded-2xl overflow-hidden">
            <CardHeader className="pb-3 border-b bg-muted/20">
              <CardTitle className="text-lg flex items-center justify-between">
                <span>Visor do Operador</span>
                {eventId && (
                  <Badge variant="outline" className="text-xs font-normal">
                    Conexão Ativa
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              {/* Visor em tempo real */}
              {renderOperatorScreen()}

              {/* Histórico Recente de Entradas */}
              <div className="pt-4 border-t">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-sm flex items-center gap-2 text-foreground">
                    <History className="h-4 w-4 text-primary" /> Histórico Recente
                  </h3>
                  <Badge variant="secondary" className="font-medium text-xs">
                    {logs?.length || 0} registros
                  </Badge>
                </div>

                <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                  {!logs || logs.length === 0 ? (
                    <div className="text-center text-xs text-muted-foreground p-8 border border-dashed rounded-xl">
                      Nenhum check-in realizado até o momento.
                    </div>
                  ) : (
                    logs.map((log: any) => {
                      const isEntered = log.status === "ENTERED";
                      const isDuplicated = log.status === "DUPLICATED";

                      return (
                        <div
                          key={log.id}
                          className="flex items-start gap-3 p-3 rounded-xl bg-card border border-border/60 shadow-2xs hover:border-primary/30 transition-colors"
                        >
                          <div
                            className={`p-2 rounded-xl shrink-0 ${
                              isEntered
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
                                : isDuplicated
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"
                                : "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300"
                            }`}
                          >
                            <UserCheck className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-bold text-sm truncate text-foreground">
                                {log.ticket?.attendeeName || "Participante"}
                              </p>
                              <span className="text-[10px] text-muted-foreground shrink-0 flex items-center gap-1 font-mono">
                                <Clock className="h-3 w-3" />
                                {dateTime(log.createdAt)}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <Badge variant="outline" className="text-[10px] font-normal py-0 px-1.5 h-5">
                                {log.ticket?.ticketType?.name || "Ingresso"}
                              </Badge>

                              <Badge
                                variant="outline"
                                className={`text-[10px] font-semibold py-0 px-1.5 h-5 ${
                                  isEntered
                                    ? "border-emerald-300 text-emerald-700 dark:text-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/20"
                                    : isDuplicated
                                    ? "border-amber-300 text-amber-700 dark:text-amber-300 bg-amber-50/50 dark:bg-amber-950/20"
                                    : "border-red-300 text-red-700 dark:text-red-300 bg-red-50/50 dark:bg-red-950/20"
                                }`}
                              >
                                {isEntered ? "Liberado" : isDuplicated ? "Duplicado" : "Recusado"}
                              </Badge>

                              {log.user && (
                                <span className="text-[10px] text-muted-foreground ml-auto">
                                  Por {log.user.name.split(" ")[0]}
                                </span>
                              )}
                            </div>

                            {log.reason && (
                              <p className="mt-1 text-xs text-muted-foreground/90 italic">
                                Motivo: {log.reason}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })
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
