import type { PrayerName } from "./types";

export const ATHKAR: Record<
  PrayerName,
  { arabic: string[]; transliteration: string; meaning: string; source: string }
> = {
  Fajr: {
    arabic: ["أَصْبَحْنَا وَأَصْبَحَ الْمُلْكُ لِلَّهِ", "وَالْحَمْدُ لِلَّهِ وَحْدَهُ لَا شَرِيكَ لَهُ"],
    transliteration: "Aṣbaḥnā wa aṣbaḥal-mulku lillāh, wal-ḥamdu lillāh",
    meaning: "We have entered the morning and all sovereignty belongs to Allah alone. All praise is for Him.",
    source: "Morning Athkar · Abu Dawud 5076",
  },
  Dhuhr: {
    arabic: ["سُبْحَانَ اللَّهِ وَبِحَمْدِهِ", "عَدَدَ خَلْقِهِ وَرِضَاءَ نَفْسِهِ"],
    transliteration: "Subḥānallāhi wa biḥamdih, ʿadada khalqih, wa riḍā'a nafsih",
    meaning: "Glory and praise be to Allah as much as the number of His creation and to the extent of His pleasure.",
    source: "Midday Dhikr · Sahih Muslim 2726",
  },
  Asr: {
    arabic: ["وَالْعَصْرِ ۝ إِنَّ الْإِنسَانَ لَفِي خُسْرٍ", "إِلَّا الَّذِينَ آمَنُوا وَعَمِلُوا الصَّالِحَاتِ"],
    transliteration: "Wal-ʿaṣr. Innal-insāna lafī khusr. Illalladhīna āmanū...",
    meaning: "By time — indeed, mankind is in loss, except those who believe and do righteous deeds.",
    source: "Sūrat al-ʿAṣr · 103:1–3",
  },
  Maghrib: {
    arabic: ["أَمْسَيْنَا وَأَمْسَى الْمُلْكُ لِلَّهِ", "وَالْحَمْدُ لِلَّهِ"],
    transliteration: "Amsaynā wa amsal-mulku lillāh, wal-ḥamdu lillāh",
    meaning: "We have entered the evening and all sovereignty belongs to Allah. All praise is for Him.",
    source: "Evening Athkar · Abu Dawud 5077",
  },
  Isha: {
    arabic: ["بِاسْمِكَ اللَّهُمَّ أَمُوتُ وَأَحْيَا", "اللَّهُمَّ قِنِي عَذَابَكَ يَوْمَ تَبْعَثُ عِبَادَكَ"],
    transliteration: "Bismika Allāhumma amūtu wa aḥyā. Allāhumma qinī ʿadhābak...",
    meaning: "In Your name, O Allah, I die and I live. O Allah, protect me from Your punishment.",
    source: "Night Supplication · Bukhari 6312",
  },
};
