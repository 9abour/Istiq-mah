import {
  ASR_ICON,
  DHUHR_ICON,
  FAJR_ICON,
  ISHA_ICON,
  MAGHRIB_ICON,
} from "public/icons/prayers.icons";
import type { Prayer, PrayerName, SavedLocation } from "../lib/types";
import { getStored, setStored, STORAGE_KEYS } from "../lib/storage";

/** Stored shape (no icon – icons are merged when reading) */
type PrayerData = Omit<Prayer, "icon">;

const ARABIC: Record<PrayerName, string> = {
  Fajr: "الفجر",
  Dhuhr: "الظهر",
  Asr: "العصر",
  Maghrib: "المغرب",
  Isha: "العشاء",
};

const ICONS: Record<PrayerName, Prayer["icon"]> = {
  Fajr: FAJR_ICON,
  Dhuhr: DHUHR_ICON,
  Asr: ASR_ICON,
  Maghrib: MAGHRIB_ICON,
  Isha: ISHA_ICON,
};

const ORDER: PrayerName[] = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];

const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

type PrayersCache = {
  data: PrayerData[];
  fetchedAt: number;
  latitude: number;
  longitude: number;
};

function isCacheValid(cache: PrayersCache, location: SavedLocation): boolean {
  const age = Date.now() - cache.fetchedAt;
  const sameLocation =
    cache.latitude === location.latitude && cache.longitude === location.longitude;
  return age < CACHE_TTL_MS && sameLocation;
}

function getPrayersCache(location: SavedLocation): Prayer[] | null {
  const stored = getStored<PrayersCache | PrayerData[]>(STORAGE_KEYS.prayers);
  if (!stored) return null;
  const cache = Array.isArray(stored)
    ? null
    : (stored as PrayersCache);
  if (!cache?.data?.length || cache.data.length !== ORDER.length) return null;
  if (!isCacheValid(cache, location)) return null;
  return buildPrayers(cache.data);
}

type AladhanTimings = {
  Fajr?: string;
  Dhuhr?: string;
  Asr?: string;
  Maghrib?: string;
  Isha?: string;
};

type AladhanResponse = {
  code?: number;
  data?: {
    timings?: AladhanTimings;
    date?: { readable?: string };
    meta?: { timezone?: string };
  };
};

function buildPrayers(data: PrayerData[]): Prayer[] {
  return data.map((p) => ({ ...p, icon: ICONS[p.name] }));
}

function formatDateForApi(d: Date): string {
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

export async function getPrayers(location: SavedLocation, date: Date = new Date()): Promise<Prayer[]> {
  const cached = getPrayersCache(location);
  if (cached) return cached;

  const dateStr = formatDateForApi(date);
  const url = `https://api.aladhan.com/v1/timings/${dateStr}?latitude=${location.latitude}&longitude=${location.longitude}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch prayer times");
  const json = (await res.json()) as AladhanResponse;
  const timings = json?.data?.timings;
  if (!timings) throw new Error("Invalid prayer times response");

  const data: PrayerData[] = ORDER.map((name) => ({
    name,
    arabic: ARABIC[name],
    time: timings[name] ?? "00:00",
  }));

  const cache: PrayersCache = {
    data,
    fetchedAt: Date.now(),
    latitude: location.latitude,
    longitude: location.longitude,
  };
  setStored(STORAGE_KEYS.prayers, cache);
  return buildPrayers(data);
}

/** Returns cached prayers from storage if present; does not fetch. Handles both cache object and legacy array format. */
export function getCachedPrayers(): Prayer[] | null {
  const stored = getStored<PrayersCache | PrayerData[]>(STORAGE_KEYS.prayers);
  if (!stored) return null;
  const data = Array.isArray(stored) ? stored : (stored as PrayersCache).data;
  if (data?.length === ORDER.length) return buildPrayers(data);
  return null;
}
