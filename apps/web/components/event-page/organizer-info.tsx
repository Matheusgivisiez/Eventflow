import { Building2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function OrganizerInfo({ name, description }: { name: string; description?: string }) {
  return (
    <Card className="overflow-hidden border-border/50 bg-muted/20">
      <CardContent className="p-6">
        <div className="flex items-start gap-5">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Building2 className="h-8 w-8" />
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold text-foreground">Organizado por</h3>
            <p className="text-lg font-bold text-foreground">{name}</p>
            {description && (
              <p className="text-sm text-muted-foreground leading-relaxed">
                {description}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
