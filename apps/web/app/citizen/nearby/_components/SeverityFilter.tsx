"use client";

import { getSeverityConfig } from "./useNearbyTickets";

interface SeveritySliderProps {
  maxLevel: number;
  onChange: (maxLevel: number) => void;
}

const LEVELS: Array<{ level: number; key: "L1" | "L2" | "L3" | "L4" }> = [
  { level: 1, key: "L1" },
  { level: 2, key: "L2" },
  { level: 3, key: "L3" },
  { level: 4, key: "L4" },
];

export default function SeverityFilter({ maxLevel, onChange }: SeveritySliderProps) {
  return (
    <div className="flex min-w-0 max-w-full flex-col gap-2 overflow-x-hidden px-3 py-3
      bg-white dark:bg-[#1e1e1e]
      border-b border-gray-200 dark:border-[#2a2a2a]">

      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
          Show severity up to
        </span>
        <span
          className="text-[11px] font-bold px-2 py-0.5 rounded-full"
          style={{
            background: getSeverityConfig(`L${maxLevel}`).color + "22",
            color: getSeverityConfig(`L${maxLevel}`).color,
          }}
        >
          {maxLevel === 4 ? "All levels" : getSeverityConfig(`L${maxLevel}`).label}
        </span>
      </div>

      {/* Big pill buttons */}
      <div className="grid min-w-0 max-w-full grid-cols-4 gap-1.5">
        {LEVELS.map(({ level, key }) => {
          const sev = getSeverityConfig(key);
          const isActive = level <= maxLevel;
          const isMax = level === maxLevel;
          return (
            <button
              key={level}
              onClick={() => onChange(level)}
              className="flex min-w-0 flex-col items-center gap-1 rounded-xl px-1 py-2.5
                transition-all duration-150 active:scale-95 border"
              style={{
                background: isActive ? sev.color + "18" : "transparent",
                borderColor: isMax ? sev.color : isActive ? sev.color + "44" : "transparent",
                borderWidth: isMax ? "2px" : "1.5px",
              }}
            >
              {/* Dot */}
              <div
                className="w-3 h-3 rounded-full transition-all duration-150"
                style={{
                  background: isActive ? sev.color : "#d1d5db",
                  boxShadow: isMax ? `0 0 6px ${sev.color}88` : "none",
                }}
              />
              <span
                className="text-[10px] font-semibold leading-none"
                style={{ color: isActive ? sev.color : "#9ca3af" }}
              >
                {sev.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Visual range bar */}
      <div className="flex h-1.5 rounded-full overflow-hidden gap-0.5">
        {LEVELS.map(({ level, key }) => {
          const sev = getSeverityConfig(key);
          return (
            <div
              key={level}
              className="flex-1 rounded-full transition-all duration-200"
              style={{ background: level <= maxLevel ? sev.color : "#e5e7eb" }}
            />
          );
        })}
      </div>
    </div>
  );
}
