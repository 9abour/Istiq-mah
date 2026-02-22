# Istiqāmah — Islamic Prayer & Day Tracker

A web app that helps you **track your day by prayer time**. Plan tasks around the five daily prayers (Fajr, Dhuhr, Asr, Maghrib, Isha), see prayer times for your location, and use athkar (remembrance) for reflection.

![React Router](https://img.shields.io/badge/React%20Router-7.12-ff4154?logo=reactrouter)  
TypeScript · React Router · Zustand · Vite

---

## What it does

- **Prayer times** — Shows the five daily prayer times for your location. Times are fetched using your coordinates and cached for 12 hours.
- **Tasks per prayer** — Add to‑dos for each prayer (e.g. “Read 2 pages after Fajr”). Filter by all / pending / done and tick them off as you go.
- **Day progress** — See how many tasks you’ve completed today (or for any selected date) with a simple progress bar.
- **Athkar & reflection** — For the selected prayer, the app shows short athkar (Arabic remembrance with transliteration and meaning) for that part of the day.
- **Location** — On first visit you set your location (browser geolocation or manual entry). You can change it anytime via the refresh-location button in the header.

---

## Getting started

### Prerequisites

- Node.js 18+
- pnpm (or npm / yarn)

### Install

```bash
pnpm install
```

### Run in development

```bash
pnpm run start:dev
```

Open [http://localhost:5173](http://localhost:5173). Allow location access when prompted, or pick a location in the modal.

### Build for production

```bash
pnpm run build
```

### Run production build

```bash
pnpm start
```

### Type check

```bash
pnpm run typecheck
```

---

## Project structure (high level)

| Path | Purpose |
|------|--------|
| `app/` | React Router app entry, root layout, routes |
| `app/pages/home.tsx` | Main home screen: prayers, tasks, athkar, date nav |
| `src/components/` | UI pieces (PrayerCard, TodoItem, AthkarCard, LocationModal, GeoBg, ProgressRing) |
| `src/services/` | Prayer times API, athkar data, todos API |
| `src/stores/` | Zustand store for todos (per date, per prayer) |
| `src/lib/` | Types, utils, storage helpers |
| `src/styles/` | Global and page-specific CSS |
| `public/icons/` | SVG/icons for prayers and logo |

---

## Tech stack

- **React 19** + **React Router 7** — UI and routing  
- **TypeScript** — Typing  
- **Zustand** — Client-side state (todos)  
- **Vite** — Build and dev server  
- **react-geolocated** — Browser geolocation for location modal  
- **Tailwind CSS** — Utility styling (template default; app also uses custom CSS in `src/styles/`)

---

## Data & privacy

- **Prayer times** — Computed from your latitude/longitude (no account required). Coordinates can be stored locally so you don’t have to re-enter them.
- **Tasks** — Stored in your browser (e.g. via the todos service/store). No server-side user accounts or task storage in this repo.
- **Location** — Used only to compute prayer times and is not sent to any third party except the prayer-times logic you use (e.g. external API if configured in `src/services/prayers.service.ts`).

---

## License

Private project. See repository settings for license details.

---

*Istiqāmah — “steadfastness”; track your day by prayer time.*
