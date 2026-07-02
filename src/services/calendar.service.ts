import type { Todo } from '../lib/types';
import { googleApi } from './google-api';

const GCAL_EVENTS = '/calendar/v3/calendars/primary/events';

// ── Event builder ─────────────────────────────────────────────────────────────

function buildDescription(todo: Todo): string {
  let desc = `Prayer: ${todo.prayerName} · Istiqāmah`;

  if (todo.startTime && todo.endTime) {
    desc += `\nTime: ${todo.startTime} - ${todo.endTime}`;
  }

  if (todo.loggedTime) {
    const minutes = Math.round(todo.loggedTime / 60);
    desc += `\nLogged: ${minutes} min`;
  }

  return desc;
}

type CalendarEvent = {
  summary: string;
  colorId: string;
  description: string;
  start: { dateTime: string; timeZone: string } | { date: string };
  end: { dateTime: string; timeZone: string } | { date: string };
  reminders: {
    useDefault: boolean;
    overrides?: { method: string; minutes: number }[];
  };
};

/**
 * @param overrideDone  When provided, uses this value instead of todo.done.
 *                      Needed right after an optimistic toggle before the
 *                      component re-renders with the new state.
 * @param overrideFailed When provided, uses this value instead of todo.failed.
 */
function buildEvent(
  todo: Todo,
  date: string,
  overrideDone?: boolean,
  overrideFailed?: boolean
): CalendarEvent {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const hasTime = Boolean(todo.startTime && todo.endTime);
  const isDone = overrideDone !== undefined ? overrideDone : todo.done;
  const isFailed = overrideFailed !== undefined ? overrideFailed : todo.failed;

  // Detect overdue: past date and not done and not failed
  const today = new Date().toISOString().slice(0, 10);
  const isOverdue = !isDone && !isFailed && date < today;

  // ✓ done (Sage green), ✗ failed/overdue (Tomato red), plain otherwise
  const summary = isDone
    ? `✓ ${todo.text}`
    : isFailed
      ? `✗ ${todo.text}`
      : isOverdue
        ? `${todo.text}`
        : todo.text;
  const colorId = isDone ? '2' : isFailed ? '11' : isOverdue ? '0' : '0';

  const base = {
    summary,
    colorId,
    description: buildDescription(todo),
  };

  if (hasTime) {
    return {
      ...base,
      start: { dateTime: `${date}T${todo.startTime}:00`, timeZone: tz },
      end: { dateTime: `${date}T${todo.endTime}:00`, timeZone: tz },
      reminders: {
        useDefault: false,
        overrides: [{ method: 'popup', minutes: 10 }],
      },
    };
  }

  return {
    ...base,
    start: { date },
    end: { date },
    reminders: { useDefault: true },
  };
}

// ── Public API ────────────────────────────────────────────────────────────────
// Note: access tokens are managed internally by googleApi — no token params needed.

export async function createCalendarEvent(
  todo: Todo,
  date: string
): Promise<string> {
  const data = await googleApi.post<{ id: string }>(
    GCAL_EVENTS,
    buildEvent(todo, date)
  );
  return data.id;
}

export async function updateCalendarEvent(
  eventId: string,
  todo: Todo,
  date: string,
  overrideDone?: boolean,
  overrideFailed?: boolean
): Promise<void> {
  await googleApi.patch(
    `${GCAL_EVENTS}/${eventId}`,
    buildEvent(todo, date, overrideDone, overrideFailed)
  );
}

export async function deleteCalendarEvent(eventId: string): Promise<void> {
  await googleApi.delete(`${GCAL_EVENTS}/${eventId}`);
}
