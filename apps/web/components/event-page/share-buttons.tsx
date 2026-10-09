"use client";

import { useState } from "react";
import Image from "next/image";
import { Check, Copy, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

// Círculo glass no mobile (só ícone); a partir do tablet, pílulas com texto que
// dividem a linha em partes iguais (sem quebrar para uma segunda linha).
const SHARE_BUTTON =
  "glass-card h-11 w-11 gap-2 rounded-full border-0 bg-transparent p-0 text-foreground/85 transition-colors hover:bg-primary/10 hover:text-primary sm:h-10 sm:w-auto sm:min-w-0 sm:flex-1 sm:px-3";

type ShareButtonsProps = {
  title: string;
  slug: string;
  invite?: string;
};

export function ShareButtons({ title, slug, invite }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);

  const eventUrl = typeof window !== "undefined"
    ? `${window.location.origin}/eventos/${slug}${invite ? `?invite=${encodeURIComponent(invite)}` : ""}`
    : "";

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(eventUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard not available */
    }
  };

  const handleWhatsApp = () => {
    const text = encodeURIComponent(`Confira esse evento: ${title}\n${eventUrl}`);
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  const handleNativeShare = async () => {
    if (!navigator.share) {
      await handleCopyLink();
      return;
    }
    try {
      await navigator.share({ title, url: eventUrl });
    } catch {
      /* user cancelled */
    }
  };

  return (
    <div className="flex max-w-full flex-wrap items-center gap-2.5 sm:flex-nowrap">
      <Button
        variant="outline"
        size="sm"
        className={SHARE_BUTTON}
        onClick={handleWhatsApp}
        aria-label="Compartilhar no WhatsApp"
      >
        <Image src="/icons/whatsapp-green.png" alt="" width={20} height={20} className="h-5 w-5" />
        <span className="hidden sm:inline">WhatsApp</span>
      </Button>

      <Button
        variant="outline"
        size="sm"
        className={SHARE_BUTTON}
        onClick={handleCopyLink}
        aria-label={copied ? "Link copiado" : "Copiar link"}
      >
        {copied ? (
          <Check className="h-[1.125rem] w-[1.125rem] text-green-500" strokeWidth={2} />
        ) : (
          <Copy className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.75} />
        )}
        <span className="hidden sm:inline">{copied ? "Copiado!" : "Copiar link"}</span>
      </Button>

      <Button
        variant="outline"
        size="sm"
        className={SHARE_BUTTON}
        onClick={handleNativeShare}
        aria-label="Compartilhar"
      >
        <Share2 className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.75} />
        <span className="hidden sm:inline">Compartilhar</span>
      </Button>
    </div>
  );
}
