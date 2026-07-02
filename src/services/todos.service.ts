/**
 * Todos service — uses Supabase when a userId is provided (logged in),
 * falls back to localStorage for anonymous users.
 *
 * Supabase table setup (run once in the Supabase SQL editor):
 *
 *   create table public.todos (
 *     id               uuid default gen_random_uuid() primary key,
 *     user_id          uuid references auth.users(id) on delete cascade not null,
 *     text             text not null,
 *     done             boolean not null default false,
 *     failed           boolean not null default false,
 *     prayer_name      text not null,
 *     date             text not null,
 *     start_time       text,
 *     end_time         text,
 *     calendar_event_id text,
 *     logged_time      integer not null default 0,
 *     timer_started_at bigint,
 *     created_at       timestamptz default now()
 *   );
 *
 *   -- Migration for existing tables:
 *   alter table public.todos add column if not exists logged_time integer not null default 0;
 *   alter table public.todos add column if not exists failed boolean not null default false;
 *   alter table public.todos add column if not exists timer_started_at bigint;
 *
 *   alter table public.todos enable row level security;
 *
 *   create policy "Users manage own todos" on public.todos
 *     for all using (auth.uid() = user_id);
 */

import { getStored, setStored, STORAGE_KEYS } from '../lib/storage';
import { supabase } from '../lib/supabase';
import type { PrayerName, Todo } from '../lib/types';
import { toDateString, uid } from '../lib/utils';

// ─── localStorage helpers ────────────────────────────────────────────────────

type StoredTodo = Todo | (Omit<Todo, 'date'> & { date?: string });

function loadAllLocal(): Todo[] {
  const stored = getStored<StoredTodo[]>(STORAGE_KEYS.todos);
  const raw = stored && Array.isArray(stored) ? stored : [];
  const today = toDateString(new Date());
  const migrated = raw.map((t) =>
    t.date ? (t as Todo) : { ...t, date: today }
  ) as Todo[];
  if (raw.length > 0 && raw.some((t) => !(t as StoredTodo).date)) {
    setStored(STORAGE_KEYS.todos, migrated);
  }
  return migrated;
}

function saveAllLocal(todos: Todo[]) {
  setStored(STORAGE_KEYS.todos, todos);
}

// ─── Supabase row ↔ Todo mapping ─────────────────────────────────────────────

type DbRow = {
  id: string;
  text: string;
  done: boolean;
  failed?: boolean;
  prayer_name: string;
  date: string;
  start_time?: string | null;
  end_time?: string | null;
  calendar_event_id?: string | null;
  logged_time?: number | null;
  timer_started_at?: number | null;
};

function fromRow(row: DbRow): Todo {
  return {
    id: row.id,
    text: row.text,
    done: row.done,
    failed: row.failed ?? false,
    prayerName: row.prayer_name as PrayerName,
    date: row.date,
    startTime: row.start_time ?? undefined,
    endTime: row.end_time ?? undefined,
    calendarEventId: row.calendar_event_id ?? undefined,
    loggedTime: row.logged_time ?? 0,
    timerStartedAt: row.timer_started_at ?? undefined,
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function getTodos(
  date: string,
  userId?: string | null
): Promise<Todo[]> {
  if (userId && supabase) {
    const { data, error } = await supabase
      .from('todos')
      .select('*')
      .eq('user_id', userId)
      .eq('date', date);
    if (error) throw new Error(error.message);
    return (data as DbRow[]).map(fromRow);
  }
  return loadAllLocal().filter((t) => t.date === date);
}

export async function createTodo(
  date: string,
  prayerName: PrayerName,
  text: string,
  startTime?: string,
  endTime?: string,
  userId?: string | null
): Promise<Todo> {
  const payload = {
    text: text.trim(),
    done: false,
    failed: false,
    prayer_name: prayerName,
    date,
    ...(startTime ? { start_time: startTime } : {}),
    ...(endTime ? { end_time: endTime } : {}),
  };

  if (userId && supabase) {
    const { data, error } = await supabase
      .from('todos')
      .insert({ ...payload, user_id: userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return fromRow(data as DbRow);
  }

  const todo: Todo = {
    id: uid(),
    text: text.trim(),
    done: false,
    failed: false,
    prayerName,
    date,
    ...(startTime ? { startTime } : {}),
    ...(endTime ? { endTime } : {}),
  };
  saveAllLocal([...loadAllLocal(), todo]);
  return todo;
}

export async function updateTodo(
  id: string,
  patch: Partial<
    Pick<
      Todo,
      | 'text'
      | 'done'
      | 'failed'
      | 'calendarEventId'
      | 'startTime'
      | 'endTime'
      | 'loggedTime'
      | 'timerStartedAt'
    >
  >,
  userId?: string | null
): Promise<Todo> {
  if (userId && supabase) {
    // Map camelCase patch to snake_case DB columns; explicit null removes the field
    const dbPatch: Record<string, unknown> = {};
    if ('text' in patch) dbPatch.text = patch.text;
    if ('done' in patch) dbPatch.done = patch.done;
    if ('failed' in patch) dbPatch.failed = patch.failed ?? false;
    if ('calendarEventId' in patch)
      dbPatch.calendar_event_id = patch.calendarEventId ?? null;
    if ('startTime' in patch) dbPatch.start_time = patch.startTime ?? null;
    if ('endTime' in patch) dbPatch.end_time = patch.endTime ?? null;
    if ('loggedTime' in patch) dbPatch.logged_time = patch.loggedTime ?? 0;
    if ('timerStartedAt' in patch)
      dbPatch.timer_started_at = patch.timerStartedAt ?? null;

    const { error } = await supabase
      .from('todos')
      .update(dbPatch)
      .eq('id', id)
      .eq('user_id', userId);
    if (error) throw new Error(error.message);
    return { id, ...patch } as unknown as Todo;
  }

  const all = loadAllLocal();
  const idx = all.findIndex((t) => t.id === id);
  if (idx === -1) throw new Error('Todo not found');
  const updated = { ...all[idx], ...patch };
  for (const key of Object.keys(patch) as (keyof typeof patch)[]) {
    if (patch[key] === undefined)
      delete (updated as Record<string, unknown>)[key];
  }
  saveAllLocal(all.map((t) => (t.id === id ? updated : t)));
  return updated;
}

export async function deleteTodo(
  id: string,
  userId?: string | null
): Promise<void> {
  if (userId && supabase) {
    const { error } = await supabase
      .from('todos')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);
    if (error) throw new Error(error.message);
    return;
  }
  saveAllLocal(loadAllLocal().filter((t) => t.id !== id));
}
