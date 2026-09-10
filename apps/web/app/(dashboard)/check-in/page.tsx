"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2, ScanLine, XCircle, AlertTriangle, Camera, Keyboard,
  Search, UserCheck, History, Clock, Ticket, RefreshCw, SwitchCamera,
  ArrowRight, ShieldAlert, FlipHorizontal, Zap, UploadCloud
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
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
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

// Resposta tátil / vibração para celulares
function triggerHapticFeedback(type: "success" | "duplicate" | "error") {
  if (typeof window !== "undefined" && "vibrate" in navigator) {
    try {
      if (type === "success") {
        navigator.vibrate([80, 40, 80]);
      } else if (type === "duplicate") {
        navigator.vibrate([150, 100, 150]);
      } else {
        navigator.vibrate([250]);
      }
    } catch {
      // Ignora erro se vibração não permitida
    }
  }
}

// Auxiliares de detecção e classificação de lentes
function isFrontCamera(label?: string): boolean {
  if (!label) return false;
  const l = label.toLowerCase();
  return (
    l.includes("front") ||
    l.includes("frontal") ||
    l.includes("user") ||
    l.includes("selfie") ||
    l.includes("face") ||
    l.includes("anterior") ||
    l.includes("facing front")
  );
}

function isBackCamera(label?: string): boolean {
  if (!label) return false;
  if (isFrontCamera(label)) return false;
  const l = label.toLowerCase();
  return (
    l.includes("back") ||
    l.includes("traseir") ||
    l.includes("rear") ||
    l.includes("environment") ||
    l.includes("wide") ||
    l.includes("outward") ||
    l.includes("extern") ||
    l.includes("principal") ||
    l.includes("main") ||
    l.includes("facing back") ||
    l.includes("0, facing back")
  );
}

function formatCameraLabel(device: { id: string; label: string }, index: number): string {
  if (isBackCamera(device.label)) {
    return `📸 Traseira: ${device.label || `Lente ${index + 1}`}`;
  }
  if (isFrontCamera(device.label)) {
    return `🤳 Frontal: ${device.label || `Lente ${index + 1}`}`;
  }
  return `📷 Câmera ${index + 1}${device.label ? ` (${device.label})` : ""}`;
}

export default function CheckInPage() {
  const qc = useQueryClient();
  const [eventId, setEventId] = useState("");
  const [code, setCode] = useState("");
  const [mode, setMode] = useState<"usb" | "camera" | "search">("camera");

  // Câmera & Scanner
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const nativeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const [activeCameraId, setActiveCameraId] = useState<string>("");
  const [flipHorizontal, setFlipHorizontal] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [torchActive, setTorchActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCameraStarting, setIsCameraStarting] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isScanningFile, setIsScanningFile] = useState(false);

  // Debounce e Cooldown pós-leitura
  const validationInFlightRef = useRef(false);
  const lastScannedCodeRef = useRef<string | null>(null);
  const cooldownRef = useRef(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Busca manual
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);

  // Consulta de eventos publicados
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
        triggerHapticFeedback("success");
      } else if (data.status === "DUPLICATED") {
        playAudioFeedback("duplicate");
        triggerHapticFeedback("duplicate");
      } else {
        playAudioFeedback("error");
        triggerHapticFeedback("error");
      }

      // Inicia contagem regressiva para próximo scan
      startAutoReset(3);
    },
    onError: () => {
      playAudioFeedback("error");
      triggerHapticFeedback("error");
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
    const currentId = selectedCameraId || activeCameraId;
    const currentIndex = cameras.findIndex((c) => c.id === currentId);
    const nextIndex = (currentIndex + 1) % cameras.length;
    setSelectedCameraId(cameras[nextIndex].id);
  }, [cameras, selectedCameraId, activeCameraId]);

  // Controle de Lanterna (Flashlight)
  const toggleTorch = useCallback(() => {
    if (!mediaStreamRef.current) return;
    const [track] = mediaStreamRef.current.getVideoTracks();
    if (!track) return;
    const nextState = !torchActive;
    track.applyConstraints({ advanced: [{ torch: nextState }] as any })
      .then(() => setTorchActive(nextState))
      .catch((err) => console.warn("Erro ao alternar lanterna:", err));
  }, [torchActive]);

  // Leitura de Arquivo / Foto do Voucher
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsScanningFile(true);
    try {
      // 1. Tenta decodificar via BarcodeDetector nativo no navegador (altíssima resolução)
      if (typeof window !== "undefined" && "BarcodeDetector" in window) {
        try {
          const imgBitmap = await createImageBitmap(file);
          const detector = new (window as any).BarcodeDetector({
            formats: ["qr_code", "code_128", "data_matrix"]
          });
          const detected = await detector.detect(imgBitmap);
          if (detected && detected.length > 0 && detected[0].rawValue) {
            handleScannedCodeRef.current(detected[0].rawValue);
            setIsScanningFile(false);
            if (event.target) event.target.value = "";
            return;
          }
        } catch {}
      }

      // 2. Fallback via Html5Qrcode.scanFile
      const { Html5Qrcode } = await import("html5-qrcode");
      const tempScanner = scannerRef.current || new Html5Qrcode("reader-hidden-fallback", { verbose: false });
      const decodedText = await tempScanner.scanFile(file, true);
      if (decodedText) {
        handleScannedCodeRef.current(decodedText);
      }
    } catch {
      alert("Não foi possível identificar o QR Code nesta imagem. Tente uma foto mais aproximada ou digite o código manualmente.");
    } finally {
      setIsScanningFile(false);
      if (event.target) event.target.value = "";
    }
  };

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

        // Limpa instâncias anteriores
        if (nativeIntervalRef.current) {
          clearInterval(nativeIntervalRef.current);
          nativeIntervalRef.current = null;
        }

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

        // 1. Enumera câmeras ANTES de iniciar para priorizar a lente traseira no mobile
        let devicesList = cameras;
        if (devicesList.length === 0) {
          try {
            const fetchedDevices = await Html5Qrcode.getCameras();
            if (fetchedDevices && fetchedDevices.length > 0) {
              const sorted = [...fetchedDevices].sort((a, b) => {
                const aBack = isBackCamera(a.label);
                const bBack = isBackCamera(b.label);
                if (aBack && !bBack) return -1;
                if (!aBack && bBack) return 1;
                return 0;
              });
              devicesList = sorted;
              if (!isCancelled) {
                setCameras(sorted);
              }
            }
          } catch (camListErr) {
            console.warn("Aviso ao enumerar dispositivos:", camListErr);
          }
        }

        if (isCancelled) return;

        // 2. Determina qual câmera usar (prioriza TRASEIRA caso o usuário não tenha selecionado)
        let cameraConfig: any;
        let chosenId = selectedCameraId;

        if (!chosenId && devicesList.length > 0) {
          const backCam =
            devicesList.find((d) => isBackCamera(d.label)) ||
            devicesList.find((d) => !isFrontCamera(d.label)) ||
            devicesList[0];
          if (backCam) {
            chosenId = backCam.id;
          }
        }

        if (chosenId) {
          cameraConfig = chosenId;
          if (!isCancelled) {
            setActiveCameraId(chosenId);
          }
        } else {
          cameraConfig = { facingMode: "environment" };
        }

        const scanner = new Html5Qrcode("reader", {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.DATA_MATRIX
          ],
          verbose: false,
          experimentalFeatures: {
            useBarCodeDetectorIfSupported: true
          }
        });
        scannerRef.current = scanner;

        await scanner.start(
          cameraConfig,
          {
            fps: 20,
            disableFlip: true // Crucial: evita acúmulo de transformações de matriz no canvas
          },
          (decodedText) => {
            handleScannedCodeRef.current(decodedText);
          },
          () => {
            // Frame sem código detectado
          }
        );

        if (isCancelled) {
          if (scanner.isScanning) await scanner.stop();
          scanner.clear();
          return;
        }

        // 3. Extrai MediaStream para autofoco contínuo e suporte a lanterna
        const videoElement = document.querySelector("#reader video") as HTMLVideoElement | null;
        if (videoElement && videoElement.srcObject) {
          const stream = videoElement.srcObject as MediaStream;
          mediaStreamRef.current = stream;
          const [track] = stream.getVideoTracks();
          if (track) {
            const caps = (track.getCapabilities ? track.getCapabilities() : {}) as any;
            // Autofoco contínuo para evitar que a imagem fique embaçada
            if (caps.focusMode && Array.isArray(caps.focusMode) && caps.focusMode.includes("continuous")) {
              track.applyConstraints({ advanced: [{ focusMode: "continuous" }] as any }).catch(() => {});
            }
            if (caps.torch) {
              setHasTorch(true);
            } else {
              setHasTorch(false);
            }
          }
        }

        // 4. Aceleração por Hardware: BarcodeDetector nativo no Chromium / Android
        // Analisa o feed do elemento <video> diretamente na GPU em resolução total 1080p
        if (typeof window !== "undefined" && "BarcodeDetector" in window) {
          try {
            const nativeDetector = new (window as any).BarcodeDetector({
              formats: ["qr_code", "code_128", "data_matrix"]
            });

            if (nativeIntervalRef.current) {
              clearInterval(nativeIntervalRef.current);
            }

            nativeIntervalRef.current = setInterval(async () => {
              if (isCancelled || validationInFlightRef.current || cooldownRef.current) {
                return;
              }

              const vid = document.querySelector("#reader video") as HTMLVideoElement | null;
              if (!vid || vid.readyState < 2 || vid.paused) {
                return;
              }

              try {
                const barcodes = await nativeDetector.detect(vid);
                if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
                  handleScannedCodeRef.current(barcodes[0].rawValue);
                }
              } catch {
                // frame detection pass-through
              }
            }, 100);
          } catch (detErr) {
            console.warn("BarcodeDetector nativo indisponível:", detErr);
          }
        }

        setIsCameraActive(true);
        setIsCameraStarting(false);

        // Atualiza lista de câmeras caso permissão tenha sido concedida só agora
        if (devicesList.length === 0) {
          Html5Qrcode.getCameras()
            .then((devs) => {
              if (!isCancelled && devs && devs.length > 0) {
                const sorted = [...devs].sort((a, b) => {
                  const aBack = isBackCamera(a.label);
                  const bBack = isBackCamera(b.label);
                  if (aBack && !bBack) return -1;
                  if (!aBack && bBack) return 1;
                  return 0;
                });
                setCameras(sorted);
              }
            })
            .catch(() => {});
        }

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
      if (nativeIntervalRef.current) {
        clearInterval(nativeIntervalRef.current);
        nativeIntervalRef.current = null;
      }
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
      mediaStreamRef.current = null;
      setHasTorch(false);
      setTorchActive(false);
      setIsCameraActive(false);
      setIsCameraStarting(false);
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, eventId, selectedCameraId, retryNonce]);

  // Renderizador do Visor do Operador (Coluna Direita)
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
          Validação em tempo real com leitor de alta velocidade por câmera, leitor USB/código de barras ou busca de participantes.
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
                        {/* Controles e Status da Câmera */}
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground px-1">
                          <span className="flex items-center gap-1.5 font-medium">
                            <span className={`w-2.5 h-2.5 rounded-full ${isCameraActive ? "bg-green-500 animate-pulse" : "bg-muted-foreground"}`} />
                            {isCameraActive ? "Câmera ao vivo (Alta Precisão)" : isCameraStarting ? "Iniciando câmera..." : "Câmera pausada"}
                          </span>

                          <div className="flex items-center gap-2">
                            {/* Botão de Lanterna (Flashlight) se suportada pelo aparelho */}
                            {hasTorch && (
                              <Button
                                type="button"
                                variant={torchActive ? "default" : "outline"}
                                size="sm"
                                onClick={toggleTorch}
                                className={`h-8 text-xs font-semibold gap-1.5 rounded-lg transition-all ${
                                  torchActive ? "bg-amber-500 hover:bg-amber-600 text-black shadow-sm" : ""
                                }`}
                                title="Ligar/Desligar lanterna do aparelho"
                              >
                                <Zap className={`w-3.5 h-3.5 ${torchActive ? "fill-current" : ""}`} />
                                {torchActive ? "Lanterna Ligada" : "Lanterna"}
                              </Button>
                            )}

                            {/* Botão de Inverter / Espelhar Imagem */}
                            <Button
                              type="button"
                              variant={flipHorizontal ? "default" : "outline"}
                              size="sm"
                              onClick={() => setFlipHorizontal((prev) => !prev)}
                              className={`h-8 text-xs font-semibold gap-1.5 rounded-lg transition-all ${
                                flipHorizontal ? "bg-primary text-primary-foreground shadow-sm" : ""
                              }`}
                              title="Inverter/Espelhar orientação horizontal do vídeo"
                            >
                              <FlipHorizontal className="w-3.5 h-3.5" />
                              {flipHorizontal ? "Espelhado" : "Inverter"}
                            </Button>

                            {/* Botão de Trocar Câmera */}
                            {cameras.length > 1 && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={toggleCamera}
                                className="h-8 text-xs font-semibold gap-1.5 rounded-lg"
                                title="Alternar entre câmeras disponíveis"
                              >
                                <SwitchCamera className="w-3.5 h-3.5" />
                                Trocar ({cameras.length})
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Seletor de Lentes (caso haja mais de uma câmera) */}
                        {cameras.length > 1 && (
                          <div className="flex items-center gap-2 px-1">
                            <Label htmlFor="camera-lens-select" className="text-xs text-muted-foreground font-medium shrink-0">
                              Lente:
                            </Label>
                            <select
                              id="camera-lens-select"
                              className="h-8 w-full rounded-lg border bg-background px-3 text-xs font-medium focus:ring-2 focus:ring-primary focus:outline-none transition-all truncate"
                              value={selectedCameraId || activeCameraId}
                              onChange={(e) => {
                                setSelectedCameraId(e.target.value);
                              }}
                            >
                              {cameras.map((cam, idx) => (
                                <option key={cam.id} value={cam.id}>
                                  {formatCameraLabel(cam, idx)}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

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
                          /* Viewfinder da Câmera com Overlay Visual e Feedback Instantâneo */
                          <div className="relative rounded-2xl overflow-hidden bg-black border-2 border-border shadow-inner min-h-[320px] max-h-[460px] w-full mx-auto flex items-center justify-center">
                            {/* Feed de vídeo do leitor */}
                            <div
                              id="reader"
                              style={{
                                transform: flipHorizontal ? "scaleX(-1)" : "none",
                                transformOrigin: "center center"
                              }}
                              className="w-full h-full flex items-center justify-center overflow-hidden transition-transform duration-200 [&_video]:w-full [&_video]:h-auto [&_video]:max-h-[460px] [&_video]:object-contain [&_video]:mx-auto"
                            />

                            {/* Botões rápidos flutuantes no canto superior do visor */}
                            {isCameraActive && (
                              <div className="absolute top-3 right-3 z-20 flex items-center gap-2">
                                {hasTorch && (
                                  <button
                                    type="button"
                                    onClick={toggleTorch}
                                    className={`h-9 px-3 rounded-xl backdrop-blur-md transition-all shadow-md flex items-center gap-1.5 text-xs font-semibold ${
                                      torchActive
                                        ? "bg-amber-500 text-black font-bold ring-2 ring-amber-300 shadow-amber-500/30"
                                        : "bg-black/60 text-white hover:bg-black/80 border border-white/20"
                                    }`}
                                    title="Ligar/Desligar Lanterna"
                                    aria-label="Lanterna"
                                  >
                                    <Zap className={`w-3.5 h-3.5 ${torchActive ? "fill-current" : ""}`} />
                                    <span className="hidden sm:inline">{torchActive ? "Ligada" : "Lanterna"}</span>
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => setFlipHorizontal((prev) => !prev)}
                                  className={`h-9 w-9 flex items-center justify-center rounded-xl backdrop-blur-md transition-all shadow-md ${
                                    flipHorizontal
                                      ? "bg-primary text-primary-foreground ring-2 ring-primary/40"
                                      : "bg-black/60 text-white hover:bg-black/80 border border-white/20"
                                  }`}
                                  title="Inverter orientação horizontal da imagem"
                                  aria-label="Inverter Imagem"
                                >
                                  <FlipHorizontal className="w-4 h-4" />
                                </button>

                                {cameras.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={toggleCamera}
                                    className="h-9 w-9 flex items-center justify-center rounded-xl backdrop-blur-md bg-black/60 text-white hover:bg-black/80 border border-white/20 shadow-md transition-all"
                                    title="Alternar entre câmeras"
                                    aria-label="Alternar Câmera"
                                  >
                                    <SwitchCamera className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            )}

                            {/* Viewfinder Premium Unificado com Animação Holográfica de Laser */}
                            {isCameraActive && !validateMutation.isPending && !validateMutation.isSuccess && !validateMutation.isError && (
                              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center z-10">
                                {/* Retângulo Central de Foco com Máscara Escura ao Redor */}
                                <div className="relative w-[250px] h-[250px] sm:w-[270px] sm:h-[270px] rounded-3xl shadow-[0_0_0_9999px_rgba(8,6,20,0.6)] transition-all duration-300">
                                  {/* 4 Cantos Iluminados de Alta Precisão (Design Moderno Neon) */}
                                  <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-2xl shadow-[0_0_12px_hsl(var(--primary))]" />
                                  <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-2xl shadow-[0_0_12px_hsl(var(--primary))]" />
                                  <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-2xl shadow-[0_0_12px_hsl(var(--primary))]" />
                                  <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-2xl shadow-[0_0_12px_hsl(var(--primary))]" />

                                  {/* Borda fina translúcida delimitando a área de leitura */}
                                  <div className="absolute inset-0 rounded-3xl border border-white/15" />

                                  {/* Mira central sutil (crosshair) */}
                                  <div className="absolute inset-0 flex items-center justify-center opacity-25">
                                    <div className="w-5 h-[1px] bg-white" />
                                    <div className="h-5 w-[1px] bg-white absolute" />
                                  </div>

                                  {/* Feixe de Laser Animado de Alta Tecnologia (Varredura Contínua) */}
                                  <div className="absolute inset-x-2 inset-y-2 overflow-hidden rounded-2xl pointer-events-none">
                                    <div className="animate-scanner-laser absolute inset-x-0 pointer-events-none">
                                      {/* Rastro superior de luz holográfica */}
                                      <div className="w-full h-12 bg-gradient-to-t from-primary/30 via-primary/10 to-transparent -mt-12" />
                                      {/* Linha brilhante de varredura laser */}
                                      <div className="w-full h-[2.5px] bg-gradient-to-r from-transparent via-white to-transparent shadow-[0_0_15px_hsl(var(--primary)),0_0_5px_#fff]" />
                                      {/* Rastro inferior de luz */}
                                      <div className="w-full h-6 bg-gradient-to-b from-primary/20 to-transparent" />
                                    </div>
                                  </div>
                                </div>

                                {/* Pílula de instrução posicionada com respiro abaixo da área de captura */}
                                <div className="mt-5 flex items-center gap-2 bg-black/80 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/15 text-white/90 text-xs font-medium shadow-xl">
                                  <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                                  </span>
                                  <span>Aponte a câmera para o QR Code</span>
                                </div>
                              </div>
                            )}

                            {/* OVERLAY 1: Validando no Banco de Dados */}
                            {validateMutation.isPending && (
                              <div className="absolute inset-0 z-30 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center text-white p-6 text-center animate-in fade-in duration-150">
                                <div className="relative mb-3">
                                  <ScanLine className="w-14 h-14 text-primary animate-pulse" />
                                  <RefreshCw className="w-6 h-6 animate-spin text-white absolute -top-1 -right-1" />
                                </div>
                                <p className="font-extrabold text-xl tracking-tight">Validando Ingresso...</p>
                                <p className="text-xs text-white/70 mt-1">Consultando autenticidade no banco de dados</p>
                              </div>
                            )}

                            {/* OVERLAY 2: Resultado Instantâneo sobre o Visor (Perfeito para Mobile!) */}
                            {validateMutation.isSuccess && validateMutation.data && (
                              <div className="absolute inset-0 z-30 flex flex-col items-center justify-center p-4 text-center animate-in zoom-in-95 duration-150 backdrop-blur-md bg-black/85">
                                {validateMutation.data.status === "ENTERED" ? (
                                  <div className="w-full max-w-sm rounded-2xl bg-emerald-500/20 border-2 border-emerald-500/60 p-5 shadow-2xl flex flex-col items-center">
                                    <CheckCircle2 className="w-16 h-16 text-emerald-400 mb-2 animate-in zoom-in-50 duration-200" />
                                    <Badge className="bg-emerald-600 text-white font-bold text-xs uppercase mb-1">
                                      Check-in Confirmado
                                    </Badge>
                                    <h3 className="text-2xl font-black text-emerald-400 tracking-tight">
                                      ENTRADA LIBERADA!
                                    </h3>
                                    <p className="font-bold text-lg text-white mt-1 truncate max-w-full">
                                      {validateMutation.data.ticket?.attendeeName || "Participante"}
                                    </p>
                                    <div className="flex items-center gap-2 mt-1">
                                      <Badge variant="outline" className="text-xs text-emerald-200 border-emerald-400/40">
                                        {validateMutation.data.ticket?.ticketType?.name || "Ingresso Padrão"}
                                      </Badge>
                                      {validateMutation.data.ticket?.uuid && (
                                        <span className="font-mono text-xs text-white/70">
                                          #{validateMutation.data.ticket.uuid.slice(0, 8).toUpperCase()}
                                        </span>
                                      )}
                                    </div>
                                    <Button
                                      size="sm"
                                      onClick={() => {
                                        resetCooldown();
                                        validateMutation.reset();
                                      }}
                                      className="mt-4 w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl h-11 shadow-lg"
                                    >
                                      Próximo Ingresso {countdown !== null ? `(${countdown}s)` : ""}
                                      <ArrowRight className="w-4 h-4 ml-2" />
                                    </Button>
                                  </div>
                                ) : validateMutation.data.status === "DUPLICATED" ? (
                                  <div className="w-full max-w-sm rounded-2xl bg-amber-500/20 border-2 border-amber-500/60 p-5 shadow-2xl flex flex-col items-center">
                                    <ShieldAlert className="w-16 h-16 text-amber-400 mb-2 animate-in zoom-in-50 duration-200" />
                                    <Badge variant="destructive" className="bg-amber-600 text-white font-bold text-xs uppercase mb-1">
                                      Entrada Repetida
                                    </Badge>
                                    <h3 className="text-2xl font-black text-amber-400 tracking-tight">
                                      INGRESSO JÁ UTILIZADO
                                    </h3>
                                    <p className="font-bold text-base text-white mt-1">
                                      {validateMutation.data.ticket?.attendeeName || "Participante"}
                                    </p>
                                    <p className="text-xs text-amber-200/90 mt-1 max-w-xs leading-relaxed">
                                      {validateMutation.data.message || "Este ingresso já foi validado anteriormente."}
                                    </p>
                                    <Button
                                      size="sm"
                                      onClick={() => {
                                        resetCooldown();
                                        validateMutation.reset();
                                      }}
                                      className="mt-4 w-full bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl h-11 shadow-lg"
                                    >
                                      Escanear Outro {countdown !== null ? `(${countdown}s)` : ""}
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="w-full max-w-sm rounded-2xl bg-red-500/20 border-2 border-red-500/60 p-5 shadow-2xl flex flex-col items-center">
                                    <XCircle className="w-16 h-16 text-red-400 mb-2 animate-in zoom-in-50 duration-200" />
                                    <Badge variant="destructive" className="bg-red-600 text-white font-bold text-xs uppercase mb-1">
                                      Entrada Recusada
                                    </Badge>
                                    <h3 className="text-2xl font-black text-red-400 tracking-tight">
                                      ENTRADA RECUSADA
                                    </h3>
                                    <p className="font-bold text-base text-white mt-1">
                                      {validateMutation.data.ticket?.attendeeName || "Participante"}
                                    </p>
                                    <p className="text-xs text-red-200/90 mt-1 max-w-xs leading-relaxed">
                                      {validateMutation.data.message}
                                    </p>
                                    <Button
                                      size="sm"
                                      onClick={() => {
                                        resetCooldown();
                                        validateMutation.reset();
                                      }}
                                      className="mt-4 w-full bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl h-11 shadow-lg"
                                    >
                                      Escanear Outro {countdown !== null ? `(${countdown}s)` : ""}
                                    </Button>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* OVERLAY 3: Erro de Validação (Não Encontrado) */}
                            {validateMutation.isError && (
                              <div className="absolute inset-0 z-30 flex flex-col items-center justify-center p-4 text-center animate-in zoom-in-95 duration-150 backdrop-blur-md bg-black/85">
                                <div className="w-full max-w-sm rounded-2xl bg-red-500/20 border-2 border-red-500/60 p-5 shadow-2xl flex flex-col items-center">
                                  <AlertTriangle className="w-16 h-16 text-red-400 mb-2 animate-in zoom-in-50 duration-200" />
                                  <Badge variant="destructive" className="bg-red-600 text-white font-bold text-xs uppercase mb-1">
                                    Não Encontrado
                                  </Badge>
                                  <h3 className="text-xl font-black text-red-400 tracking-tight">
                                    INGRESSO NÃO ENCONTRADO
                                  </h3>
                                  <p className="text-xs text-red-200/90 mt-1 max-w-xs leading-relaxed">
                                    {validateMutation.error?.message || "Código do ingresso não consta na base deste evento."}
                                  </p>
                                  <Button
                                    size="sm"
                                    onClick={() => {
                                      resetCooldown();
                                      validateMutation.reset();
                                    }}
                                    className="mt-4 w-full bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl h-11 shadow-lg"
                                  >
                                    <RefreshCw className="w-4 h-4 mr-2" /> Ler Novamente
                                  </Button>
                                </div>
                              </div>
                            )}

                            {/* OVERLAY 4: Iniciando Câmera */}
                            {isCameraStarting && (
                              <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-white p-4 text-center z-20">
                                <RefreshCw className="w-8 h-8 animate-spin text-primary mb-2" />
                                <p className="text-sm font-semibold">Iniciando leitor de alta precisão...</p>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Botão de Contingência: Carregar Foto ou Voucher Digital */}
                        <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            onChange={handleFileUpload}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isScanningFile || validateMutation.isPending}
                            className="rounded-xl text-xs font-semibold gap-2 border-dashed h-9 px-4"
                          >
                            {isScanningFile ? (
                              <>
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Analisando Imagem...
                              </>
                            ) : (
                              <>
                                <UploadCloud className="w-3.5 h-3.5 text-primary" /> Carregar Foto / Voucher
                              </>
                            )}
                          </Button>
                        </div>

                        <p className="text-xs text-muted-foreground text-center">
                          Aponte para o QR Code do ingresso. Mantenha a cerca de 15 a 20 cm para foco nítido.
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

      {/* Container invisível para fallback de escaneamento de arquivos */}
      <div id="reader-hidden-fallback" className="hidden" />
    </div>
  );
}
