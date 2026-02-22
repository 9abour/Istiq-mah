import type { Athkar, PrayerName } from "../lib/types";
import { ATHKAR } from "../lib/constants";
import { getStored, setStored, STORAGE_KEYS } from "../lib/storage";

/** Fetch athkar for a prayer. Reads from localStorage, seeds from constants when missing. */
export async function getAthkar(prayerName: PrayerName): Promise<Athkar> {
  await delay(10);
  const key = STORAGE_KEYS.athkar(prayerName);
  const stored = getStored<Athkar>(key);
  if (stored && Array.isArray(stored.arabic)) return stored;
  const raw = ATHKAR[prayerName];
  const athkar: Athkar = {
    arabic: raw.arabic,
    transliteration: raw.transliteration,
    meaning: raw.meaning,
    source: raw.source,
  };
  setStored(key, athkar);
  return athkar;
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
