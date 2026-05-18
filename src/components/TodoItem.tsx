import { useCallback, useEffect, useRef, useState } from 'react';
import type { Todo } from '../lib/types';
import {
  createCalendarEvent,
  deleteCalendarEvent,
  updateCalendarEvent,
} from '../services/calendar.service';
import { useTodosStore } from '../stores/todos.store';
import { TimeRangePicker } from './TimeRangePicker';
import './TodoItem.css';

type TodoItemProps = {
  todo: Todo;
  onToggle: () => void;
  onDelete: () => void;
  onUpdate: (text: string) => Promise<void>;
  onUpdateTime: (
    startTime: string | undefined,
    endTime: string | undefined
  ) => Promise<void>;
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
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        x="1"
        y="2.5"
        width="12"
        height="10.5"
        rx="1.5"
        stroke={synced ? '#4CAF8A' : 'currentColor'}
        strokeWidth="1.3"
        fill={synced ? 'rgba(76,175,138,0.15)' : 'none'}
      />
      <line
        x1="1"
        y1="5.5"
        x2="13"
        y2="5.5"
        stroke={synced ? '#4CAF8A' : 'currentColor'}
        strokeWidth="1.3"
      />
      <line
        x1="4.5"
        y1="1"
        x2="4.5"
        y2="4"
        stroke={synced ? '#4CAF8A' : 'currentColor'}
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <line
        x1="9.5"
        y1="1"
        x2="9.5"
        y2="4"
        stroke={synced ? '#4CAF8A' : 'currentColor'}
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      {synced && (
        <path
          d="M4.5 8.5L6 10L9.5 7"
          stroke="#4CAF8A"
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
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

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
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
  const { updateTodoLoggedTime } = useTodosStore();

  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(todo.text);
  const [calLoading, setCalLoading] = useState(false);
  const [calError, setCalError] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // ── Timer state ─────────────────────────────────────────────────────────────
  const [timerRunning, setTimerRunning] = useState(false);
  const [displayedSeconds, setDisplayedSeconds] = useState(todo.loggedTime ?? 0);
  // How many seconds were saved before the current running session
  const savedSecondsRef = useRef(todo.loggedTime ?? 0);
  // Timestamp (ms) when the current running session started
  const sessionStartRef = useRef<number | null>(null);

  // Keep savedSecondsRef in sync if the todo prop updates (e.g. from DB refresh)
  useEffect(() => {
    if (!timerRunning) {
      savedSecondsRef.current = todo.loggedTime ?? 0;
      setDisplayedSeconds(todo.loggedTime ?? 0);
    }
  }, [todo.loggedTime, timerRunning]);

  const getCurrentTotal = useCallback((): number => {
    if (sessionStartRef.current === null) return savedSecondsRef.current;
    const sessionSecs = (Date.now() - sessionStartRef.current) / 1000;
    return savedSecondsRef.current + sessionSecs;
  }, []);

  const stopAndSave = useCallback(async () => {
    if (!timerRunning) return;
    const total = Math.round(getCurrentTotal());
    setTimerRunning(false);
    sessionStartRef.current = null;
    savedSecondsRef.current = total;
    setDisplayedSeconds(total);
    await updateTodoLoggedTime(todo.id, total);
  }, [timerRunning, getCurrentTotal, updateTodoLoggedTime, todo.id]);

  // Tick every second while running
  useEffect(() => {
    if (!timerRunning) return;
    const interval = setInterval(() => {
      setDisplayedSeconds(Math.floor(getCurrentTotal()));
    }, 1000);
    return () => clearInterval(interval);
  }, [timerRunning, getCurrentTotal]);

  // Stop timer when page is hidden / tab is closed
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && timerRunning) {
        stopAndSave();
      }
    };
    const handleBeforeUnload = () => {
      if (timerRunning) {
        const total = Math.round(getCurrentTotal());
        // Best-effort synchronous save for localStorage fallback
        updateTodoLoggedTime(todo.id, total);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [timerRunning, stopAndSave, getCurrentTotal, updateTodoLoggedTime, todo.id]);

  const handleTimerToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (timerRunning) {
      stopAndSave();
    } else {
      sessionStartRef.current = Date.now();
      setTimerRunning(true);
    }
  };

  // ── Edit helpers ────────────────────────────────────────────────────────────

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      setEditText(todo.text);
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing, todo.text]);

  const isSynced = Boolean(todo.calendarEventId);
  const canSync = Boolean(todo.startTime && todo.endTime);

  // ── Toggle with calendar status sync ────────────────────────────────────────

  const handleToggle = async () => {
    const newDone = !todo.done;
    onToggle();
    if (isSynced && todo.calendarEventId) {
      try {
        await updateCalendarEvent(todo.calendarEventId, todo, selectedDate, newDone);
      } catch {
        // Best-effort
      }
    }
  };

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

    if (isSynced && todo.calendarEventId) {
      try {
        await updateCalendarEvent(todo.calendarEventId, { ...todo, text: trimmed }, selectedDate);
      } catch {
        // Best-effort
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') confirmEdit(e);
    else if (e.key === 'Escape') cancelEdit(e);
  };

  // ── Delete with calendar cleanup ────────────────────────────────────────────

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteLoading(true);
    if (isSynced && todo.calendarEventId) {
      try {
        await deleteCalendarEvent(todo.calendarEventId);
      } catch {
        // Best-effort
      }
    }
    onDelete();
  };

  // ── Time range update (with calendar event sync) ────────────────────────────

  const handleTimeChange = async (
    newStart: string | undefined,
    newEnd: string | undefined
  ) => {
    await onUpdateTime(newStart, newEnd);

    if (isSynced && todo.calendarEventId) {
      if (!newStart || !newEnd) {
        try {
          await deleteCalendarEvent(todo.calendarEventId);
        } catch {
          /* best-effort */
        }
        await onCalendarSync(null);
      } else {
        try {
          await updateCalendarEvent(
            todo.calendarEventId,
            { ...todo, startTime: newStart, endTime: newEnd },
            selectedDate
          );
        } catch {
          /* best-effort */
        }
      }
    }
  };

  // ── Calendar sync toggle ─────────────────────────────────────────────────────

  const handleCalendarToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setCalError(null);
    setCalLoading(true);
    try {
      if (isSynced && todo.calendarEventId) {
        await deleteCalendarEvent(todo.calendarEventId);
        await onCalendarSync(null);
      } else {
        const eventId = await createCalendarEvent(todo, selectedDate);
        await onCalendarSync(eventId);
      }
    } catch (err) {
      setCalError(err instanceof Error ? err.message : 'Calendar error');
    } finally {
      setCalLoading(false);
    }
  };

  return (
    <div
      onClick={editing ? undefined : handleToggle}
      className={`todo-item group ${todo.done ? 'todo-item--done' : ''} ${editing ? 'todo-item--editing' : ''}`}
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
          <div
            className="todo-item__edit-row"
            onClick={(e) => e.stopPropagation()}
          >
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
                <path
                  d="M1 4.5L3.8 7.5L10 1"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <button
              type="button"
              className="todo-item__edit-cancel"
              onClick={cancelEdit}
              title="Cancel"
            >
              <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                <path
                  d="M1 1L8 8M8 1L1 8"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        ) : (
          <span className="todo-item__text">{todo.text}</span>
        )}

        <div className="todo-item__meta" onClick={(e) => e.stopPropagation()}>
          {/* Timer */}
          <button
            type="button"
            className={`todo-item__timer-btn ${timerRunning ? 'todo-item__timer-btn--running' : ''}`}
            onClick={handleTimerToggle}
            title={timerRunning ? 'Stop timer' : 'Start timer'}
          >
            {timerRunning ? (
              <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                <rect x="1" y="1" width="2.5" height="7" rx="0.5" fill="currentColor" />
                <rect x="5.5" y="1" width="2.5" height="7" rx="0.5" fill="currentColor" />
              </svg>
            ) : (
              <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                <path d="M1.5 1L8 4.5L1.5 8V1Z" fill="currentColor" />
              </svg>
            )}
            <span className={`todo-item__timer-display ${displayedSeconds > 0 ? 'todo-item__timer-display--active' : ''}`}>
              {formatElapsed(displayedSeconds)}
            </span>
          </button>

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
              className={`todo-item__cal-btn ${isSynced ? 'todo-item__cal-btn--synced' : ''}`}
              title={
                isSynced
                  ? 'Remove from Google Calendar'
                  : 'Add to Google Calendar'
              }
            >
              {calLoading ? (
                <span className="todo-item__cal-spinner" />
              ) : (
                <CalendarIcon synced={isSynced} />
              )}
              <span>{isSynced ? 'Synced' : 'Add to Cal'}</span>
            </button>
          )}

          {calError && <span className="todo-item__cal-error">{calError}</span>}
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
                <path
                  d="M1.5 3H9.5M4 3V2H7V3M4.5 5V8.5M6.5 5V8.5M2.5 3L3 9.5H8L8.5 3"
                  stroke="currentColor"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
