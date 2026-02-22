import type { Prayer } from "./types";

export const uid = () => Math.random().toString(36).slice(2, 9);

export const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

export function getNowIdx(prayers: Prayer[]): number {
  const n = new Date();
  const cur = n.getHours() * 60 + n.getMinutes();
  let idx = 0;
  prayers.forEach((p, i) => {
    if (toMin(p.time) <= cur) idx = i;
  });
  return idx;
}

export function getStatus(i: number, nowIdx: number): string {
  if (i === nowIdx) return "Current Prayer";
  if (i < nowIdx) return "Completed";
  return "Upcoming";
}

/** Returns YYYY-MM-DD for the given date (local time). */
export function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function isToday(dateStr: string): boolean {
  return dateStr === toDateString(new Date());
}

/** Human-readable label for date pagination (e.g. "Today", "Yesterday", "Mon, Feb 22"). */
export function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (toDateString(d) === toDateString(today)) return "Today";
  if (toDateString(d) === toDateString(yesterday)) return "Yesterday";
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
