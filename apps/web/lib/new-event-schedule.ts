export type ScheduleValue = {
  date: string;
  time: string;
};

const EVENT_TIME_ZONE = "America/Sao_Paulo";

export function getTodayDateValue(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return year + "-" + month + "-" + day;
}

export function compareScheduleValues(left?: string | null, right?: string | null): number {
  if (!left || !right) return 0;
  const leftTime = scheduleValueToDate(left).getTime();
  const rightTime = scheduleValueToDate(right).getTime();
  if (Number.isNaN(leftTime) || Number.isNaN(rightTime)) return 0;
  return leftTime - rightTime;
}

export function splitScheduleValue(value?: string | null): ScheduleValue {
  if (!value) return { date: "", time: "" };
  const [date = "", time = ""] = value.split("T");
  return { date, time: time.slice(0, 5) };
}

export function joinScheduleValue(value: ScheduleValue): string {
  if (!value.date && !value.time) return "";
  return `${value.date}T${value.time || "00:00"}`;
}

export function scheduleValueToDate(value?: string | null): Date {
  if (!value) return new Date(Number.NaN);
  const iso = scheduleValueToIso(value);
  return iso ? new Date(iso) : new Date(Number.NaN);
}

export function scheduleValueToIso(value?: string | null): string | undefined {
  if (!value) return undefined;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) return undefined;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const localAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  const offset = getTimeZoneOffsetMs(EVENT_TIME_ZONE, new Date(localAsUtc));
  return new Date(localAsUtc - offset).toISOString();
}

export function isoToScheduleValue(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: EVENT_TIME_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

export function formatScheduleValue(value?: string | null): string {
  if (!value) return "Não informado";
  const date = value.includes("T") && !/[zZ]|[+-]\d{2}:\d{2}$/.test(value) ? scheduleValueToDate(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return "Não informado";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: EVENT_TIME_ZONE
  }).format(date);
}

function getTimeZoneOffsetMs(timeZone: string, date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((item) => item.type === type)?.value);
  const asUtc = Date.UTC(part("year"), part("month") - 1, part("day"), part("hour"), part("minute"), part("second"));
  return asUtc - date.getTime();
}
