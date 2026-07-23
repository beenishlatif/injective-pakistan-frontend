/**
 * Dashboard.jsx
 * ------------------------------------------------------------------
 * Live Injective network dashboard.
 *
 * Sections:
 *   1. Header (title + live status pill + last-updated time)
 *   2. Live Stats grid (price / 24h change / staked / burned / volume / mcap)
 *   3. Chart panel — pick a metric (price, staked, burned, volume, mcap)
 *      and a range (1H / 24H / 7D / 30D), renders as an SVG area+line
 *      chart with a hover tooltip. No external chart library required,
 *      same "self-contained" philosophy as Home.jsx.
 *
 * Data sources (backend, MongoDB-backed, see stats.controller.js):
 *   GET /api/dashboard/stats    -> current snapshot (price/staked/burned/volume/mcap)
 *   GET /api/dashboard/history  -> time-series points for the chart
 *
 * Props:
 *   apiBaseUrl?: string — defaults to the live backend origin, same
 *   convention as Home.jsx (frontend + backend are on two different
 *   Vercel domains).
 * ------------------------------------------------------------------
 */

import { useState, useEffect, useCallback, useRef, useMemo } from "react";

// ---------------- API base URL (same convention as Home.jsx) ----------------
const DEFAULT_API_BASE_URL = "https://injective-pakistan-backend-2gbb.vercel.app";

// ---------------- Fallback / empty states ----------------
const FALLBACK_STATS = {
  injPriceUsd: null,
  injPriceChange24h: null,
  marketCapUsd: null,
  totalStakedInj: null,
  totalBurnedInj: null,
  helixVolume24hUsd: null,
};

const RANGES = [
  { key: "1h", label: "1H" },
  { key: "24h", label: "24H" },
  { key: "7d", label: "7D" },
  { key: "30d", label: "30D" },
];

const METRICS = [
  { key: "injPriceUsd", label: "Price", unit: "usd", color: "signal" },
  { key: "totalStakedInj", label: "Staked", unit: "inj", color: "amber" },
  { key: "totalBurnedInj", label: "Burned", unit: "inj", color: "danger" },
  { key: "helixVolume24hUsd", label: "Helix Volume", unit: "usd", color: "signal" },
  { key: "marketCapUsd", label: "Market Cap", unit: "usd", color: "amber" },
];

// ---------------- Formatting helpers (same scaling as Home.jsx) ----------------
function formatUsd(value) {
  if (value === null || value === undefined) return "—";
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

function formatInj(value) {
  if (value === null || value === undefined) return "—";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M INJ`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K INJ`;
  return `${value.toFixed(2)} INJ`;
}

function formatChange(value) {
  if (value === null || value === undefined) return null;
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function formatByUnit(value, unit) {
  return unit === "usd" ? formatUsd(value) : formatInj(value);
}

function formatAxisTime(dateStr, range) {
  const d = new Date(dateStr);
  if (range === "1h" || range === "24h") {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function Dashboard({ apiBaseUrl = DEFAULT_API_BASE_URL }) {
  const [stats, setStats] = useState(FALLBACK_STATS);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const [range, setRange] = useState("24h");
  const [metric, setMetric] = useState("injPriceUsd");
  const [points, setPoints] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState(false);

  const [mounted, setMounted] = useState(false);

  // ---------------- fetch current stats, poll every 30s ----------------
  const loadStats = useCallback(async () => {
    setStatsError(false);
    try {
      const res = await fetch(`${apiBaseUrl}/api/dashboard/stats`);
      if (!res.ok) {
        setStatsError(true);
        return;
      }
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
        setLastUpdated(new Date());
      } else {
        setStatsError(true);
      }
    } catch (err) {
      console.error("Failed to load dashboard stats:", err);
      setStatsError(true);
    } finally {
      setStatsLoading(false);
    }
  }, [apiBaseUrl]);

  // ---------------- fetch chart history whenever range/metric changes ----------------
  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError(false);
    try {
      const res = await fetch(
        `${apiBaseUrl}/api/dashboard/history?range=${range}&metric=${metric}`
      );
      if (!res.ok) {
        setHistoryError(true);
        setPoints([]);
        return;
      }
      const data = await res.json();
      if (data.success) {
        setPoints(data.points || []);
      } else {
        setHistoryError(true);
        setPoints([]);
      }
    } catch (err) {
      console.error("Failed to load stats history:", err);
      setHistoryError(true);
      setPoints([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [apiBaseUrl, range, metric]);

  useEffect(() => {
    setMounted(true);
    loadStats();
    const interval = setInterval(loadStats, 30_000); // live price refresh every 30s
    return () => clearInterval(interval);
  }, [loadStats]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const activeMetric = METRICS.find((m) => m.key === metric);

  return (
    <>
      <style>{STYLES}</style>

      <div className={`db-page ${mounted ? "db-mounted" : ""}`}>
        {/* ---------------- Header ---------------- */}
        <header className="db-header">
          <div>
            <span className="db-eyebrow">
              <span className="db-live-dot" />
              LIVE NETWORK DASHBOARD
            </span>
            <h1 className="db-title">Injective, in real time</h1>
            <p className="db-sub">
              Price, staking, burns, and volume — refreshed automatically. Pick a
              metric below to chart it over time.
            </p>
          </div>
          <div className="db-header-meta">
            {statsError && (
              <button className="db-retry" onClick={loadStats}>
                Retry
              </button>
            )}
            <span className="db-updated">
              {lastUpdated
                ? `Updated ${lastUpdated.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}`
                : "Loading…"}
            </span>
          </div>
        </header>

        {/* ---------------- Live stats grid ---------------- */}
        <section className="db-stats-grid">
          <StatCard
            label="INJ Price"
            value={statsLoading ? null : formatUsd(stats.injPriceUsd)}
            delta={statsLoading ? null : formatChange(stats.injPriceChange24h)}
            deltaPositive={stats.injPriceChange24h >= 0}
            loading={statsLoading}
            active={metric === "injPriceUsd"}
            onClick={() => setMetric("injPriceUsd")}
          />
          <StatCard
            label="Total Staked"
            value={statsLoading ? null : formatInj(stats.totalStakedInj)}
            sub="Bonded to validators"
            loading={statsLoading}
            active={metric === "totalStakedInj"}
            onClick={() => setMetric("totalStakedInj")}
          />
          <StatCard
            label="Total Burned"
            value={statsLoading ? null : formatInj(stats.totalBurnedInj)}
            sub="Weekly auction burns"
            loading={statsLoading}
            active={metric === "totalBurnedInj"}
            onClick={() => setMetric("totalBurnedInj")}
          />
          <StatCard
            label="Helix 24H Volume"
            value={statsLoading ? null : formatUsd(stats.helixVolume24hUsd)}
            sub="On-chain order book"
            loading={statsLoading}
            active={metric === "helixVolume24hUsd"}
            onClick={() => setMetric("helixVolume24hUsd")}
          />
          <StatCard
            label="Market Cap"
            value={statsLoading ? null : formatUsd(stats.marketCapUsd)}
            sub="Circulating supply × price"
            loading={statsLoading}
            active={metric === "marketCapUsd"}
            onClick={() => setMetric("marketCapUsd")}
          />
        </section>

        {/* ---------------- Chart panel ---------------- */}
        <section className="db-chart-panel">
          <div className="db-chart-controls">
            <div className="db-metric-tabs">
              {METRICS.map((m) => (
                <button
                  key={m.key}
                  className={`db-metric-tab ${metric === m.key ? "db-metric-tab-active" : ""}`}
                  onClick={() => setMetric(m.key)}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <div className="db-range-tabs">
              {RANGES.map((r) => (
                <button
                  key={r.key}
                  className={`db-range-tab ${range === r.key ? "db-range-tab-active" : ""}`}
                  onClick={() => setRange(r.key)}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <div className="db-chart-head">
            <span className="db-chart-metric-name">{activeMetric.label}</span>
            {historyError && (
              <button className="db-retry" onClick={loadHistory}>
                Retry
              </button>
            )}
          </div>

          <Chart
            points={points}
            loading={historyLoading}
            error={historyError}
            unit={activeMetric.unit}
            colorVar={activeMetric.color}
            range={range}
          />
        </section>
      </div>
    </>
  );
}

// ---------------- Stat card (also acts as a metric-select button) ----------------
function StatCard({ label, value, delta, deltaPositive, sub, loading, active, onClick }) {
  return (
    <button
      type="button"
      className={`db-stat-card ${active ? "db-stat-card-active" : ""}`}
      onClick={onClick}
    >
      <span className="db-stat-label">{label}</span>
      {loading ? (
        <span className="db-stat-skeleton" />
      ) : (
        <span className="db-stat-value">{value ?? "—"}</span>
      )}
      {delta && !loading && (
        <span className={`db-stat-delta ${deltaPositive ? "db-up" : "db-down"}`}>{delta}</span>
      )}
      {sub && !delta && !loading && <span className="db-stat-sub">{sub}</span>}
    </button>
  );
}

// ---------------- Chart (hand-rolled SVG line + area, no dependency) ----------------
function Chart({ points, loading, error, unit, colorVar, range }) {
  const svgRef = useRef(null);
  const [hoverIndex, setHoverIndex] = useState(null);

  const width = 900;
  const height = 320;
  const padding = { top: 20, right: 16, bottom: 32, left: 16 };

  const { path, areaPath, coords, minV, maxV } = useMemo(() => {
    if (!points || points.length < 2) {
      return { path: "", areaPath: "", coords: [], minV: 0, maxV: 0 };
    }
    const values = points.map((p) => p.v);
    const minV = Math.min(...values);
    const maxV = Math.max(...values);
    const span = maxV - minV || 1;

    const innerW = width - padding.left - padding.right;
    const innerH = height - padding.top - padding.bottom;

    const coords = points.map((p, i) => {
      const x = padding.left + (i / (points.length - 1)) * innerW;
      const y = padding.top + innerH - ((p.v - minV) / span) * innerH;
      return { x, y, t: p.t, v: p.v };
    });

    const path = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`).join(" ");
    const areaPath =
      path +
      ` L ${coords[coords.length - 1].x} ${height - padding.bottom}` +
      ` L ${coords[0].x} ${height - padding.bottom} Z`;

    return { path, areaPath, coords, minV, maxV };
  }, [points]);

  const handleMove = (e) => {
    if (!coords.length || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * width;
    let closest = 0;
    let closestDist = Infinity;
    coords.forEach((c, i) => {
      const d = Math.abs(c.x - relX);
      if (d < closestDist) {
        closestDist = d;
        closest = i;
      }
    });
    setHoverIndex(closest);
  };

  const strokeColor = `var(--nv-${colorVar})`;
  const gradientId = `db-grad-${colorVar}`;

  if (loading) {
    return (
      <div className="db-chart-empty">
        <span className="db-chart-skeleton" />
      </div>
    );
  }

  if (error) {
    return <div className="db-chart-empty db-chart-error">Couldn't load chart data.</div>;
  }

  if (!points || points.length < 2) {
    return (
      <div className="db-chart-empty">
        Not enough data yet for this range — check back once a few snapshots have
        been recorded.
      </div>
    );
  }

  const hovered = hoverIndex !== null ? coords[hoverIndex] : null;

  return (
    <div className="db-chart-wrap">
      <svg
        ref={svgRef}
        className="db-chart-svg"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverIndex(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.28" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* horizontal gridlines */}
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1={padding.left}
            x2={width - padding.right}
            y1={padding.top + f * (height - padding.top - padding.bottom)}
            y2={padding.top + f * (height - padding.top - padding.bottom)}
            className="db-chart-grid"
          />
        ))}

        <path d={areaPath} fill={`url(#${gradientId})`} stroke="none" />
        <path d={path} fill="none" stroke={strokeColor} strokeWidth="2.5" />

        {hovered && (
          <>
            <line
              x1={hovered.x}
              x2={hovered.x}
              y1={padding.top}
              y2={height - padding.bottom}
              className="db-chart-hover-line"
            />
            <circle cx={hovered.x} cy={hovered.y} r="4.5" fill={strokeColor} stroke="#0b0d10" strokeWidth="2" />
          </>
        )}
      </svg>

      <div className="db-chart-axis">
        <span>{formatAxisTime(coords[0].t, range)}</span>
        <span>{formatAxisTime(coords[coords.length - 1].t, range)}</span>
      </div>

      {hovered && (
        <div
          className="db-chart-tooltip"
          style={{ left: `${(hovered.x / width) * 100}%` }}
        >
          <span className="db-chart-tooltip-value">{formatByUnit(hovered.v, unit)}</span>
          <span className="db-chart-tooltip-time">{formatAxisTime(hovered.t, range)}</span>
        </div>
      )}

      <div className="db-chart-minmax">
        <span>Low: {formatByUnit(minV, unit)}</span>
        <span>High: {formatByUnit(maxV, unit)}</span>
      </div>
    </div>
  );
}

// ---------------- Self-contained styles (same design language as Home.jsx) ----------------
const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap');

.db-page {
  --nv-bg: #0b0d10;
  --nv-panel: #0d1013;
  --nv-hairline: #1d232b;
  --nv-hairline-soft: #171b21;
  --nv-text: #e7eaee;
  --nv-text-dim: #8992a1;
  --nv-text-faint: #545c67;
  --nv-signal: #47d6c4;
  --nv-signal-dim: rgba(71, 214, 196, 0.1);
  --nv-amber: #e8a33d;
  --nv-amber-dim: rgba(232, 163, 61, 0.08);
  --nv-danger: #e5645f;
  --nv-danger-dim: rgba(229, 100, 95, 0.1);
  --nv-font-display: "Space Grotesk", "Inter", sans-serif;
  --nv-font-body: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --nv-font-mono: "IBM Plex Mono", "SFMono-Regular", Consolas, monospace;

  background: var(--nv-bg);
  color: var(--nv-text);
  font-family: var(--nv-font-body);
  min-height: 100vh;
  width: 100%;
  overflow-x: hidden;
  padding: clamp(20px, 5vw, 48px) clamp(14px, 6vw, 64px) 64px;
  opacity: 0;
  transform: translateY(6px);
  transition: opacity 0.5s ease, transform 0.5s ease;
}
.db-page.db-mounted { opacity: 1; transform: translateY(0); }
.db-page * { box-sizing: border-box; }

.db-live-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--nv-signal);
  animation: db-live 1.8s infinite;
  flex-shrink: 0;
  display: inline-block;
}
@keyframes db-live { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }

/* ---------------- Header ---------------- */
.db-header {
  display: flex; align-items: flex-start; justify-content: space-between;
  gap: 20px; flex-wrap: wrap;
  margin-bottom: clamp(24px, 4vw, 36px);
}
.db-eyebrow {
  display: inline-flex; align-items: center; gap: 8px;
  font-family: var(--nv-font-mono); font-size: 11px; letter-spacing: 0.1em;
  color: var(--nv-signal);
  border: 1px solid var(--nv-hairline);
  background: var(--nv-signal-dim);
  padding: 7px 12px;
  border-radius: 999px;
  margin-bottom: 16px;
}
.db-title {
  font-family: var(--nv-font-display); font-weight: 700;
  font-size: clamp(24px, 3.4vw, 36px);
  letter-spacing: -0.01em;
  margin: 0 0 8px;
}
.db-sub { font-size: 14px; line-height: 1.6; color: var(--nv-text-dim); max-width: 480px; margin: 0; }
.db-header-meta { display: flex; align-items: center; gap: 10px; }
.db-updated { font-family: var(--nv-font-mono); font-size: 12px; color: var(--nv-text-faint); white-space: nowrap; }
.db-retry {
  font-family: var(--nv-font-mono); font-size: 11px;
  background: var(--nv-danger-dim); color: var(--nv-danger);
  border: 1px solid rgba(229, 100, 95, 0.3);
  padding: 6px 10px; border-radius: 6px; cursor: pointer;
}

/* ---------------- Stats grid ---------------- */
.db-stats-grid {
  display: grid; grid-template-columns: repeat(5, 1fr); gap: 1px;
  background: var(--nv-hairline); border: 1px solid var(--nv-hairline);
  border-radius: 10px; overflow: hidden;
  margin-bottom: clamp(24px, 4vw, 36px);
}
.db-stat-card {
  background: var(--nv-panel); border: none; cursor: pointer; text-align: left;
  padding: clamp(16px, 3vw, 20px); display: flex; flex-direction: column; gap: 8px;
  min-width: 0; font-family: inherit; color: inherit;
  transition: background 0.15s ease;
}
.db-stat-card:hover { background: #101419; }
.db-stat-card-active { background: var(--nv-signal-dim); box-shadow: inset 0 -2px 0 var(--nv-signal); }
.db-stat-label { font-family: var(--nv-font-mono); font-size: 10.5px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--nv-text-faint); }
.db-stat-value { font-family: var(--nv-font-display); font-weight: 700; font-size: clamp(17px, 2vw, 21px); color: var(--nv-text); }
.db-stat-delta { font-family: var(--nv-font-mono); font-size: 12px; font-weight: 500; }
.db-stat-sub { font-size: 11.5px; color: var(--nv-text-faint); }
.db-stat-skeleton {
  width: 70%; height: 20px; border-radius: 4px;
  background: linear-gradient(90deg, var(--nv-hairline-soft) 25%, var(--nv-hairline) 50%, var(--nv-hairline-soft) 75%);
  background-size: 200% 100%;
  animation: db-shimmer 1.4s ease-in-out infinite;
}
@keyframes db-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
.db-up { color: var(--nv-signal) !important; }
.db-down { color: var(--nv-danger) !important; }

/* ---------------- Chart panel ---------------- */
.db-chart-panel {
  border: 1px solid var(--nv-hairline); border-radius: 12px;
  background: var(--nv-panel); padding: clamp(16px, 3vw, 24px);
}
.db-chart-controls {
  display: flex; align-items: center; justify-content: space-between;
  gap: 14px; flex-wrap: wrap; margin-bottom: 18px;
}
.db-metric-tabs, .db-range-tabs { display: flex; gap: 6px; flex-wrap: wrap; }
.db-metric-tab, .db-range-tab {
  font-family: var(--nv-font-mono); font-size: 12px;
  background: transparent; color: var(--nv-text-dim);
  border: 1px solid var(--nv-hairline); border-radius: 999px;
  padding: 7px 13px; cursor: pointer; transition: all 0.15s ease;
}
.db-metric-tab:hover, .db-range-tab:hover { border-color: var(--nv-signal); color: var(--nv-text); }
.db-metric-tab-active, .db-range-tab-active {
  background: var(--nv-signal); border-color: var(--nv-signal); color: #061412; font-weight: 600;
}
.db-chart-head { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.db-chart-metric-name { font-family: var(--nv-font-display); font-weight: 700; font-size: 15px; color: var(--nv-text-dim); }

.db-chart-wrap { position: relative; }
.db-chart-svg { width: 100%; height: clamp(200px, 34vw, 320px); display: block; cursor: crosshair; }
.db-chart-grid { stroke: var(--nv-hairline-soft); stroke-width: 1; }
.db-chart-hover-line { stroke: var(--nv-hairline); stroke-width: 1; stroke-dasharray: 3 3; }

.db-chart-axis {
  display: flex; justify-content: space-between;
  font-family: var(--nv-font-mono); font-size: 11px; color: var(--nv-text-faint);
  margin-top: 6px;
}
.db-chart-minmax {
  display: flex; justify-content: space-between;
  font-family: var(--nv-font-mono); font-size: 11px; color: var(--nv-text-faint);
  margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--nv-hairline-soft);
}
.db-chart-tooltip {
  position: absolute; top: 8px; transform: translateX(-50%);
  display: flex; flex-direction: column; align-items: center; gap: 2px;
  background: #11151a; border: 1px solid var(--nv-hairline);
  border-radius: 8px; padding: 6px 10px;
  pointer-events: none; white-space: nowrap;
}
.db-chart-tooltip-value { font-family: var(--nv-font-mono); font-size: 12.5px; font-weight: 600; color: var(--nv-text); }
.db-chart-tooltip-time { font-family: var(--nv-font-mono); font-size: 10.5px; color: var(--nv-text-faint); }

.db-chart-empty {
  height: clamp(200px, 34vw, 320px);
  display: flex; align-items: center; justify-content: center;
  color: var(--nv-text-faint); font-size: 13px; text-align: center; padding: 0 20px;
}
.db-chart-error { color: var(--nv-danger); }
.db-chart-skeleton {
  width: 100%; height: 100%; border-radius: 8px;
  background: linear-gradient(90deg, var(--nv-hairline-soft) 25%, var(--nv-hairline) 50%, var(--nv-hairline-soft) 75%);
  background-size: 200% 100%;
  animation: db-shimmer 1.4s ease-in-out infinite;
}

@media (prefers-reduced-motion: reduce) {
  .db-live-dot, .db-stat-skeleton, .db-chart-skeleton { animation: none !important; }
}

@media (max-width: 860px) {
  .db-stats-grid { grid-template-columns: repeat(3, 1fr); }
}
@media (max-width: 560px) {
  .db-stats-grid { grid-template-columns: repeat(2, 1fr); }
  .db-header { flex-direction: column; }
}
@media (max-width: 380px) {
  .db-stats-grid { grid-template-columns: 1fr; }
}
`;