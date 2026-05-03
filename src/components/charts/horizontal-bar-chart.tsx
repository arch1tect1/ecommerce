"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface DataPoint {
  label: string;
  value: number;
}

export function HorizontalBarChart({
  data,
  color = "#2563eb",
  height = 280,
}: {
  data: DataPoint[];
  color?: string;
  height?: number;
}) {
  if (data.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
        No data yet.
      </div>
    );
  }

  const truncated = data.map((d) => ({
    ...d,
    short: d.label.length > 24 ? d.label.slice(0, 24) + "…" : d.label,
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={truncated}
        layout="vertical"
        margin={{ top: 4, right: 12, left: 0, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="short"
          tick={{ fontSize: 11 }}
          width={150}
          interval={0}
        />
        <Tooltip
          contentStyle={{ fontSize: 12 }}
          formatter={(value: number) => [value, "Count"]}
          labelFormatter={(_label, payload) => {
            const d = payload?.[0]?.payload as DataPoint | undefined;
            return d?.label ?? "";
          }}
        />
        <Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
