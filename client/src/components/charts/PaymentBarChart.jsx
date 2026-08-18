import React from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell, ResponsiveContainer } from "recharts";
import { categoricalColor, useIsDark } from "../../lib/palette.js";
import { formatCurrency } from "../../lib/format.js";

export default function PaymentBarChart({ data }) {
  const isDark = useIsDark();

  if (!data?.length) {
    return <div className="flex h-48 items-center justify-center text-sm text-ink-muted">Nenhum gasto registrado neste mês.</div>;
  }

  const sorted = [...data].sort((a, b) => b.total - a.total);

  return (
    <ResponsiveContainer width="100%" height={Math.max(180, sorted.length * 40)}>
      <BarChart data={sorted} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
        <CartesianGrid horizontal={false} stroke={isDark ? "#2c2c2a" : "#e1e0d9"} />
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="method"
          width={110}
          tickLine={false}
          axisLine={false}
          tick={{ fill: isDark ? "#c3c2b7" : "#52514e", fontSize: 13 }}
        />
        <Tooltip
          cursor={{ fill: isDark ? "#ffffff0d" : "#0000000d" }}
          formatter={(value) => formatCurrency(value)}
          contentStyle={{
            background: isDark ? "#1a1a19" : "#fcfcfb",
            border: `1px solid ${isDark ? "#2c2c2a" : "#e1e0d9"}`,
            borderRadius: 8,
            fontSize: 13,
            color: isDark ? "#ffffff" : "#0b0b0b",
          }}
        />
        <Bar dataKey="total" radius={[0, 4, 4, 0]} maxBarSize={22}>
          {sorted.map((entry, index) => (
            <Cell key={entry.method} fill={categoricalColor(index, isDark)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
