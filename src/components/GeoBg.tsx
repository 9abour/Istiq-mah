import React from "react";
import "./GeoBg.css";

export function GeoBg() {
  return (
    <svg className="geo-bg">
      <defs>
        <pattern id="geo" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
          <polygon points="40,4 76,22 76,58 40,76 4,58 4,22" fill="none" stroke="#C9A84C" strokeWidth="0.8" />
          <polygon points="40,16 64,28 64,52 40,64 16,52 16,28" fill="none" stroke="#C9A84C" strokeWidth="0.5" />
          <circle cx="40" cy="40" r="5" fill="none" stroke="#C9A84C" strokeWidth="0.4" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#geo)" />
    </svg>
  );
}
