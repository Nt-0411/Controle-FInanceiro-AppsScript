import React, { useMemo } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { categoricalColor, useIsDark } from "../../lib/palette.js";
import { formatCurrency } from "../../lib/format.js";

const MAX_SLICES = 7;

export default function CategoryDonutChart({ data }) {
  const isDark = useIsDark();

  const slices = useMemo(() => {
    if (!data?.length) return [];
    const sorted = [...data].sort((a, b) => b.total - a.total);
    if (sorted.length <= MAX_SLICES + 1) return sorted;
    const head = sorted.slice(0, MAX_SLICES);
    const rest = sorted.slice(MAX_SLICES);
    const otherTotal = rest.reduce((sum, d) => sum + d.total, 0);
    return [...head, { category: "Outras categorias", total: otherTotal }];
  }, [data]);

  if (!slices.length) {
    return <EmptyState />;
  }

  return (
    <div>
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie
            data={slices}
            dataKey="total"
            nameKey="category"
            innerRadius="58%"
            outerRadius="90%"
            paddingAngle={2}
            stroke={isDark ? "#1a1a19" : "#fcfcfb"}
            strokeWidth={2}
          >
            {slices.map((entry, index) => (
              <Cell
                key={entry.category}
                fill={index === MAX_SLICES ? (isDark ? "#898781" : "#898781") : categoricalColor(index, isDark)}
              />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) => formatCurrency(value)}
            contentStyle={{
              background: isDark ? "#1a1a19" : "#fcfcfb",
              border: `1px solid ${isDark ? "#2c2c2a" : "#e1e0d9"}`,
              borderRadius: 8,
              fontSize: 13,
              color: isDark ? "#ffffff" : "#0b0b0b",
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <ul className="mt-1 flex flex-col gap-1.5">
        {slices.map((entry, index) => (
          <li key={entry.category} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2 text-ink-secondary dark:text-ink-secondary-dark">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: index === MAX_SLICES ? "#898781" : categoricalColor(index, isDark) }}
              />
              <span className="truncate">{entry.category}</span>
            </span>
            <span className="shrink-0 font-medium text-ink-primary dark:text-ink-primary-dark" style={{ fontVariantNumeric: "tabular-nums" }}>
              {formatCurrency(entry.total)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex h-48 items-center justify-center text-sm text-ink-muted">
      Nenhum gasto registrado neste mês.
    </div>
  );
}
