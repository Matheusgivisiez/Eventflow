"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, ImagePlus, Loader2, X } from "lucide-react";
import Image from "next/image";
import Cropper, { type Area } from "react-easy-crop";
import { uploadFile } from "@/lib/api";
import { getApiUrl } from "@/lib/api-url";

interface ImageUploadProps {
  value?: string;
  onChange: (url: string | undefined) => void;
  label?: string;
  aspect?: number;
}

export function ImageUpload({ value, onChange, label, aspect = 1 }: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string>();
  const [preview, setPreview] = useState(value);
  const [dragOver, setDragOver] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string>();
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area>();

  useEffect(() => () => {
    if (imageToCrop) URL.revokeObjectURL(imageToCrop);
  }, [imageToCrop]);

  const handleUpload = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    setError(undefined);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setImageToCrop(URL.createObjectURL(file));
  }, []);

  const finishCrop = useCallback(async () => {
    if (!imageToCrop || !croppedAreaPixels) return;
    setUploading(true);
    setError(undefined);
    try {
      const croppedFile = await createCroppedImage(imageToCrop, croppedAreaPixels);
      const { url } = await uploadFile(croppedFile);
      const fullUrl = toPublicAssetUrl(url);
      setPreview(fullUrl);
      onChange(fullUrl);
      URL.revokeObjectURL(imageToCrop);
      setImageToCrop(undefined);
    } catch (uploadError) {
      onChange(undefined);
      setError(uploadError instanceof Error ? uploadError.message : "Não foi possível enviar a imagem.");
    } finally {
      setUploading(false);
    }
  }, [croppedAreaPixels, imageToCrop, onChange]);

  const cancelCrop = useCallback(() => {
    if (imageToCrop) URL.revokeObjectURL(imageToCrop);
    setImageToCrop(undefined);
  }, [imageToCrop]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  }, [handleUpload]);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
  }, [handleUpload]);

  const remove = useCallback(() => {
    setPreview(undefined);
    onChange(undefined);
  }, [onChange]);

  if (preview) {
    return (
      <div className="relative h-40 overflow-hidden rounded-md border">
        <Image
          src={preview}
          alt="Preview"
          fill
          sizes="(max-width: 768px) 100vw, 640px"
          className="object-cover"
        />
        <button
          type="button"
          onClick={remove}
          className="absolute right-2 top-2 rounded-full bg-background/80 p-1 text-foreground shadow hover:bg-background"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  if (imageToCrop) {
    return (
      <div className="space-y-3">
        <div className="relative h-72 overflow-hidden rounded-md bg-black">
          <Cropper
            image={imageToCrop}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            onCropChange={setCrop}
            onCropComplete={(_, pixels) => setCroppedAreaPixels(pixels)}
            onZoomChange={setZoom}
          />
        </div>
        <label className="flex items-center gap-3 text-xs text-muted-foreground">
          Zoom
          <input
            type="range"
            min={1}
            max={3}
            step={0.1}
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
            className="w-full accent-primary"
          />
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={cancelCrop} className="rounded-md border px-3 py-2 text-sm hover:bg-muted">
            Cancelar
          </button>
          <button
            type="button"
            onClick={finishCrop}
            disabled={uploading || !croppedAreaPixels}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {uploading ? "Enviando..." : "Usar imagem"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <label
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-6 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary ${dragOver ? "border-primary bg-primary/5" : ""}`}
    >
      {uploading ? (
        <Loader2 className="h-6 w-6 animate-spin" />
      ) : (
        <ImagePlus className="h-6 w-6" />
      )}
      {label && <span>{label}</span>}
      {uploading ? <span>Enviando...</span> : <span>Clique ou arraste uma imagem</span>}
      {error && <span className="text-center text-xs text-destructive">{error}</span>}
      <input
        type="file"
        accept="image/*"
        onChange={handleFile}
        disabled={uploading}
        className="hidden"
      />
    </label>
  );
}

async function createCroppedImage(imageSrc: string, pixels: Area) {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement("canvas");
  canvas.width = pixels.width;
  canvas.height = pixels.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Não foi possível preparar a imagem.");

  context.drawImage(image, pixels.x, pixels.y, pixels.width, pixels.height, 0, 0, pixels.width, pixels.height);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => result ? resolve(result) : reject(new Error("Não foi possível preparar a imagem.")), "image/webp", 0.86);
  });
  return new File([blob], "event-image.webp", { type: "image/webp" });
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", () => reject(new Error("Não foi possível ler a imagem.")));
    image.src = src;
  });
}

function toPublicAssetUrl(url: string) {
  if (/^https?:\/\//i.test(url)) return url;
  const apiUrl = getApiUrl();
  const origin = /^https?:\/\//i.test(apiUrl)
    ? new URL(apiUrl).origin
    : window.location.origin;
  return `${origin}${url.startsWith("/") ? url : `/${url}`}`;
}
