import { Building2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function OrganizerInfo({ name, description }: { name: string; description?: string }) {
  return (
    <Card className="overflow-hidden border-border/50 bg-muted/20">
      <CardContent className="p-6">
        <div className="flex min-w-0 items-start gap-5">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Building2 className="h-8 w-8" />
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
