/**
 * Todos service — uses Firestore when a userId is provided (logged in),
 * falls back to localStorage for anonymous users.
 *
 * Firestore path:  users/{userId}/todos/{todoId}
 */
import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  query,
  where,
  serverTimestamp,
  type FieldValue,
} from "firebase/firestore";
import type { Todo, PrayerName } from "../lib/types";
import { uid, toDateString } from "../lib/utils";
import { getStored, setStored, STORAGE_KEYS } from "../lib/storage";
import { db } from "../lib/firebase";

// ─── localStorage helpers ────────────────────────────────────────────────────

type StoredTodo = Todo | (Omit<Todo, "date"> & { date?: string });

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

// ─── Firestore helpers ───────────────────────────────────────────────────────

function userTodosCol(userId: string) {
  if (!db) throw new Error("Firestore not configured");
  return collection(db, "users", userId, "todos");
}

function docFromFirestore(d: { id: string; data: () => Record<string, unknown> }): Todo {
  const data = d.data();
  return {
    id: d.id,
    text: data.text as string,
    done: data.done as boolean,
    prayerName: data.prayerName as PrayerName,
    date: data.date as string,
    startTime: (data.startTime as string | undefined) ?? undefined,
    endTime: (data.endTime as string | undefined) ?? undefined,
    calendarEventId: (data.calendarEventId as string | undefined) ?? undefined,
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function getTodos(date: string, userId?: string | null): Promise<Todo[]> {
  if (userId && db) {
    const col = userTodosCol(userId);
    const q = query(col, where("date", "==", date));
    const snap = await getDocs(q);
    return snap.docs.map((d) => docFromFirestore(d as Parameters<typeof docFromFirestore>[0]));
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
  const payload: Record<string, unknown> = {
    text: text.trim(),
    done: false,
    prayerName,
    date,
    ...(startTime ? { startTime } : {}),
    ...(endTime ? { endTime } : {}),
  };

  if (userId && db) {
    const col = userTodosCol(userId);
    const ref = await addDoc(col, { ...payload, createdAt: serverTimestamp() });
    return { id: ref.id, ...payload } as Todo;
  }

  const todo: Todo = { id: uid(), ...payload } as Todo;
  const all = loadAllLocal();
  saveAllLocal([...all, todo]);
  return todo;
}

export async function updateTodo(
  id: string,
  patch: Partial<Pick<Todo, "text" | "done" | "calendarEventId" | "startTime" | "endTime">>,
  userId?: string | null
): Promise<Todo> {
  if (userId && db) {
    const ref = doc(db, "users", userId, "todos", id);
    // undefined → deleteField() so the field is actually removed from Firestore
    const clean: Record<string, unknown | FieldValue> = {};
    for (const [k, v] of Object.entries(patch)) {
      clean[k] = v === undefined ? deleteField() : v;
    }
    await updateDoc(ref, clean);
    return { id, ...patch } as unknown as Todo;
  }

  const all = loadAllLocal();
  const idx = all.findIndex((t) => t.id === id);
  if (idx === -1) throw new Error("Todo not found");
  const updated = { ...all[idx], ...patch };
  // Remove keys explicitly set to undefined (localStorage has no deleteField equivalent)
  for (const key of Object.keys(patch) as (keyof typeof patch)[]) {
    if (patch[key] === undefined) delete (updated as Record<string, unknown>)[key];
  }
  saveAllLocal(all.map((t) => (t.id === id ? updated : t)));
  return updated;
}

export async function deleteTodo(id: string, userId?: string | null): Promise<void> {
  if (userId && db) {
    const ref = doc(db, "users", userId, "todos", id);
    await deleteDoc(ref);
    return;
  }
  saveAllLocal(loadAllLocal().filter((t) => t.id !== id));
}
