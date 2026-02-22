const PREFIX = "salah_planner_";

export const STORAGE_KEYS = {
  todos: PREFIX + "todos",
  prayers: PREFIX + "prayers",
  location: PREFIX + "location",
  athkar: (prayerName: string) => PREFIX + "athkar_" + prayerName,
} as const;

export function getStored<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function setStored<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // quota or disabled
  }
}
