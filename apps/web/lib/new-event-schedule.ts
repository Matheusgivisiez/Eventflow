export type ScheduleValue = {
  date: string;
  time: string;
};

export function getTodayDateValue(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return year + "-" + month + "-" + day;
}

export function compareScheduleValues(left?: string | null, right?: string | null): number {
  if (!left || !right) return 0;
  const leftTime = new Date(left).getTime();
  const rightTime = new Date(right).getTime();
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

export function formatScheduleValue(value?: string | null): string {
  if (!value) return "Não informado";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Não informado";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "full",
    timeStyle: "short"
  }).format(date);
}
