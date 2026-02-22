import React from "react";
import type { Prayer } from "../lib/types";
import "./PrayerCard.css";

type PrayerCardProps = {
  prayer: Prayer;
  doneCount: number;
  totalCount: number;
  isSelected: boolean;
  isNow: boolean;
  onClick: () => void;
};

export function PrayerCard({
  prayer,
  doneCount,
  totalCount,
  isSelected,
  isNow,
  onClick,
}: PrayerCardProps) {
  const pct = totalCount ? (doneCount / totalCount) * 100 : 0;

  return (
    <div
      onClick={onClick}
      className={`prayer-card ${isSelected ? "prayer-card--selected" : ""}`}
    >
      <div className="prayer-card__glow" />
      {isNow && <div className="prayer-card__now-dot" />}
      <div className="prayer-card__inner">
        <div className="prayer-card__icon">{prayer.icon}</div>
        <div className="prayer-card__name">{prayer.name}</div>
        <div className="prayer-card__arabic">{prayer.arabic}</div>
        <div className="prayer-card__time">{prayer.time}</div>
      </div>
      <div className="prayer-card__progress-track">
        <div
          className="prayer-card__progress-fill"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
