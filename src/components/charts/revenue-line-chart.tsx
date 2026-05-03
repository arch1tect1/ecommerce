"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface DataPoint {
  date: string; // YYYY-MM-DD
  revenue: number;
  orders: number;
}

export function RevenueLineChart({ data }: { data: DataPoint[] }) {
  // Compact x-axis labels: "MM-DD"
  const formatted = data.map((d) => ({ ...d, label: d.date.slice(5) }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={formatted} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 11 }} width={60} tickFormatter={(v) => `${v}`} />
        <Tooltip
          contentStyle={{ fontSize: 12 }}
          formatter={(value: number, name: string) => {
            if (name === "revenue") return [`${value.toFixed(2)}`, "Revenue"];
            if (name === "orders") return [value, "Orders"];
            return [value, name];
          }}
          labelFormatter={(label, payload) => {
            const d = payload?.[0]?.payload as DataPoint | undefined;
            return d?.date ?? label;
          }}
        />
        <Line
          type="monotone"
          dataKey="revenue"
          stroke="#2563eb"
          strokeWidth={2}
          dot={{ r: 2 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
