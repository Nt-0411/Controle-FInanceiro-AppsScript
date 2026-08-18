import React from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";
import { useIsDark } from "../../lib/palette.js";
import { formatCurrency } from "../../lib/format.js";

export default function TrendLineChart({ data }) {
  const isDark = useIsDark();
  const brand = isDark ? "#3987e5" : "#2a78d6";

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={brand} stopOpacity={0.25} />
            <stop offset="100%" stopColor={brand} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={isDark ? "#2c2c2a" : "#e1e0d9"} />
        <XAxis
          dataKey="label"
          tickFormatter={(v) => v.split(" de ")[0].slice(0, 3)}
          tickLine={false}
          axisLine={{ stroke: isDark ? "#383835" : "#c3c2b7" }}
          tick={{ fill: isDark ? "#c3c2b7" : "#52514e", fontSize: 12 }}
        />
        <YAxis hide />
        <Tooltip
          formatter={(value) => formatCurrency(value)}
          labelStyle={{ color: isDark ? "#c3c2b7" : "#52514e" }}
          contentStyle={{
            background: isDark ? "#1a1a19" : "#fcfcfb",
            border: `1px solid ${isDark ? "#2c2c2a" : "#e1e0d9"}`,
            borderRadius: 8,
            fontSize: 13,
            color: isDark ? "#ffffff" : "#0b0b0b",
          }}
        />
        <Area type="monotone" dataKey="total" stroke={brand} strokeWidth={2} fill="url(#trendFill)" dot={{ r: 3, fill: brand, strokeWidth: 0 }} activeDot={{ r: 5 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
