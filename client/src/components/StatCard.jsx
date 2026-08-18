import React from "react";

export default function StatCard({ label, value, tone = "default", hint }) {
  const toneClass =
    {
      default: "text-ink-primary dark:text-ink-primary-dark",
      good: "text-good",
      critical: "text-critical",
    }[tone] || "text-ink-primary dark:text-ink-primary-dark";

  return (
    <div className="rounded-xl border border-line-hairline dark:border-line-hairline-dark bg-surface dark:bg-surface-dark p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">{label}</p>
      <p className={`mt-1.5 text-2xl font-semibold ${toneClass}`} style={{ fontVariantNumeric: "tabular-nums" }}>
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-ink-secondary dark:text-ink-secondary-dark">{hint}</p>}
    </div>
  );
}
