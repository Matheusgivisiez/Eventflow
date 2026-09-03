"use client";

import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Clock3 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { compareScheduleValues, formatScheduleValue, getTodayDateValue, joinScheduleValue, splitScheduleValue, type ScheduleValue } from "@/lib/new-event-schedule";

type SchedulePickerProps = {
  startsAt?: string;
  endsAt?: string;
  startError?: string;
  endError?: string;
  onStartsAtChange: (value: string) => void;
  onEndsAtChange: (value: string) => void;
};

export function SchedulePicker({ startsAt, endsAt, startError, endError, onStartsAtChange, onEndsAtChange }: SchedulePickerProps) {
  const start = useMemo(() => splitScheduleValue(startsAt), [startsAt]);
  const end = useMemo(() => splitScheduleValue(endsAt), [endsAt]);
  const today = getTodayDateValue();

  function updateStart(next: Partial<ScheduleValue>) {
    const nextSchedule = { ...start, ...next };
    const nextValue = joinScheduleValue(nextSchedule);
    if (endsAt && nextSchedule.date && nextSchedule.time && end.date && end.time && compareScheduleValues(nextValue, endsAt) >= 0) onEndsAtChange("");
    onStartsAtChange(nextValue);
  }

  function updateEnd(next: Partial<ScheduleValue>) {
    const nextSchedule = { ...end, ...next };
    const nextValue = joinScheduleValue(nextSchedule);
    if (startsAt && nextSchedule.date && nextSchedule.time && start.date && start.time && compareScheduleValues(nextValue, startsAt) <= 0) return;
    onEndsAtChange(nextValue);
  }

  return (
    <section className="space-y-4 rounded-2xl border border-primary/15 bg-[#171331] p-4 shadow-[0_18px_60px_rgba(17,10,48,0.2)] sm:p-5" aria-labelledby="schedule-heading">
      <div className="flex items-start gap-3">
        <div className="rounded-xl border border-primary/20 bg-primary/10 p-2.5 text-primary shadow-inner"><CalendarDays className="h-5 w-5" aria-hidden="true" /></div>
        <div><h2 id="schedule-heading" className="font-semibold">Quando acontece?</h2><p className="text-sm text-muted-foreground">Defina a data e o horário em controles separados. O término respeita automaticamente o início.</p></div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <ScheduleField label="Início" date={start.date} time={start.time} error={startError} minDate={today} onDateChange={(date) => updateStart({ date })} onTimeChange={(time) => updateStart({ time })} />
        <ScheduleField label="Término" date={end.date} time={end.time} error={endError} optional minDate={start.date || today} minTime={start.date && end.date === start.date ? start.time : undefined} onDateChange={(date) => updateEnd({ date })} onTimeChange={(time) => updateEnd({ time })} />
      </div>
      <div className="grid gap-2 rounded-xl border border-white/10 bg-black/[0.08] px-3.5 py-3 text-sm shadow-inner dark:bg-white/[0.04] sm:grid-cols-2">
        <p><span className="text-muted-foreground">Começa em:</span> <strong>{formatScheduleValue(startsAt)}</strong></p>
        <p><span className="text-muted-foreground">Termina em:</span> <strong>{formatScheduleValue(endsAt)}</strong></p>
      </div>
    </section>
  );
}

function ScheduleField({ label, date, time, error, optional, minDate, minTime, onDateChange, onTimeChange }: {
  label: string; date: string; time: string; error?: string; optional?: boolean; minDate?: string; minTime?: string;
  onDateChange: (value: string) => void; onTimeChange: (value: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#100d22] p-3.5 shadow-[0_10px_35px_rgba(17,10,48,0.18)] sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-2"><span className="font-medium">{label}</span>{optional && <span className="rounded-full border border-primary/15 bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary">Opcional</span>}</div>
      <div className="grid gap-3 sm:grid-cols-[1fr_132px]">
        <CalendarControl label={label + ": data"} value={date} minDate={minDate} onChange={onDateChange} />
        <TimeControl label={label + ": horário"} value={time} minTime={minTime} minDate={minDate} date={date} onChange={onTimeChange} />
      </div>
      {error && <p className="mt-2 text-sm text-destructive" role="alert">{error}</p>}
      {!error && minTime && <p className="mt-2 text-xs text-muted-foreground">No mesmo dia, escolha um horário depois do início.</p>}
    </div>
  );
}

function CalendarControl({ label, value, minDate, onChange }: { label: string; value: string; minDate?: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => {
    const base = parseDate(value || minDate || getTodayDateValue());
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  useEffect(() => {
    if (value) { const selected = parseDate(value); setMonth(new Date(selected.getFullYear(), selected.getMonth(), 1)); }
  }, [value]);
  const monthLabel = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(month);
  const displayValue = value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(parseDate(value)) : "Escolher data";

  return (
    <div className="relative space-y-1.5">
      <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><CalendarDays className="h-3.5 w-3.5" aria-hidden="true" /> Data</span>
      <button type="button" aria-label={label} aria-expanded={open} onClick={() => setOpen((current) => !current)} className="flex h-11 w-full items-center justify-between gap-2 rounded-xl border bg-background px-3 text-left text-sm transition hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><span className={value ? "font-medium" : "text-muted-foreground"}>{displayValue}</span><CalendarDays className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" /></button>
      {open && <div className="absolute z-30 mt-2 w-[min(276px,calc(100vw-3rem))] rounded-2xl border border-white/15 bg-[#121027] p-3 shadow-[0_22px_70px_rgba(10,5,30,.55)]" role="dialog" aria-label={"Calendário de " + label}>
        <div className="mb-3 flex items-center justify-between gap-2"><button type="button" className="rounded-lg p-2 transition hover:bg-primary/10" aria-label="Mês anterior" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft className="h-4 w-4" /></button><span className="capitalize text-sm font-semibold">{monthLabel}</span><button type="button" className="rounded-lg p-2 transition hover:bg-primary/10" aria-label="Próximo mês" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight className="h-4 w-4" /></button></div>
        <div className="mb-1 grid grid-cols-7 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"><span>Dom</span><span>Seg</span><span>Ter</span><span>Qua</span><span>Qui</span><span>Sex</span><span>Sáb</span></div>
        <div className="grid grid-cols-7 gap-1">{getCalendarDays(month).map((day) => { const dateValue = formatDate(day); const disabled = Boolean(minDate && dateValue < minDate); const selected = dateValue === value; const outsideMonth = day.getMonth() !== month.getMonth(); return <button key={dateValue} type="button" disabled={disabled} aria-label={dateValue} aria-pressed={selected} onClick={() => { onChange(dateValue); setOpen(false); }} className={"flex aspect-square items-center justify-center rounded-lg text-xs transition " + (selected ? "bg-primary font-semibold text-primary-foreground shadow-md" : disabled ? "cursor-not-allowed text-muted-foreground/25" : outsideMonth ? "text-muted-foreground/45 hover:bg-primary/10" : "hover:bg-primary/15 hover:text-primary")}>{day.getDate()}</button>; })}</div>
        {minDate && <p className="mt-3 border-t pt-2 text-[11px] text-muted-foreground">Datas anteriores a {formatDateForHumans(minDate)} estão bloqueadas.</p>}
      </div>}
    </div>
  );
}

function TimeControl({ label, value, minTime, minDate, date, onChange }: { label: string; value: string; minTime?: string; minDate?: string; date: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const hour24 = value ? Number(value.split(":")[0]) : 12;
  const minute = value ? Number(value.split(":")[1]) : 0;
  const hour12 = hour24 % 12 || 12;
  const period = hour24 >= 12 ? "PM" : "AM";
  const minHour = minTime ? Number(minTime.split(":")[0]) : 0;
  const minMinute = minTime ? Number(minTime.split(":")[1]) : 0;
  const sameDay = Boolean(minDate && date === minDate && minTime);
  const isAllowed = (nextHour12: number, nextMinute: number, nextPeriod: string) => {
    const nextHour24 = nextPeriod === "PM" ? (nextHour12 === 12 ? 12 : nextHour12 + 12) : nextHour12 === 12 ? 0 : nextHour12;
    return !sameDay || nextHour24 > minHour || (nextHour24 === minHour && nextMinute > minMinute);
  };
  const change = (nextHour12: number, nextMinute: number, nextPeriod: string) => {
    if (!isAllowed(nextHour12, nextMinute, nextPeriod)) return;
    const nextHour24 = nextPeriod === "PM" ? (nextHour12 === 12 ? 12 : nextHour12 + 12) : nextHour12 === 12 ? 0 : nextHour12;
    onChange(String(nextHour24).padStart(2, "0") + ":" + String(nextMinute).padStart(2, "0"));
  };
  const step = (part: "hour" | "minute", direction: 1 | -1) => {
    if (part === "hour") change(hour12 === 12 && direction === 1 ? 1 : hour12 === 1 && direction === -1 ? 12 : hour12 + direction, minute, period);
    else {
      const nextMinute = minute + direction * 5;
      change(hour12, nextMinute < 0 ? 55 : nextMinute > 59 ? 0 : nextMinute, period);
    }
  };
  return (
    <div className="relative space-y-1.5">
      <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Clock3 className="h-3.5 w-3.5" aria-hidden="true" /> Horário</span>
      <button type="button" aria-label={label} aria-expanded={open} onClick={() => setOpen((currentOpen) => !currentOpen)} className="flex h-11 w-full items-center justify-between gap-2 rounded-xl border bg-background px-3 text-left text-sm transition hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><span className={value ? "font-medium" : "text-muted-foreground"}>{value || "Escolher horário"}</span><Clock3 className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" /></button>
      {open && <div className="absolute right-0 z-30 mt-2 w-[min(230px,calc(100vw-3rem))] rounded-2xl border border-white/15 bg-[#121027] p-3 shadow-[0_22px_70px_rgba(10,5,30,.55)]" role="dialog" aria-label={"Seletor de " + label}>
        <div className="mb-2 flex items-center gap-2"><span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Escolha o horário</span>{sameDay && <span className="text-[10px] text-primary">após {minTime}</span>}</div>
        <div className="grid grid-cols-3 gap-2 border-y border-white/10 py-2">
          <WheelColumn label="Hora" value={String(hour12).padStart(2, "0")} onUp={() => step("hour", 1)} onDown={() => step("hour", -1)} />
          <WheelColumn label="Min" value={String(minute).padStart(2, "0")} onUp={() => step("minute", 1)} onDown={() => step("minute", -1)} />
          <WheelColumn label="Período" value={period} onUp={() => change(hour12, minute, period === "AM" ? "PM" : "AM")} onDown={() => change(hour12, minute, period === "AM" ? "PM" : "AM")} />
        </div>
        <p className="mt-2 text-[10px] leading-4 text-muted-foreground">Use as setas para ajustar em intervalos de 5 minutos.</p>
        <Input type="time" value={value} min={sameDay ? minTime : undefined} onChange={(event) => onChange(event.target.value)} className="mt-2 h-9 bg-background/80 text-xs" aria-label={label + ": digitar horário exato"} />
      </div>}
    </div>
  );
}

function WheelColumn({ label, value, onUp, onDown }: { label: string; value: string; onUp: () => void; onDown: () => void }) {
  return <div className="flex flex-col items-center gap-0.5"><span className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</span><button type="button" onClick={onUp} className="rounded p-0.5 text-muted-foreground transition hover:bg-primary/15 hover:text-primary" aria-label={label + " anterior"}><ChevronUp className="h-3.5 w-3.5" /></button><span className="min-w-10 rounded-lg bg-primary/15 px-2 py-1.5 text-center text-sm font-semibold text-primary">{value}</span><button type="button" onClick={onDown} className="rounded p-0.5 text-muted-foreground transition hover:bg-primary/15 hover:text-primary" aria-label={label + " próximo"}><ChevronDown className="h-3.5 w-3.5" /></button></div>;
}

function parseDate(value: string) { const [year, month, day] = value.split("-").map(Number); return new Date(year, month - 1, day); }
function formatDate(date: Date) { return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0"); }
function formatDateForHumans(value: string) { return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(parseDate(value)); }
function getCalendarDays(month: Date) {
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const totalCells = Math.ceil((firstDay.getDay() + daysInMonth) / 7) * 7;
  const start = new Date(month.getFullYear(), month.getMonth(), 1 - firstDay.getDay());
  return Array.from({ length: totalCells }, (_, index) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + index));
}
