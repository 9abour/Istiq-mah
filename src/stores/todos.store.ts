import { create } from 'zustand';
import type { PrayerName, Todo } from '../lib/types';
import {
  createTodo as createTodoApi,
  deleteTodo as deleteTodoApi,
  getTodos,
  updateTodo as updateTodoApi,
} from '../services/todos.service';
import { useAuthStore } from './auth.store';

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
  ) => Promise<Todo | null>;
  toggleTodo: (id: string) => Promise<void>;
  markAsFailed: (id: string) => Promise<void>;
  editTodo: (id: string, text: string) => Promise<void>;
  updateTodoTime: (
    id: string,
    startTime: string | undefined,
    endTime: string | undefined
  ) => Promise<void>;
  updateTodoLoggedTime: (id: string, seconds: number) => Promise<void>;
  updateTodoTimerStartedAt: (
    id: string,
    timestamp: number | null
  ) => Promise<void>;
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
      set({
        error: e instanceof Error ? e.message : 'Failed to load todos',
        loading: false,
      });
    }
  },

  addTodo: async (date, prayerName, text, startTime, endTime) => {
    if (!text.trim()) return null;
    set({ error: null });
    try {
      const todo = await createTodoApi(
        date,
        prayerName,
        text,
        startTime,
        endTime,
        currentUserId()
      );
      set((s) => ({ todos: [...s.todos, todo] }));
      return todo;
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Failed to add todo' });
      return null;
    }
  },

  toggleTodo: async (id) => {
    const todo = get().todos.find((t) => t.id === id);
    if (!todo) return;
    set({ error: null });
    const newDone = !todo.done;
    // If marking as done and it was failed, remove failed status
    const newFailed = newDone ? false : todo.failed;
    const optimistic = { ...todo, done: newDone, failed: newFailed };
    set((s) => ({ todos: s.todos.map((t) => (t.id === id ? optimistic : t)) }));
    try {
      const patch: { done: boolean; failed?: boolean } = { done: newDone };
      if (newFailed !== todo.failed) {
        patch.failed = newFailed;
      }
      await updateTodoApi(id, patch, currentUserId());
    } catch (e) {
      // rollback
      set((s) => ({ todos: s.todos.map((t) => (t.id === id ? todo : t)) }));
      set({ error: e instanceof Error ? e.message : 'Failed to update todo' });
    }
  },

  markAsFailed: async (id) => {
    const todo = get().todos.find((t) => t.id === id);
    if (!todo) return;
    set({ error: null });
    const newFailed = !todo.failed;
    // If marking as failed and it was done, remove done status
    const newDone = newFailed ? false : todo.done;
    const optimistic = { ...todo, failed: newFailed, done: newDone };
    set((s) => ({ todos: s.todos.map((t) => (t.id === id ? optimistic : t)) }));
    try {
      const patch: { failed: boolean; done?: boolean } = { failed: newFailed };
      if (newDone !== todo.done) {
        patch.done = newDone;
      }
      await updateTodoApi(id, patch, currentUserId());
    } catch (e) {
      // rollback
      set((s) => ({ todos: s.todos.map((t) => (t.id === id ? todo : t)) }));
      set({ error: e instanceof Error ? e.message : 'Failed to update todo' });
    }
  },

  editTodo: async (id, text) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const todo = get().todos.find((t) => t.id === id);
    if (!todo) return;
    set({ error: null });
    set((s) => ({
      todos: s.todos.map((t) => (t.id === id ? { ...t, text: trimmed } : t)),
    }));
    try {
      await updateTodoApi(id, { text: trimmed }, currentUserId());
    } catch (e) {
      set((s) => ({ todos: s.todos.map((t) => (t.id === id ? todo : t)) }));
      set({ error: e instanceof Error ? e.message : 'Failed to update todo' });
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
      set({ error: e instanceof Error ? e.message : 'Failed to update time' });
    }
  },

  updateTodoLoggedTime: async (id, seconds) => {
    set((s) => ({
      todos: s.todos.map((t) =>
        t.id === id ? { ...t, loggedTime: seconds } : t
      ),
    }));
    try {
      await updateTodoApi(id, { loggedTime: seconds }, currentUserId());
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Failed to save timer' });
    }
  },

  updateTodoTimerStartedAt: async (id, timestamp) => {
    set((s) => ({
      todos: s.todos.map((t) =>
        t.id === id ? { ...t, timerStartedAt: timestamp ?? undefined } : t
      ),
    }));
    try {
      await updateTodoApi(
        id,
        { timerStartedAt: timestamp ?? undefined },
        currentUserId()
      );
    } catch (e) {
      set({
        error:
          e instanceof Error ? e.message : 'Failed to save timer start time',
      });
    }
  },

  removeTodo: async (id) => {
    const prev = get().todos;
    set((s) => ({ todos: s.todos.filter((t) => t.id !== id), error: null }));
    try {
      await deleteTodoApi(id, currentUserId());
    } catch (e) {
      set({
        todos: prev,
        error: e instanceof Error ? e.message : 'Failed to delete todo',
      });
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
      set({
        error: e instanceof Error ? e.message : 'Failed to sync calendar',
      });
    }
  },

  getTodosByPrayer: (prayerName) => {
    return get().todos.filter((t) => t.prayerName === prayerName);
  },
}));
