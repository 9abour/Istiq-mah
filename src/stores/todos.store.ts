import { create } from "zustand";
import type { Todo } from "../lib/types";
import type { PrayerName } from "../lib/types";
import {
  getTodos,
  createTodo as createTodoApi,
  updateTodo as updateTodoApi,
  deleteTodo as deleteTodoApi,
} from "../services/todos.service";

type TodosState = {
  todos: Todo[];
  loading: boolean;
  error: string | null;
  /** Fetches todos for the given date (YYYY-MM-DD). */
  fetchTodos: (date: string) => Promise<void>;
  addTodo: (date: string, prayerName: PrayerName, text: string) => Promise<void>;
  toggleTodo: (id: string) => Promise<void>;
  removeTodo: (id: string) => Promise<void>;
  getTodosByPrayer: (prayerName: PrayerName) => Todo[];
};

export const useTodosStore = create<TodosState>((set, get) => ({
  todos: [],
  loading: false,
  error: null,

  fetchTodos: async (date) => {
    set({ loading: true, error: null });
    try {
      const todos = await getTodos(date);
      set({ todos, loading: false });
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : "Failed to load todos",
        loading: false,
      });
    }
  },

  addTodo: async (date, prayerName, text) => {
    if (!text.trim()) return;
    set({ error: null });
    try {
      const todo = await createTodoApi(date, prayerName, text);
      set((s) => ({ todos: [...s.todos, todo] }));
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : "Failed to add todo",
      });
    }
  },

  toggleTodo: async (id) => {
    const todo = get().todos.find((t) => t.id === id);
    if (!todo) return;
    set({ error: null });
    try {
      const updated = await updateTodoApi(id, { done: !todo.done });
      set((s) => ({
        todos: s.todos.map((t) => (t.id === id ? updated : t)),
      }));
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : "Failed to update todo",
      });
    }
  },

  removeTodo: async (id) => {
    set({ error: null });
    try {
      await deleteTodoApi(id);
      set((s) => ({ todos: s.todos.filter((t) => t.id !== id) }));
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : "Failed to delete todo",
      });
    }
  },

  getTodosByPrayer: (prayerName) => {
    return get().todos.filter((t) => t.prayerName === prayerName);
  },
}));
