"use client";

import { useState } from "react";
import { Building2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

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
    <Card className="overflow-hidden border-border/50 bg-muted/20">
      <CardContent className="p-6">
        <div className="flex min-w-0 items-start gap-5">
          <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border/50 bg-card/60 shadow-sm">
            {hasLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl!}
                alt={name}
                className="h-full w-full object-cover"
                onError={() => setImgError(true)}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-primary/10 text-primary">
                <Building2 className="h-8 w-8" />
              </div>
            )}
          </div>
          <div className="min-w-0 space-y-2">
            <h3 className="font-semibold text-foreground">Organizado por</h3>
            <p className="break-words text-lg font-bold text-foreground [overflow-wrap:anywhere]">{name}</p>
            {description && (
              <p className="break-words text-sm leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
                {description}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
