import { useState, useRef, useEffect } from "react";
import type { Todo } from "../lib/types";
import { useAuthStore } from "../stores/auth.store";
import {
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
} from "../services/calendar.service";
import { TimeRangePicker } from "./TimeRangePicker";
import "./TodoItem.css";

type TodoItemProps = {
  todo: Todo;
  onToggle: () => void;
  onDelete: () => void;
  onUpdate: (text: string) => Promise<void>;
  onUpdateTime: (startTime: string | undefined, endTime: string | undefined) => Promise<void>;
  onCalendarSync: (eventId: string | null) => Promise<void>;
  selectedDate: string;
  /** Prayer window bounds for the TimeRangePicker */
  minTime?: string;
  maxTime?: string;
  wrapsMidnight?: boolean;
  contextLabel?: string;
};

function CalendarIcon({ synced }: { synced: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect
        x="1" y="2.5" width="12" height="10.5"
        rx="1.5"
        stroke={synced ? "#4CAF8A" : "currentColor"}
        strokeWidth="1.3"
        fill={synced ? "rgba(76,175,138,0.15)" : "none"}
      />
      <line x1="1" y1="5.5" x2="13" y2="5.5" stroke={synced ? "#4CAF8A" : "currentColor"} strokeWidth="1.3" />
      <line x1="4.5" y1="1" x2="4.5" y2="4" stroke={synced ? "#4CAF8A" : "currentColor"} strokeWidth="1.3" strokeLinecap="round" />
      <line x1="9.5" y1="1" x2="9.5" y2="4" stroke={synced ? "#4CAF8A" : "currentColor"} strokeWidth="1.3" strokeLinecap="round" />
      {synced && (
        <path d="M4.5 8.5L6 10L9.5 7" stroke="#4CAF8A" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
      <path
        d="M7.5 1.5L9.5 3.5M1 10H3L9.5 3.5L7.5 1.5L1 8V10Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function TodoItem({
  todo,
  onToggle,
  onDelete,
  onUpdate,
  onUpdateTime,
  onCalendarSync,
  selectedDate,
  minTime,
  maxTime,
  wrapsMidnight,
  contextLabel,
}: TodoItemProps) {
  const { user, googleAccessToken, signInWithGoogle } = useAuthStore();

  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(todo.text);
  const [calLoading, setCalLoading] = useState(false);
  const [calError, setCalError] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      setEditText(todo.text);
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing, todo.text]);

  const isSynced = Boolean(todo.calendarEventId);
  const canSync = Boolean(user && todo.startTime && todo.endTime);

  // ── Edit helpers ────────────────────────────────────────────────────────────

  const startEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditing(true);
  };

  const cancelEdit = (e?: React.MouseEvent | React.KeyboardEvent) => {
    e?.stopPropagation();
    setEditing(false);
    setEditText(todo.text);
  };

  const confirmEdit = async (e?: React.MouseEvent | React.KeyboardEvent) => {
    e?.stopPropagation();
    const trimmed = editText.trim();
    if (!trimmed || trimmed === todo.text) {
      setEditing(false);
      return;
    }
    setEditing(false);
    await onUpdate(trimmed);

    // If synced, also patch the Calendar event with the new title
    if (isSynced && todo.calendarEventId && googleAccessToken) {
      try {
        const updated = { ...todo, text: trimmed };
        await updateCalendarEvent(googleAccessToken, todo.calendarEventId, updated, selectedDate);
      } catch {
        // Calendar update is best-effort — don't surface to user
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") confirmEdit(e);
    else if (e.key === "Escape") cancelEdit(e);
  };

  // ── Delete with calendar cleanup ────────────────────────────────────────────

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteLoading(true);
    // Remove the calendar event first so it doesn't become orphaned
    if (isSynced && todo.calendarEventId && googleAccessToken) {
      try {
        await deleteCalendarEvent(googleAccessToken, todo.calendarEventId);
      } catch {
        // Best-effort — proceed with local deletion regardless
      }
    }
    onDelete();
    // No need to setDeleteLoading(false) — the component unmounts after delete
  };

  // ── Time range update (with calendar event sync) ────────────────────────────

  const handleTimeChange = async (
    newStart: string | undefined,
    newEnd: string | undefined
  ) => {
    await onUpdateTime(newStart, newEnd);

    // Keep calendar in sync
    if (isSynced && todo.calendarEventId) {
      if (!newStart || !newEnd) {
        // Time was removed → delete the orphaned calendar event
        if (googleAccessToken) {
          try {
            await deleteCalendarEvent(googleAccessToken, todo.calendarEventId);
          } catch { /* best-effort */ }
        }
        await onCalendarSync(null);
      } else if (googleAccessToken) {
        // Time was changed → patch the calendar event
        try {
          const updated = { ...todo, startTime: newStart, endTime: newEnd };
          await updateCalendarEvent(googleAccessToken, todo.calendarEventId, updated, selectedDate);
        } catch { /* best-effort */ }
      }
    }
  };

  // ── Calendar sync toggle ─────────────────────────────────────────────────────

  const handleCalendarToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setCalError(null);

    if (!user || !googleAccessToken) {
      await signInWithGoogle().catch(() => {});
      return;
    }

    setCalLoading(true);
    try {
      if (isSynced && todo.calendarEventId) {
        await deleteCalendarEvent(googleAccessToken, todo.calendarEventId);
        await onCalendarSync(null);
      } else {
        const eventId = await createCalendarEvent(googleAccessToken, todo, selectedDate);
        await onCalendarSync(eventId);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Calendar error";
      if (msg === "UNAUTHORIZED") {
        setCalError("Session expired — please sign in again");
        await signInWithGoogle().catch(() => {});
      } else {
        setCalError(msg);
      }
    } finally {
      setCalLoading(false);
    }
  };

  return (
    <div
      onClick={editing ? undefined : onToggle}
      className={`todo-item group ${todo.done ? "todo-item--done" : ""} ${editing ? "todo-item--editing" : ""}`}
    >
      <div className="todo-item__checkbox">
        {todo.done && (
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
            <path
              d="M1 4L3.5 6.5L9 1"
              stroke="#090f10"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>

      <div className="todo-item__body">
        {editing ? (
          <div className="todo-item__edit-row" onClick={(e) => e.stopPropagation()}>
            <input
              ref={inputRef}
              className="todo-item__edit-input"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={handleKeyDown}
              maxLength={200}
            />
            <button
              type="button"
              className="todo-item__edit-save"
              onClick={confirmEdit}
              title="Save"
            >
              <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
                <path d="M1 4.5L3.8 7.5L10 1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              type="button"
              className="todo-item__edit-cancel"
              onClick={cancelEdit}
              title="Cancel"
            >
              <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                <path d="M1 1L8 8M8 1L1 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        ) : (
          <span className="todo-item__text">{todo.text}</span>
        )}

        <div className="todo-item__meta" onClick={(e) => e.stopPropagation()}>
          {/* Time range — click to edit in the Google Calendar modal */}
          <TimeRangePicker
            startTime={todo.startTime}
            endTime={todo.endTime}
            onChange={handleTimeChange}
            minTime={minTime}
            maxTime={maxTime}
            wrapsMidnight={wrapsMidnight}
            contextLabel={contextLabel}
          />

          {canSync && (
            <button
              type="button"
              onClick={handleCalendarToggle}
              disabled={calLoading}
              className={`todo-item__cal-btn ${isSynced ? "todo-item__cal-btn--synced" : ""}`}
              title={isSynced ? "Remove from Google Calendar" : "Add to Google Calendar"}
            >
              {calLoading ? (
                <span className="todo-item__cal-spinner" />
              ) : (
                <CalendarIcon synced={isSynced} />
              )}
              <span>{isSynced ? "Synced" : "Add to Cal"}</span>
            </button>
          )}

          {calError && (
            <span className="todo-item__cal-error">{calError}</span>
          )}
        </div>
      </div>

      {!editing && (
        <div className="todo-item__actions">
          <button
            type="button"
            onClick={startEdit}
            className="todo-item__edit-btn"
            aria-label="Edit task"
            title="Edit"
          >
            <PencilIcon />
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleteLoading}
            className="todo-item__delete"
            aria-label="Delete task"
            title="Delete"
          >
            {deleteLoading ? (
              <span className="todo-item__cal-spinner" />
            ) : (
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                <path d="M1.5 3H9.5M4 3V2H7V3M4.5 5V8.5M6.5 5V8.5M2.5 3L3 9.5H8L8.5 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
