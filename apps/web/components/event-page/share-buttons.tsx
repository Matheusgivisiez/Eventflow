"use client";

import { useState } from "react";
import { Check, Copy, MessageCircle, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type ShareButtonsProps = {
  title: string;
  slug: string;
};

export function ShareButtons({ title, slug }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);

  const eventUrl = typeof window !== "undefined"
    ? `${window.location.origin}/eventos/${slug}`
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
    if (!navigator.share) return;
    try {
      await navigator.share({ title, url: eventUrl });
    } catch {
      /* user cancelled */
    }
  };

  return (
    <div className="flex max-w-full flex-wrap items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        className="gap-2 rounded-full border-border/60 hover:border-primary/50 hover:text-primary transition-colors"
        onClick={handleWhatsApp}
      >
        <MessageCircle className="h-4 w-4" />
        <span className="hidden sm:inline">WhatsApp</span>
      </Button>

      <Button
        variant="outline"
        size="sm"
        className="gap-2 rounded-full border-border/60 hover:border-primary/50 hover:text-primary transition-colors"
        onClick={handleCopyLink}
      >
        {copied ? (
          <Check className="h-4 w-4 text-green-500" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
        <span className="hidden sm:inline">{copied ? "Copiado!" : "Copiar link"}</span>
      </Button>

      {typeof navigator !== "undefined" && "share" in navigator && (
        <Button
          variant="outline"
          size="sm"
          className="gap-2 rounded-full border-border/60 hover:border-primary/50 hover:text-primary transition-colors"
          onClick={handleNativeShare}
        >
          <Share2 className="h-4 w-4" />
          <span className="hidden sm:inline">Compartilhar</span>
        </Button>
      )}
    </div>
  );
}
