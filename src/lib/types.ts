import type { ReactNode } from "react";

export type Todo = {
  id: string;
  text: string;
  done: boolean;
  prayerName: PrayerName;
  /** ISO date string YYYY-MM-DD; todos are scoped per day */
  date: string;
};

export type PrayerName = "Fajr" | "Dhuhr" | "Asr" | "Maghrib" | "Isha";

export type Prayer = {
  name: PrayerName;
  arabic: string;
  time: string;
  icon: ReactNode;
};

export type Athkar = {
  arabic: string[];
  transliteration: string;
  meaning: string;
  source: string;
};

export type Filter = "all" | "pending" | "done";

export type SavedLocation = {
  latitude: number;
  longitude: number;
  label?: string;
  timezone?: string;
};
