"use client";

import { CalendarDays, Clock3 } from "lucide-react";
import { useMemo } from "react";
import { formatScheduleValue, joinScheduleValue, splitScheduleValue, type ScheduleValue } from "@/lib/new-event-schedule";
import { Input } from "@/components/ui/input";

type SchedulePickerProps = {
  startsAt?: string;
  endsAt?: string;
  startError?: string;
  endError?: string;
  onStartsAtChange: (value: string) => void;
  onEndsAtChange: (value: string) => void;
};

export function SchedulePicker({
  startsAt,
  endsAt,
  startError,
  endError,
  onStartsAtChange,
  onEndsAtChange
}: SchedulePickerProps) {
  const start = useMemo(() => splitScheduleValue(startsAt), [startsAt]);
  const end = useMemo(() => splitScheduleValue(endsAt), [endsAt]);

  function updateStart(next: Partial<ScheduleValue>) {
    onStartsAtChange(joinScheduleValue({ ...start, ...next }));
  }

  function updateEnd(next: Partial<ScheduleValue>) {
    onEndsAtChange(joinScheduleValue({ ...end, ...next }));
  }

  return (
    <section className="space-y-4 rounded-xl border bg-card p-4 sm:p-5" aria-labelledby="schedule-heading">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-primary/10 p-2 text-primary">
          <CalendarDays className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <h2 id="schedule-heading" className="font-semibold">Quando acontece?</h2>
          <p className="text-sm text-muted-foreground">Escolha a data e o horário separadamente para deixar a programação clara.</p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <ScheduleField
          label="Início"
          date={start.date}
          time={start.time}
          error={startError}
          onDateChange={(date) => updateStart({ date })}
          onTimeChange={(time) => updateStart({ time })}
        />
        <ScheduleField
          label="Término"
          date={end.date}
          time={end.time}
          error={endError}
          optional
          onDateChange={(date) => updateEnd({ date })}
          onTimeChange={(time) => updateEnd({ time })}
        />
      </div>

      <div className="grid gap-2 rounded-lg bg-muted/60 px-3 py-2.5 text-sm sm:grid-cols-2">
        <p><span className="text-muted-foreground">Começa em:</span> <strong>{formatScheduleValue(startsAt)}</strong></p>
        <p><span className="text-muted-foreground">Termina em:</span> <strong>{formatScheduleValue(endsAt)}</strong></p>
      </div>
    </section>
  );
}

function ScheduleField({
  label,
  date,
  time,
  error,
  optional,
  onDateChange,
  onTimeChange
}: {
  label: string;
  date: string;
  time: string;
  error?: string;
  optional?: boolean;
  onDateChange: (value: string) => void;
  onTimeChange: (value: string) => void;
}) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="font-medium">{label}</span>
        {optional && <span className="text-xs text-muted-foreground">Opcional</span>}
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
        <label className="space-y-1.5">
          <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><CalendarDays className="h-3.5 w-3.5" aria-hidden="true" /> Data</span>
          <Input aria-label={`${label}: data`} type="date" value={date} onChange={(event) => onDateChange(event.target.value)} />
        </label>
        <label className="space-y-1.5">
          <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Clock3 className="h-3.5 w-3.5" aria-hidden="true" /> Horário</span>
          <Input aria-label={`${label}: horário`} type="time" value={time} onChange={(event) => onTimeChange(event.target.value)} />
        </label>
      </div>
      {error && <p className="mt-2 text-sm text-destructive" role="alert">{error}</p>}
    </div>
  );
}
