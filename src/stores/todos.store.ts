import { create } from "zustand";
import type { Todo, PrayerName } from "../lib/types";
import {
  getTodos,
  createTodo as createTodoApi,
  updateTodo as updateTodoApi,
  deleteTodo as deleteTodoApi,
} from "../services/todos.service";
import { useAuthStore } from "./auth.store";

function currentUserId(): string | null {
  return useAuthStore.getState().user?.id ?? null;
}

type TodosState = {
  todos: Todo[];
  loading: boolean;
  error: string | null;
  fetchTodos: (date: string) => Promise<void>;
  addTodo: (
    date: string,
    prayerName: PrayerName,
    text: string,
    startTime?: string,
    endTime?: string
  ) => Promise<void>;
  toggleTodo: (id: string) => Promise<void>;
  editTodo: (id: string, text: string) => Promise<void>;
  updateTodoTime: (id: string, startTime: string | undefined, endTime: string | undefined) => Promise<void>;
  removeTodo: (id: string) => Promise<void>;
  setCalendarEventId: (id: string, eventId: string | null) => Promise<void>;
  getTodosByPrayer: (prayerName: PrayerName) => Todo[];
};

export const useTodosStore = create<TodosState>((set, get) => ({
  todos: [],
  loading: false,
  error: null,

  fetchTodos: async (date) => {
    set({ loading: true, error: null });
    try {
      const todos = await getTodos(date, currentUserId());
      set({ todos, loading: false });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "Failed to load todos", loading: false });
    }
  },

  addTodo: async (date, prayerName, text, startTime, endTime) => {
    if (!text.trim()) return;
    set({ error: null });
    try {
      const todo = await createTodoApi(date, prayerName, text, startTime, endTime, currentUserId());
      set((s) => ({ todos: [...s.todos, todo] }));
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "Failed to add todo" });
    }
  },

  toggleTodo: async (id) => {
    const todo = get().todos.find((t) => t.id === id);
    if (!todo) return;
    set({ error: null });
    const optimistic = { ...todo, done: !todo.done };
    set((s) => ({ todos: s.todos.map((t) => (t.id === id ? optimistic : t)) }));
    try {
      await updateTodoApi(id, { done: !todo.done }, currentUserId());
    } catch (e) {
      // rollback
      set((s) => ({ todos: s.todos.map((t) => (t.id === id ? todo : t)) }));
      set({ error: e instanceof Error ? e.message : "Failed to update todo" });
    }
  },

  editTodo: async (id, text) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const todo = get().todos.find((t) => t.id === id);
    if (!todo) return;
    set({ error: null });
    set((s) => ({ todos: s.todos.map((t) => (t.id === id ? { ...t, text: trimmed } : t)) }));
    try {
      await updateTodoApi(id, { text: trimmed }, currentUserId());
    } catch (e) {
      set((s) => ({ todos: s.todos.map((t) => (t.id === id ? todo : t)) }));
      set({ error: e instanceof Error ? e.message : "Failed to update todo" });
    }
  },

  updateTodoTime: async (id, startTime, endTime) => {
    const todo = get().todos.find((t) => t.id === id);
    if (!todo) return;
    set({ error: null });
    set((s) => ({
      todos: s.todos.map((t) =>
        t.id === id ? { ...t, startTime, endTime } : t
      ),
    }));
    try {
      await updateTodoApi(id, { startTime, endTime }, currentUserId());
    } catch (e) {
      set((s) => ({ todos: s.todos.map((t) => (t.id === id ? todo : t)) }));
      set({ error: e instanceof Error ? e.message : "Failed to update time" });
    }
  },

  removeTodo: async (id) => {
    const prev = get().todos;
    set((s) => ({ todos: s.todos.filter((t) => t.id !== id), error: null }));
    try {
      await deleteTodoApi(id, currentUserId());
    } catch (e) {
      set({ todos: prev, error: e instanceof Error ? e.message : "Failed to delete todo" });
    }
  },

  setCalendarEventId: async (id, eventId) => {
    set({ error: null });
    try {
      const patch = { calendarEventId: eventId ?? undefined };
      await updateTodoApi(id, patch, currentUserId());
      set((s) => ({
        todos: s.todos.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      }));
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "Failed to sync calendar" });
    }
  },

  getTodosByPrayer: (prayerName) => {
    return get().todos.filter((t) => t.prayerName === prayerName);
  },
}));
