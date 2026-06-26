import { Clock } from "lucide-react";

type AgendaItem = { time: string; title: string; description?: string };

export function EventAgenda({ agendaJson }: { agendaJson?: any }) {
  const agenda = (agendaJson as AgendaItem[]) || [];

  if (agenda.length === 0) return null;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold tracking-tight">Agenda do Evento</h2>
      <div className="relative border-l border-muted-foreground/20 pl-6 ml-3 space-y-8">
        {agenda.map((item, i) => (
          <div key={i} className="relative">
            <div className="absolute -left-[35px] flex h-8 w-8 items-center justify-center rounded-full bg-background border shadow-sm">
              <Clock className="h-4 w-4 text-primary" />
            </div>
            <div className="rounded-xl border bg-card p-5 shadow-sm transition-colors hover:border-primary/30">
              <div className="flex items-center gap-3">
                <span className="rounded bg-primary/10 px-2.5 py-1 text-sm font-semibold text-primary">
                  {item.time}
                </span>
                <h3 className="font-semibold text-foreground">{item.title}</h3>
              </div>
              {item.description && (
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                  {item.description}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
