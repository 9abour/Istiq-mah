'use client';

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import type {
  Filter,
  Prayer,
  Athkar,
  Todo,
  SavedLocation,
} from '../../src/lib/types';
import {
  getNowIdx,
  getStatus,
  toDateString,
  isToday,
  formatDateLabel,
} from '../../src/lib/utils';
import { getPrayers } from '../../src/services/prayers.service';
import { getAthkar } from '../../src/services/athkar.service';
import { useTodosStore } from '../../src/stores/todos.store';
import { useAuthStore } from '../../src/stores/auth.store';
import { getStored, STORAGE_KEYS } from '../../src/lib/storage';
import { GeoBg } from '../../src/components/GeoBg';
import { ProgressRing } from '../../src/components/ProgressRing';
import { AthkarCard } from '../../src/components/AthkarCard';
import { PrayerCard } from '../../src/components/PrayerCard';
import { TodoItem } from '../../src/components/TodoItem';
import { LoginButton } from '../../src/components/LoginButton';
import { TimeRangePicker } from '../../src/components/TimeRangePicker';
import { LocationModal } from '../../src/components/LocationModal';
import '../../src/styles/globals.css';
import '../../src/styles/Page.css';
import { LOGO_ICON } from 'public/icons/common';

function getStoredLocation(): SavedLocation | null {
  return getStored<SavedLocation>(STORAGE_KEYS.location);
}

/**
 * Snap a prayer-time string (e.g. "05:34", "12:14 (EET)") to the
 * nearest 15-minute slot value ("HH:MM").
 */
function snapPrayerTime(raw: string): string {
  const match = raw.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return "00:00";
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const snapped = Math.round((h * 60 + m) / 15) * 15;
  const sh = Math.floor(snapped / 60) % 24;
  const sm = snapped % 60;
  return `${String(sh).padStart(2, "0")}:${String(sm).padStart(2, "0")}`;
}

/** "9:30 AM" from an HH:MM slot value */
function slotLabel(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h < 12 ? "AM" : "PM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

function Home() {
  const [loadingLocation, setLoadingLocation] = useState(true);
  const [location, setLocation] = useState<SavedLocation | null>(() =>
    getStoredLocation()
  );
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [prayers, setPrayers] = useState<Prayer[]>([]);
  const [selected, setSelected] = useState(0);
  const [filter, setFilter] = useState<Filter>('all');
  const [addText, setAddText] = useState('');
  const [addStart, setAddStart] = useState<string | undefined>(undefined);
  const [addEnd, setAddEnd] = useState<string | undefined>(undefined);
  const [now, setNow] = useState(new Date());
  const [athkar, setAthkar] = useState<Athkar | null>(null);
  const [selectedDate, setSelectedDate] = useState(() =>
    toDateString(new Date())
  );
  const addRef = useRef<HTMLInputElement>(null);

  const navigate = useNavigate();

  // Auth
  const { user, loading: authLoading, configured, initAuth } = useAuthStore();
  useEffect(() => {
    const unsub = initAuth();
    return unsub;
  }, [initAuth]);

  // Guard: when Firebase is configured and auth has resolved, redirect to /login if not signed in
  useEffect(() => {
    if (configured && !authLoading && !user) {
      navigate('/login', { replace: true });
    }
  }, [configured, authLoading, user, navigate]);

  const goToPrevDay = () => {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() - 1);
    setSelectedDate(toDateString(d));
  };
  const goToNextDay = () => {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() + 1);
    setSelectedDate(toDateString(d));
  };

  useEffect(() => {
    const stored = getStoredLocation();
    setLocation(stored);
    setLoadingLocation(false); // getStored is synchronous — no async wait needed
  }, []);

  const {
    todos,
    loading: todosLoading,
    fetchTodos,
    addTodo,
    toggleTodo,
    editTodo,
    updateTodoTime,
    removeTodo,
    setCalendarEventId,
    getTodosByPrayer,
  } = useTodosStore();

  const nowIdx = prayers.length ? getNowIdx(prayers) : 0;
  const prayer = prayers[selected];
  const prayerTodos = prayer ? getTodosByPrayer(prayer.name) : [];

  // ── Prayer-window bounds for the time range picker ──────────────────────
  // Window = from this prayer's time → next prayer's time.
  // Isha wraps past midnight back to Fajr.
  const nextPrayer =
    prayers.length > 0
      ? prayers[(selected + 1) % prayers.length]
      : null;
  const isIsha = prayer?.name === 'Isha';
  const timeMin = prayer ? snapPrayerTime(prayer.time) : '00:00';
  const timeMax = nextPrayer ? snapPrayerTime(nextPrayer.time) : '23:45';
  const timeContextLabel = nextPrayer
    ? `${prayer?.name} ${slotLabel(timeMin)} → ${nextPrayer.name} ${slotLabel(timeMax)}${isIsha ? ' (next day)' : ''}`
    : `${prayer?.name} ${slotLabel(timeMin)} onwards`;
  const filteredTodos =
    filter === 'all'
      ? prayerTodos
      : filter === 'done'
        ? prayerTodos.filter((t: Todo) => t.done)
        : prayerTodos.filter((t: Todo) => !t.done);
  const pDone = prayer ? prayerTodos.filter((t: Todo) => t.done).length : 0;
  const pTotal = prayer ? prayerTodos.length : 0;
  const dayPct = todos.length
    ? Math.round(
        (todos.filter((t: Todo) => t.done).length / todos.length) * 100
      )
    : 0;

  useEffect(() => {
    if (!location) return;
    getPrayers(location).then((p) => {
      setPrayers(p);
      setSelected(getNowIdx(p));
    });
  }, [location]);

  // Refetch todos when date OR auth user changes
  useEffect(() => {
    fetchTodos(selectedDate);
  }, [fetchTodos, selectedDate, user?.uid]);

  useEffect(() => {
    if (prayer) {
      getAthkar(prayer.name).then(setAthkar);
    } else {
      setAthkar(null);
    }
  }, [prayer?.name]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(t);
  }, []);

  const handleAdd = () => {
    if (!prayer || !addText.trim()) return;
    addTodo(selectedDate, prayer.name, addText, addStart, addEnd);
    setAddText('');
    setAddStart(undefined);
    setAddEnd(undefined);
    addRef.current?.focus();
  };

  const handleLocationConfirm = (newLocation: SavedLocation) => {
    setLocation(newLocation);
    setShowLocationModal(false);
  };

  // While Firebase resolves auth, show a minimal spinner (prevents content flash before redirect)
  if (configured && authLoading) {
    return (
      <main className="page">
        <GeoBg />
        <div className="page__glow_empty" />
        <div className="page__content" style={{ alignItems: 'center', justifyContent: 'center' }}>
          <div className="page__empty-state">
            <div className="page__empty-state-icon">☽</div>
            <div className="page__empty-state-text">Loading…</div>
          </div>
        </div>
      </main>
    );
  }

  if (loadingLocation) {
    return (
      <main className="page">
        <GeoBg />
        <div className="page__glow_empty" />
        <div className="page__content" style={{ alignItems: 'center', justifyContent: 'center' }}>
          <div className="page__empty-state">
            <div className="page__empty-state-icon">🕌</div>
            <div className="page__empty-state-text">Loading...</div>
          </div>
        </div>
      </main>
    );
  }

  if (!location) {
    return (
      <main className="page">
        <GeoBg />
        <div className="page__glow_empty" />
        <LocationModal onConfirm={handleLocationConfirm} />
      </main>
    );
  }

  if (!prayers.length) {
    return (
      <main className="page">
        <GeoBg />
        <div className="page__glow_empty" />
        <div className="page__content" style={{ alignItems: 'center', justifyContent: 'center' }}>
          <div className="page__empty-state">
            <div className="page__empty-state-icon">🕌</div>
            <div className="page__empty-state-text">Loading…</div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <GeoBg />
      <div className="page__glow" />
      <div className="page__content">
        {/* ── Header ── */}
        <header className="page__header anim-fade-up-0">
          <div className="page__header-left">
            <div>
              <span className="page__header-icon">{LOGO_ICON}</span>
              <div className="page__title">Istiqāmah</div>
              <div className="page__subtitle">Track your day by prayer time</div>
            </div>
          </div>
          <div className="page__header-right">
            <div className="page__header-time-row">
              <div>
                <div className="page__time">
                  {now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </div>
                <div className="page__date">
                  {now.toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                  })}
                </div>
              </div>
              <LoginButton />
              <button
                type="button"
                className="page__refresh-location"
                onClick={() => setShowLocationModal(true)}
                title="Refresh location"
                aria-label="Refresh location"
              >
                ↻
              </button>
            </div>
          </div>
        </header>

        {/* ── Prayer strip ── */}
        <div className="page__prayer-strip anim-fade-up-1">
          {prayers.map((p, i) => (
            <PrayerCard
              key={p.name}
              prayer={p}
              doneCount={getTodosByPrayer(p.name).filter((t: Todo) => t.done).length}
              totalCount={getTodosByPrayer(p.name).length}
              isSelected={i === selected}
              isNow={i === nowIdx}
              onClick={() => {
                setSelected(i);
                setFilter('all');
                setAddStart(undefined);
                setAddEnd(undefined);
              }}
            />
          ))}
        </div>

        {/* ── Main grid ── */}
        <div className="page__main-grid anim-fade-up-2">

          {/* Left panel */}
          <aside className="page__left-panel">
            <div className="page__left-panel-line" />
            <div className="page__left-panel-inner">
              <div className="page__section-label">Selected Prayer</div>
              <div className="page__prayer-title">{prayer.name}</div>
              <div className="page__prayer-arabic">{prayer.arabic}</div>
              <div className="page__prayer-meta">
                <span className="page__prayer-time">{prayer.time}</span>
                <div className="page__prayer-meta-divider" />
                <span className="page__prayer-status">{getStatus(selected, nowIdx)}</span>
              </div>

              <div className="page__stats-row">
                <ProgressRing done={pDone} total={pTotal} />
                <div className="page__stats-list">
                  {(
                    [
                      ['Completed', pDone, true],
                      ['Remaining', pTotal - pDone, false],
                      ['Total', pTotal, false],
                    ] as [string, number, boolean][]
                  ).map(([k, v, g]) => (
                    <div key={k} className="page__stats-row-item">
                      <span className="page__stats-label">{k}</span>
                      <span className={`page__stats-value ${g ? 'page__stats-value--accent' : ''}`}>
                        {v}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="page__athkar-label">Athkar &amp; Reflection</div>
              {athkar ? (
                <AthkarCard athkar={athkar} />
              ) : (
                <div className="page__empty-state-text">Loading athkar…</div>
              )}
            </div>
          </aside>

          {/* Right panel */}
          <div className="page__right-panel">
            <div className="page__right-header">
              <div>
                <div className="page__right-title">{prayer.name} Tasks</div>
                <div className="page__right-subtitle">
                  {prayer.arabic} · {prayer.time}
                </div>
              </div>
              <span className="page__right-badge">{pDone}/{pTotal} done</span>
            </div>

            <div className="page__date-nav">
              <button type="button" className="page__date-nav-btn" onClick={goToPrevDay} aria-label="Previous day">‹</button>
              <span className="page__date-nav-label">{formatDateLabel(selectedDate)}</span>
              <button type="button" className="page__date-nav-btn" onClick={goToNextDay} aria-label="Next day">›</button>
            </div>

            <div className="page__filter-row">
              {(['all', 'pending', 'done'] as Filter[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`page__filter-btn ${filter === f ? 'page__filter-btn--active' : ''}`}
                >
                  {f}
                </button>
              ))}
            </div>

            <div className="page__todo-list">
              {todosLoading && todos.length === 0 ? (
                <div className="page__empty-state">
                  <div className="page__empty-state-text">Loading tasks…</div>
                </div>
              ) : filteredTodos.length === 0 ? (
                <div className="page__empty-state">
                  <div className="page__empty-state-icon">{filter === 'done' ? '✓' : '🌿'}</div>
                  <div className="page__empty-state-text">
                    {filter === 'done' ? 'No completed tasks yet' : 'All clear — add a task below'}
                  </div>
                </div>
              ) : (
                filteredTodos.map((t: Todo) => (
                  <TodoItem
                    key={t.id}
                    todo={t}
                    onToggle={() => toggleTodo(t.id)}
                    onDelete={() => removeTodo(t.id)}
                    onUpdate={(text) => editTodo(t.id, text)}
                    onUpdateTime={(s, e) => updateTodoTime(t.id, s, e)}
                    onCalendarSync={(eventId) => setCalendarEventId(t.id, eventId)}
                    minTime={timeMin}
                    maxTime={timeMax}
                    wrapsMidnight={isIsha}
                    contextLabel={timeContextLabel}
                    selectedDate={selectedDate}
                  />
                ))
              )}
            </div>

            {/* ── Add task area ── */}
            <div className="page__add-row">
              {/* Sign-in hint — only shown in anonymous mode (Firebase not configured) */}
              {!configured && (
                <div className="page__add-hint">
                  Running in local mode — tasks are not synced.
                </div>
              )}

              <div className="page__add-inner">
                <span className="page__add-icon">+</span>
                <input
                  ref={addRef}
                  type="text"
                  value={addText}
                  onChange={(e) => setAddText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                  placeholder="Add a new task for this prayer…"
                  className="page__add-input"
                />
                {addText && (
                  <button type="button" onClick={handleAdd} className="page__add-btn">
                    Add
                  </button>
                )}
              </div>

              {/* Time range picker — Google Calendar style */}
              <div className="page__add-time-row">
                <TimeRangePicker
                  startTime={addStart}
                  endTime={addEnd}
                  onChange={(s, e) => { setAddStart(s); setAddEnd(e); }}
                  minTime={timeMin}
                  maxTime={timeMax}
                  wrapsMidnight={isIsha}
                  contextLabel={timeContextLabel}
                />
              </div>
            </div>

            <div className="page__day-progress">
              <span className="page__day-progress-label">
                {isToday(selectedDate) ? 'Day progress' : `${formatDateLabel(selectedDate)} progress`}
              </span>
              <div className="page__day-progress-track">
                <div className="page__day-progress-fill" style={{ width: `${dayPct}%` }} />
              </div>
              <span className="page__day-progress-value">{dayPct}%</span>
            </div>
          </div>
        </div>
      </div>

      {showLocationModal && <LocationModal onConfirm={handleLocationConfirm} />}
    </main>
  );
}

export default Home;
