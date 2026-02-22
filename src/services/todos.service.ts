import type { Todo } from "../lib/types";
import type { PrayerName } from "../lib/types";
import { uid, toDateString } from "../lib/utils";
import { getStored, setStored, STORAGE_KEYS } from "../lib/storage";

function seedForDate(date: string): Todo[] {
  const base: Omit<Todo, "date">[] = [
    { id: "f1", text: "Morning dhikr & adhkar", done: false, prayerName: "Fajr" },
    { id: "f2", text: "Read Quran – Surah Al-Mulk", done: false, prayerName: "Fajr" },
    { id: "f3", text: "Fajr sunnah prayers", done: false, prayerName: "Fajr" },
    { id: "d1", text: "Reply to work emails", done: false, prayerName: "Dhuhr" },
    { id: "d2", text: "Team standup meeting", done: false, prayerName: "Dhuhr" },
    { id: "d3", text: "Lunch break walk", done: false, prayerName: "Dhuhr" },
    { id: "a1", text: "Review project proposal", done: false, prayerName: "Asr" },
    { id: "a2", text: "Call parents", done: false, prayerName: "Asr" },
    { id: "m1", text: "Family dinner", done: false, prayerName: "Maghrib" },
    { id: "m2", text: "Evening adhkar", done: false, prayerName: "Maghrib" },
    { id: "i1", text: "Study Arabic vocabulary", done: false, prayerName: "Isha" },
    { id: "i2", text: "Journal — gratitude & goals", done: false, prayerName: "Isha" },
    { id: "i3", text: "Prepare for tomorrow", done: false, prayerName: "Isha" },
  ];
  return base.map((t) => ({ ...t, date }));
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

type StoredTodo = Todo | (Omit<Todo, "date"> & { date?: string });

function loadAllTodos(): Todo[] {
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

export async function getTodos(date: string): Promise<Todo[]> {
  await delay(20);
  const all = loadAllTodos();
  return all.filter((t) => t.date === date);
}

export async function getTodosByPrayer(
  date: string,
  prayerName: PrayerName
): Promise<Todo[]> {
  await delay(10);
  return loadAllTodos().filter((t) => t.date === date && t.prayerName === prayerName);
}

export async function createTodo(
  date: string,
  prayerName: PrayerName,
  text: string
): Promise<Todo> {
  await delay(20);
  const todos = loadAllTodos();
  const todo: Todo = {
    id: uid(),
    text: text.trim(),
    done: false,
    prayerName,
    date,
  };
  const next = [...todos, todo];
  setStored(STORAGE_KEYS.todos, next);
  return todo;
}

export async function updateTodo(
  id: string,
  patch: Partial<Pick<Todo, "text" | "done">>
): Promise<Todo> {
  await delay(10);
  const todos = loadAllTodos();
  const idx = todos.findIndex((t) => t.id === id);
  if (idx === -1) throw new Error("Todo not found");
  const updated = { ...todos[idx], ...patch };
  const next = todos.map((t) => (t.id === id ? updated : t));
  setStored(STORAGE_KEYS.todos, next);
  return updated;
}

export async function deleteTodo(id: string): Promise<void> {
  await delay(10);
  const next = loadAllTodos().filter((t) => t.id !== id);
  setStored(STORAGE_KEYS.todos, next);
}
