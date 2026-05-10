import type { ReactNode } from "react";

export type Todo = {
  id: string;
  text: string;
  done: boolean;
  prayerName: PrayerName;
  /** ISO date string YYYY-MM-DD; todos are scoped per day */
  date: string;
  /** 24-h HH:MM format, e.g. "09:30" */
  startTime?: string;
  /** 24-h HH:MM format, e.g. "10:00" */
  endTime?: string;
  /** Google Calendar event ID when synced */
  calendarEventId?: string;
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
