import React from "react";
import type { Athkar } from "../lib/types";
import "./AthkarCard.css";

type AthkarCardProps = { athkar: Athkar };

export function AthkarCard({ athkar }: AthkarCardProps) {
  return (
    <div className="athkar-card">
      <div className="athkar-card__top-line" />
      <div className="athkar-card__deco">✦ &nbsp; ✦ &nbsp; ✦</div>
      <div className="athkar-card__arabic">
        {athkar.arabic.map((line, i) => (
          <span key={i}>
            {line}
            {i < athkar.arabic.length - 1 && <br />}
          </span>
        ))}
      </div>
      <div className="athkar-card__divider" />
      <div className="athkar-card__transliteration">{athkar.transliteration}</div>
      <div className="athkar-card__meaning">{athkar.meaning}</div>
      <div className="athkar-card__source-wrap">
        <span className="athkar-card__source">{athkar.source}</span>
      </div>
    </div>
  );
}
