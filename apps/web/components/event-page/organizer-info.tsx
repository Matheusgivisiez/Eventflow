"use client";

import { useState } from "react";
import { Building2 } from "lucide-react";

export function OrganizerInfo({
  name,
  logoUrl,
  description
}: {
  name: string;
  logoUrl?: string | null;
  description?: string;
}) {
  const [imgError, setImgError] = useState(false);
  const hasLogo = Boolean(logoUrl) && !imgError;

  return (
    <div className="glass-card overflow-hidden rounded-3xl">
      <div className="p-5 sm:p-6">
        <div className="flex min-w-0 items-start gap-5">
          <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-primary/20 bg-primary/10">
            {hasLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl!}
                alt={name}
                className="h-full w-full object-cover"
                onError={() => setImgError(true)}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-primary">
                <Building2 className="h-8 w-8" strokeWidth={1.5} />
              </div>
            )}
          </div>
          <div className="min-w-0 space-y-1.5">
            <h3 className="font-semibold text-foreground">Organizado por</h3>
            <p className="break-words text-xl font-bold tracking-tight text-foreground [overflow-wrap:anywhere]">{name}</p>
            {description && (
              <p className="break-words text-sm leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
                {description}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
