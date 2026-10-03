"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Minus, Plus, Shrink, ZoomIn } from "lucide-react";
import { publicAssetUrl } from "@/lib/public-asset-url";

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const STEP = 0.5;

type Offset = { x: number; y: number };

/**
 * Mapa do evento (setores, camarotes, palco) enviado pelo produtor.
 * Sem imagem cadastrada, a seção inteira não é renderizada.
 */
export function VenueMap({ url, title }: { url?: string | null; title: string }) {
  const src = publicAssetUrl(url ?? undefined);
  const frameRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; origin: Offset; moved: boolean } | null>(null);
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [failed, setFailed] = useState(false);

  // Impede que a imagem ampliada seja arrastada para fora da moldura.
  const clamp = useCallback((next: Offset, level: number): Offset => {
    const frame = frameRef.current;
    if (!frame || level <= 1) return { x: 0, y: 0 };
    const maxX = (frame.clientWidth * (level - 1)) / 2;
    const maxY = (frame.clientHeight * (level - 1)) / 2;
    return {
      x: Math.min(maxX, Math.max(-maxX, next.x)),
      y: Math.min(maxY, Math.max(-maxY, next.y))
    };
  }, []);

  const applyZoom = useCallback((level: number) => {
    const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, level));
    setZoom(next);
    setOffset((current) => clamp(current, next));
  }, [clamp]);

  useEffect(() => {
    setZoom(MIN_ZOOM);
    setOffset({ x: 0, y: 0 });
    setFailed(false);
  }, [src]);

  if (!src || failed) return null;

  const zoomed = zoom > MIN_ZOOM;

  return (
    <section className="space-y-4" aria-label="Mapa do evento">
      <h2 className="text-2xl font-semibold tracking-tight">Mapa do evento</h2>
      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <p className="flex items-center gap-2 border-b px-4 py-3 text-sm text-muted-foreground">
          <ZoomIn className="h-4 w-4 shrink-0" aria-hidden />
          Toque na imagem ou use os controles para dar zoom.
        </p>
        <div className="p-3 sm:p-4">
          <div
            ref={frameRef}
            className={`relative aspect-square w-full touch-pan-y select-none overflow-hidden rounded-lg bg-muted/40 sm:aspect-[4/3] ${
              zoomed ? (dragging ? "cursor-grabbing touch-none" : "cursor-grab touch-none") : "cursor-zoom-in"
            }`}
            onPointerDown={(event) => {
              dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, origin: offset, moved: false };
              if (zoomed) {
                event.currentTarget.setPointerCapture(event.pointerId);
                setDragging(true);
              }
            }}
            onPointerMove={(event) => {
              const drag = dragRef.current;
              if (!drag || drag.pointerId !== event.pointerId) return;
              const dx = event.clientX - drag.startX;
              const dy = event.clientY - drag.startY;
              if (Math.abs(dx) > 4 || Math.abs(dy) > 4) drag.moved = true;
              if (zoomed) setOffset(clamp({ x: drag.origin.x + dx, y: drag.origin.y + dy }, zoom));
            }}
            onPointerUp={(event) => {
              const drag = dragRef.current;
              dragRef.current = null;
              setDragging(false);
              if (!drag || drag.pointerId !== event.pointerId || drag.moved) return;
              // Toque simples: amplia; no zoom máximo, volta ao tamanho original.
              applyZoom(zoom >= MAX_ZOOM ? MIN_ZOOM : zoom + 1);
            }}
            onPointerCancel={() => {
              dragRef.current = null;
              setDragging(false);
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- imagem livre do produtor, sem proporção conhecida */}
            <img
              src={src}
              alt={`Mapa do evento ${title}`}
              loading="lazy"
              draggable={false}
              onError={() => setFailed(true)}
              className={`h-full w-full object-contain ${dragging ? "" : "transition-transform duration-200"}`}
              style={{ transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${zoom})` }}
            />

            <div
              className="absolute bottom-3 right-3 flex items-center gap-1 rounded-full border bg-background/90 p-1 shadow-md backdrop-blur"
              onPointerDown={(event) => event.stopPropagation()}
              onPointerUp={(event) => event.stopPropagation()}
            >
              <ControlButton label="Diminuir zoom" disabled={!zoomed} onClick={() => applyZoom(zoom - STEP)}>
                <Minus className="h-4 w-4" />
              </ControlButton>
              <ControlButton label="Voltar ao tamanho original" disabled={!zoomed} onClick={() => applyZoom(MIN_ZOOM)}>
                <Shrink className="h-4 w-4" />
              </ControlButton>
              <ControlButton label="Aumentar zoom" disabled={zoom >= MAX_ZOOM} onClick={() => applyZoom(zoom + STEP)}>
                <Plus className="h-4 w-4" />
              </ControlButton>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ControlButton({ label, disabled, onClick, children }: { label: string; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-9 w-9 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted disabled:opacity-40 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}
