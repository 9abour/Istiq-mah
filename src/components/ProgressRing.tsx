import React from "react";
import "./ProgressRing.css";

type ProgressRingProps = { done: number; total: number };

export function ProgressRing({ done, total }: ProgressRingProps) {
  const r = 38;
  const circ = 2 * Math.PI * r;
  const pct = total ? done / total : 0;

  return (
    <div className="progress-ring">
      <svg width="90" height="90" viewBox="0 0 90 90">
        <defs>
          <linearGradient id="rg" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#C9A84C" />
            <stop offset="100%" stopColor="#e8c96a" />
          </linearGradient>
        </defs>
        <circle className="progress-ring__track" cx="45" cy="45" r={r} />
        <circle
          className="progress-ring__fill"
          cx="45"
          cy="45"
          r={r}
          strokeDasharray={`${circ * pct} ${circ}`}
        />
      </svg>
      <div className="progress-ring__content">
        <span className="progress-ring__value">{total ? `${done}/${total}` : "—"}</span>
        <span className="progress-ring__label">tasks</span>
      </div>
    </div>
  );
}
