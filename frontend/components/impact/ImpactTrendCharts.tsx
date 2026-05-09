"use client";

import { t } from "@/lib/i18n";

export type ImpactHistorySnapshot = {
  snapshot_type: string;
  period_start: string | null;
  period_end: string | null;
  created_at: string | null;
  metrics: Record<string, number>;
};

const CHART_W = 560;
const CHART_H = 132;
const PAD = 20;

const PALETTE = ["#60a5fa", "#34d399", "#fbbf24", "#fb7185", "#a78bfa"];

export function chronologicalSnapshots(snaps: ImpactHistorySnapshot[]): ImpactHistorySnapshot[] {
  return [...snaps].sort((a, b) => {
    const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
    const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
    return ta - tb;
  });
}

function chartGeometry(
  values: number[],
  width: number,
  height: number,
  pad: number,
): {
  pointsStr: string;
  coords: { x: number; y: number }[];
  min: number;
  max: number;
} {
  const n = values.length;
  const coords: { x: number; y: number }[] = [];
  if (n === 0) {
    return { pointsStr: "", coords, min: 0, max: 0 };
  }
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    const d = Math.abs(min) < 1e-9 ? 1 : Math.abs(min) * 0.02;
    min -= d;
    max += d;
  }
  const innerW = width - 2 * pad;
  const innerH = height - 2 * pad;
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const x = pad + t * innerW;
    const v = values[i];
    const yn = (v - min) / (max - min);
    const y = height - pad - yn * innerH;
    coords.push({ x, y });
  }
  const pointsStr = coords.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
  return { pointsStr, coords, min, max };
}

function MetricTrendChart({
  metric,
  label,
  snapshots,
  formatValue,
  color,
}: {
  metric: string;
  label: string;
  snapshots: ImpactHistorySnapshot[];
  formatValue: (metric: string, value: number) => string;
  color: string;
}) {
  const values = snapshots.map((s) => s.metrics[metric] ?? 0);
  const { pointsStr, coords, min, max } = chartGeometry(values, CHART_W, CHART_H, PAD);
  const first = snapshots[0]?.created_at;
  const last = snapshots[snapshots.length - 1]?.created_at;
  const aria = `${label}. ${t("impact.trendsScale")}: ${formatValue(metric, min)} — ${formatValue(metric, max)}`;

  return (
    <div style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: "0.9rem", fontWeight: 600 }}>{label}</span>
      <svg
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        role="img"
        aria-label={aria}
        style={{ width: "100%", height: "auto", maxHeight: 160, display: "block" }}
      >
        <title>{aria}</title>
        <rect
          x={0}
          y={0}
          width={CHART_W}
          height={CHART_H}
          fill="color-mix(in srgb, var(--panel-soft) 70%, transparent)"
          rx={6}
        />
        <line
          x1={PAD}
          y1={CHART_H / 2}
          x2={CHART_W - PAD}
          y2={CHART_H / 2}
          stroke="color-mix(in srgb, var(--border) 65%, transparent)"
          strokeWidth={1}
        />
        {coords.length > 1 ? (
          <polyline
            fill="none"
            stroke={color}
            strokeWidth={2.25}
            strokeLinejoin="round"
            strokeLinecap="round"
            points={pointsStr}
          />
        ) : null}
        {coords.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={coords.length === 1 ? 5 : 3.5} fill={color} stroke="var(--bg)" strokeWidth={1} />
        ))}
      </svg>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          flexWrap: "wrap",
          gap: 8,
          fontSize: "0.75rem",
        }}
        className="muted"
      >
        <span>
          {t("impact.trendsScale")}: {formatValue(metric, min)} — {formatValue(metric, max)}
        </span>
        <span>
          {first && last
            ? `${new Date(first).toLocaleDateString()} — ${new Date(last).toLocaleDateString()}`
            : "—"}
        </span>
      </div>
    </div>
  );
}

export function ImpactTrendCharts({
  snapshots,
  metricKeys,
  metricLabel,
  formatValue,
}: {
  snapshots: ImpactHistorySnapshot[];
  metricKeys: readonly string[];
  metricLabel: (metric: string) => string;
  formatValue: (metric: string, value: number) => string;
}) {
  const chrono = chronologicalSnapshots(snapshots);
  if (chrono.length === 0) return null;

  return (
    <div className="card" style={{ display: "grid", gap: 16 }}>
      <div>
        <strong>{t("impact.trendsTitle")}</strong>
        <p className="muted" style={{ margin: "6px 0 0" }}>
          {chrono.length < 2 ? t("impact.trendsHintShort") : t("impact.trendsHint")}
        </p>
      </div>
      <div style={{ display: "grid", gap: 22 }}>
        {metricKeys.map((m, i) => (
          <MetricTrendChart
            key={m}
            metric={m}
            label={metricLabel(m)}
            snapshots={chrono}
            formatValue={formatValue}
            color={PALETTE[i % PALETTE.length]}
          />
        ))}
      </div>
    </div>
  );
}
