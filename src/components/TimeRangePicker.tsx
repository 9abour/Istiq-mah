import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import "./TimeRangePicker.css";

// 24px per 15-min slot  →  96px per hour (compact Google Calendar day-view feel)
const SLOT_H = 24;

const ALL_SLOTS = Array.from({ length: 96 }, (_, i) => {
  const mins = i * 15;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const value = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  const period = h < 12 ? "AM" : "PM";
  const hour12 = h % 12 || 12;
  const display = `${hour12}:${String(m).padStart(2, "0")} ${period}`;
  // Label shown in the left-margin ruler: "9 AM" on the hour, "9:30" on the half
  const rulerLabel = m === 0 ? `${hour12} ${period}` : m === 30 ? `${hour12}:30` : null;
  return { value, h, m, display, rulerLabel };
});

function toMins(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function calcDuration(start: string, end: string): string {
  let diff = toMins(end) - toMins(start);
  if (diff < 0) diff += 24 * 60;
  if (diff <= 0) return "";
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} hr`;
  return `${h} hr ${m} min`;
}

export interface TimeRangePickerProps {
  startTime: string | undefined;
  endTime: string | undefined;
  onChange: (start: string | undefined, end: string | undefined) => void;
  minTime?: string;
  maxTime?: string;
  wrapsMidnight?: boolean;
  contextLabel?: string;
}

type DragMode = "new" | "res-start" | "res-end";
type DragState = { mode: DragMode; anchor: number };

export function TimeRangePicker({
  startTime,
  endTime,
  onChange,
  minTime,
  maxTime,
  wrapsMidnight = false,
  contextLabel,
}: TimeRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [liveIdx, setLiveIdx] = useState<number | null>(null);

  // ── Build filtered, ordered slot list for this prayer window ──────────────
  const slots = useMemo(() => {
    if (!minTime) return ALL_SLOTS;
    if (wrapsMidnight && maxTime) {
      return [
        ...ALL_SLOTS.filter((s) => s.value >= minTime),
        ...ALL_SLOTS.filter((s) => s.value <= maxTime),
      ];
    }
    return ALL_SLOTS.filter(
      (s) => s.value >= minTime && (!maxTime || s.value <= maxTime)
    );
  }, [minTime, maxTime, wrapsMidnight]);

  const idxOf = useCallback(
    (val: string | undefined): number => {
      if (!val) return -1;
      return slots.findIndex((s) => s.value === val);
    },
    [slots]
  );

  // ── Derived display indices (live-update during drag) ─────────────────────
  const { dispSi, dispEi } = useMemo(() => {
    const si = idxOf(startTime);
    const ei = idxOf(endTime);
    if (!drag || liveIdx === null) return { dispSi: si, dispEi: ei };
    if (drag.mode === "new") {
      return {
        dispSi: Math.min(drag.anchor, liveIdx),
        dispEi: Math.max(drag.anchor, liveIdx),
      };
    }
    if (drag.mode === "res-start") {
      return {
        dispSi: Math.max(0, Math.min(liveIdx, drag.anchor - 1)),
        dispEi: drag.anchor,
      };
    }
    // res-end
    return {
      dispSi: drag.anchor,
      dispEi: Math.min(slots.length - 1, Math.max(liveIdx, drag.anchor + 1)),
    };
  }, [drag, liveIdx, startTime, endTime, idxOf, slots.length]);

  const hasTime = Boolean(startTime && endTime && idxOf(startTime) >= 0);
  const duration = startTime && endTime ? calcDuration(startTime, endTime) : "";

  // ── Grid helpers ──────────────────────────────────────────────────────────
  const getSlotIdx = useCallback(
    (clientY: number): number => {
      if (!gridRef.current) return 0;
      const rect = gridRef.current.getBoundingClientRect();
      const y = Math.max(0, Math.min(clientY - rect.top, rect.height - 1));
      return Math.max(0, Math.min(Math.floor(y / SLOT_H), slots.length - 1));
    },
    [slots.length]
  );

  const commitDrag = useCallback(() => {
    if (!drag || liveIdx === null) {
      setDrag(null);
      return;
    }
    let si: number, ei: number;
    if (drag.mode === "new") {
      si = Math.min(drag.anchor, liveIdx);
      ei = Math.max(drag.anchor, liveIdx);
      if (si === ei) ei = Math.min(si + 4, slots.length - 1); // 1-hr default on click
    } else if (drag.mode === "res-start") {
      ei = drag.anchor;
      si = Math.max(0, Math.min(liveIdx, ei - 1));
    } else {
      si = drag.anchor;
      ei = Math.min(slots.length - 1, Math.max(liveIdx, si + 1));
    }
    if (si >= 0 && ei > si) onChange(slots[si].value, slots[ei].value);
    setDrag(null);
    setLiveIdx(null);
  }, [drag, liveIdx, slots, onChange]);

  // ── Global mouse-move / mouse-up while dragging ───────────────────────────
  useEffect(() => {
    if (!drag) return;
    const onMove = (e: MouseEvent) => {
      e.preventDefault();
      setLiveIdx(getSlotIdx(e.clientY));
    };
    const onUp = () => commitDrag();
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [drag, getSlotIdx, commitDrag]);

  // ── Escape to close ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen]);

  // ── Scroll timeline to show selection when modal opens ────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      if (!timelineRef.current) return;
      const idx = idxOf(startTime);
      const target = Math.max(0, (idx >= 0 ? idx : 0) * SLOT_H - 80);
      timelineRef.current.scrollTop = target;
    }, 60);
    return () => clearTimeout(timer);
  }, [isOpen, idxOf, startTime]);

  // ── Block geometry ────────────────────────────────────────────────────────
  const blockTop = dispSi >= 0 ? dispSi * SLOT_H : null;
  const blockHeight =
    dispSi >= 0 && dispEi > dispSi ? (dispEi - dispSi) * SLOT_H : null;

  // ── Open modal (seed a default selection if none) ─────────────────────────
  const openModal = () => {
    if (!startTime || idxOf(startTime) < 0) {
      const s = 0;
      const e = Math.min(4, slots.length - 1);
      if (slots[s] && slots[e]) onChange(slots[s].value, slots[e].value);
    }
    setIsOpen(true);
  };

  const handleGridMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const idx = getSlotIdx(e.clientY);
    setDrag({ mode: "new", anchor: idx });
    setLiveIdx(idx);
  };

  const startResizeTop = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (dispEi < 0) return;
    setDrag({ mode: "res-start", anchor: dispEi });
    setLiveIdx(dispSi >= 0 ? dispSi : 0);
  };

  const startResizeBottom = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (dispSi < 0) return;
    setDrag({ mode: "res-end", anchor: dispSi });
    setLiveIdx(dispEi >= 0 ? dispEi : 0);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="trp">

      {/* ── Trigger button ── */}
      <button
        type="button"
        className={`trp__trigger ${hasTime ? "trp__trigger--set" : ""}`}
        onClick={openModal}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="trp__clock-icon">
          <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.3" />
          <path
            d="M7 4.2v2.8l1.8 1.4"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {hasTime ? (
          <span className="trp__trigger-time">
            {slots.find((s) => s.value === startTime)?.display ?? startTime}
            <span className="trp__trigger-dash"> – </span>
            {slots.find((s) => s.value === endTime)?.display ?? endTime}
            {duration && <span className="trp__trigger-dur"> · {duration}</span>}
          </span>
        ) : (
          <span className="trp__trigger-placeholder">Add time</span>
        )}
      </button>

      {/* ── Modal ── */}
      {isOpen && (
        <div
          className="trp-modal__overlay"
          onMouseDown={(e) => {
            if (!drag && e.target === e.currentTarget) setIsOpen(false);
          }}
        >
          <div className="trp-modal" onMouseDown={(e) => e.stopPropagation()}>

            {/* Header */}
            <div className="trp-modal__head">
              <div className="trp-modal__head-left">
                <span className="trp-modal__title">Set task time</span>
                {contextLabel && (
                  <span className="trp-modal__ctx">{contextLabel}</span>
                )}
              </div>
              <button
                type="button"
                className="trp-modal__close"
                onClick={() => setIsOpen(false)}
              >
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <path
                    d="M1.5 1.5L11.5 11.5M11.5 1.5L1.5 11.5"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            {/* Summary bar (Google Calendar-style start → end chips) */}
            <div className="trp-modal__summary">
              <div className={`trp-modal__chip${!hasTime ? " trp-modal__chip--empty" : ""}`}>
                <span className="trp-modal__chip-lbl">Start</span>
                <span className="trp-modal__chip-val">
                  {startTime && idxOf(startTime) >= 0
                    ? slots[idxOf(startTime)].display
                    : "—"}
                </span>
              </div>
              <div className="trp-modal__sum-arrow">
                <svg width="16" height="8" viewBox="0 0 16 8" fill="none">
                  <path
                    d="M0 4H14M10 1L14 4L10 7"
                    stroke="currentColor"
                    strokeWidth="1.3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <div className={`trp-modal__chip${!hasTime ? " trp-modal__chip--empty" : ""}`}>
                <span className="trp-modal__chip-lbl">End</span>
                <span className="trp-modal__chip-val">
                  {endTime && idxOf(endTime) >= 0
                    ? slots[idxOf(endTime)].display
                    : "—"}
                </span>
              </div>
              {duration && (
                <div className="trp-modal__sum-dur">{duration}</div>
              )}
            </div>

            {/* Hint */}
            <div className="trp-modal__hint">
              Drag on the grid to set range · drag edges to resize
            </div>

            {/* Timeline grid */}
            <div className="trp-modal__timeline" ref={timelineRef}>
              {/* Time ruler (left) */}
              <div className="trp-modal__ruler" aria-hidden="true">
                {slots.map((slot, i) => {
                  const isMidnight =
                    wrapsMidnight && i > 0 && slot.value < slots[i - 1].value;
                  const label = isMidnight ? "12 AM" : slot.rulerLabel;
                  return (
                    <div
                      key={`r${i}`}
                      className="trp-modal__ruler-row"
                      style={{ height: SLOT_H }}
                    >
                      {label && (
                        <span
                          className={`trp-modal__ruler-lbl${
                            slot.m === 0 || isMidnight
                              ? " trp-modal__ruler-lbl--hour"
                              : " trp-modal__ruler-lbl--half"
                          }`}
                        >
                          {label}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Draggable grid */}
              <div
                ref={gridRef}
                className="trp-modal__grid"
                style={{ height: slots.length * SLOT_H }}
                onMouseDown={handleGridMouseDown}
              >
                {/* Grid row dividers */}
                {slots.map((slot, i) => {
                  const isMidnight =
                    wrapsMidnight && i > 0 && slot.value < slots[i - 1].value;
                  let cls = "trp-modal__row";
                  if (isMidnight) cls += " trp-modal__row--midnight";
                  else if (slot.m === 0) cls += " trp-modal__row--hour";
                  else if (slot.m === 30) cls += " trp-modal__row--half";
                  return (
                    <div
                      key={`g${i}`}
                      className={cls}
                      style={{ height: SLOT_H }}
                    />
                  );
                })}

                {/* ── Selection block ── */}
                {blockTop !== null && blockHeight !== null && blockHeight > 0 && (
                  <div
                    className={`trp-modal__block${drag ? " trp-modal__block--dragging" : ""}`}
                    style={{ top: blockTop, height: blockHeight }}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    {/* Top resize handle */}
                    <div
                      className="trp-modal__handle trp-modal__handle--top"
                      onMouseDown={startResizeTop}
                    />

                    {/* Block label content */}
                    <div className="trp-modal__block-body">
                      {blockHeight >= SLOT_H && dispSi >= 0 && (
                        <span className="trp-modal__block-start">
                          {slots[dispSi].display}
                        </span>
                      )}
                      {blockHeight >= SLOT_H * 2 && dispSi >= 0 && dispEi > dispSi && (
                        <span className="trp-modal__block-dur">
                          {calcDuration(slots[dispSi].value, slots[dispEi].value)}
                        </span>
                      )}
                      {blockHeight >= SLOT_H * 3 && dispEi >= 0 && (
                        <span className="trp-modal__block-end">
                          {slots[dispEi].display}
                        </span>
                      )}
                    </div>

                    {/* Bottom resize handle */}
                    <div
                      className="trp-modal__handle trp-modal__handle--bottom"
                      onMouseDown={startResizeBottom}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="trp-modal__footer">
              {hasTime && (
                <button
                  type="button"
                  className="trp-modal__clear"
                  onClick={() => {
                    onChange(undefined, undefined);
                    setIsOpen(false);
                  }}
                >
                  Remove time
                </button>
              )}
              <div className="trp-modal__footer-btns">
                <button
                  type="button"
                  className="trp-modal__cancel"
                  onClick={() => setIsOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="trp-modal__confirm"
                  onClick={() => setIsOpen(false)}
                >
                  Confirm
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
