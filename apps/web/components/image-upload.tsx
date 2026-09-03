"use client";

import { useCallback, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import Image from "next/image";
import { uploadFile } from "@/lib/api";
import { getApiUrl } from "@/lib/api-url";

interface ImageUploadProps {
  value?: string;
  onChange: (url: string | undefined) => void;
  label?: string;
}

export function ImageUpload({ value, onChange, label }: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string>();
  const [preview, setPreview] = useState(value);
  const [dragOver, setDragOver] = useState(false);

  const handleUpload = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    setUploading(true);
    setError(undefined);
    try {
      const { url } = await uploadFile(file);
      const fullUrl = toPublicAssetUrl(url);
      setPreview(fullUrl);
      onChange(fullUrl);
    } catch (uploadError) {
      onChange(undefined);
      setError(uploadError instanceof Error ? uploadError.message : "Não foi possível enviar a imagem.");
    } finally {
      setUploading(false);
    }
  }, [onChange]);

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

function toPublicAssetUrl(url: string) {
  if (/^https?:\/\//i.test(url)) return url;
  const apiUrl = getApiUrl();
  const origin = /^https?:\/\//i.test(apiUrl)
    ? new URL(apiUrl).origin
    : window.location.origin;
  return `${origin}${url.startsWith("/") ? url : `/${url}`}`;
}
