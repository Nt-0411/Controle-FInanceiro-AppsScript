import React from "react";
import { useMonth } from "../lib/MonthContext.jsx";
import { MONTH_NAMES_PT } from "../lib/format.js";

export default function MonthSwitcher() {
  const { month, year, setMonth, setYear } = useMonth();

  function shift(delta) {
    let m = month + delta;
    let y = year;
    if (m < 1) {
      m = 12;
      y -= 1;
    } else if (m > 12) {
      m = 1;
      y += 1;
    }
    setMonth(m);
    setYear(y);
  }

  return (
    <div className="flex items-center gap-1 rounded-lg border border-line-hairline dark:border-line-hairline-dark bg-surface dark:bg-surface-dark px-1 py-1">
      <button
        onClick={() => shift(-1)}
        aria-label="Mês anterior"
        className="rounded-md px-2 py-1.5 text-ink-secondary dark:text-ink-secondary-dark hover:bg-surface-page dark:hover:bg-white/5"
      >
        ‹
      </button>
      <span className="min-w-[9.5rem] text-center text-sm font-medium text-ink-primary dark:text-ink-primary-dark">
        {MONTH_NAMES_PT[month - 1]} de {year}
      </span>
      <button
        onClick={() => shift(1)}
        aria-label="Próximo mês"
        className="rounded-md px-2 py-1.5 text-ink-secondary dark:text-ink-secondary-dark hover:bg-surface-page dark:hover:bg-white/5"
      >
        ›
      </button>
    </div>
  );
}
