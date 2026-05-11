import type { Todo } from "../lib/types";

const CALENDAR_API = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

/**
 * @param overrideDone  When provided, uses this value instead of todo.done.
 *                      Needed right after an optimistic toggle before the
 *                      component re-renders with the new state.
 */
function buildEvent(todo: Todo, date: string, overrideDone?: boolean) {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const hasTime = todo.startTime && todo.endTime;
  const isDone = overrideDone !== undefined ? overrideDone : todo.done;

  // ✓ prefix + Sage green when complete; plain title + default color otherwise.
  const summary = isDone ? `✓ ${todo.text}` : todo.text;
  const colorId = isDone ? "2" : "0"; // "2" = Sage, "0" = calendar default

  const base = {
    summary,
    colorId,
    description: `Prayer: ${todo.prayerName} · Istiqāmah`,
  };

  if (hasTime) {
    return {
      ...base,
      start: { dateTime: `${date}T${todo.startTime}:00`, timeZone: tz },
      end: { dateTime: `${date}T${todo.endTime}:00`, timeZone: tz },
      reminders: {
        useDefault: false,
        overrides: [{ method: "popup", minutes: 10 }],
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

export async function createCalendarEvent(
  accessToken: string,
  todo: Todo,
  date: string
): Promise<string> {
  const res = await fetch(CALENDAR_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(buildEvent(todo, date)),
  });

  if (res.status === 401) throw new Error("UNAUTHORIZED");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? "Failed to create calendar event");
  }

  const data = await res.json();
  return data.id as string;
}

export async function updateCalendarEvent(
  accessToken: string,
  eventId: string,
  todo: Todo,
  date: string,
  overrideDone?: boolean
): Promise<void> {
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildEvent(todo, date, overrideDone)),
    }
  );
  if (res.status === 401) throw new Error("UNAUTHORIZED");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? "Failed to update calendar event");
  }
}

export async function deleteCalendarEvent(
  accessToken: string,
  eventId: string
): Promise<void> {
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  if (res.status === 401) throw new Error("UNAUTHORIZED");
  if (!res.ok && res.status !== 404) {
    throw new Error("Failed to delete calendar event");
  }
}
