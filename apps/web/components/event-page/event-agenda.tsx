import { Clock } from "lucide-react";

type AgendaItem = { time: string; title: string; description?: string };

export function EventAgenda({ agendaJson }: { agendaJson?: any }) {
  const agenda = (agendaJson as AgendaItem[]) || [];

  if (agenda.length === 0) return null;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold tracking-tight">Agenda do Evento</h2>
      <div className="relative border-l border-muted-foreground/20 pl-6 ml-3 space-y-8">
        {agenda.map((item, i) => (
          <div key={i} className="relative">
            <div className="absolute -left-[35px] flex h-8 w-8 items-center justify-center rounded-full border border-primary/25 bg-background">
              <Clock className="h-4 w-4 text-primary" strokeWidth={1.75} />
            </div>
            <div className="glass-card min-w-0 rounded-2xl p-5">
              <div className="flex min-w-0 items-center gap-3">
                <span className="shrink-0 rounded-lg bg-primary/10 px-2.5 py-1 text-sm font-semibold text-primary">
                  {item.time}
                </span>
                <h3 className="min-w-0 break-words font-semibold text-foreground [overflow-wrap:anywhere]">{item.title}</h3>
              </div>
              {item.description && (
                <p className="mt-3 break-words text-sm leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
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
