/**
 * Dashboard.jsx
 * ------------------------------------------------------------------
 * Live Injective (INJ) network dashboard for Injective Pakistan Hub.
 *
 * Shows a real-time price + staking/supply snapshot, plus a historical
 * price chart that can be toggled between a chart view and a raw data
 * table.
 *
 * Data sources (backend, MongoDB-cached, CoinGecko/Injective-backed):
 *   GET /api/stats                 -> current price/staked/supply snapshot
 *   GET /api/stats/history?range=24h..  -> historical price points
 *
 * Same self-contained styling convention as Home.jsx / AIAssistant.jsx
 * (dark terminal aesthetic: Space Grotesk + Inter + IBM Plex Mono, teal/
 * violet/amber accents) so it renders correctly with or without Tailwind
 * wired up, and drops straight into src/pages/ routed at "/dashboard".
 *
 * Responsiveness follows the same convention as Home.jsx: fluid clamp()
 * sizing plus explicit breakpoints (860px / 680px / 520px / 380px) for
 * the grid/layout changes clamp() can't express on its own.
 *
 * Props:
 *   apiBaseUrl?: string — backend origin. Defaults to the live backend
 *   so the page works immediately after deployment even before any env
 *   var is wired up on the hosting platform.
 * ------------------------------------------------------------------
 */

import { useState, useEffect, useCallback, useRef, useMemo } from "react";

// Same backend origin used across Home.jsx / Ecosystem.jsx — frontend and
// backend live on separate Vercel/Railway domains, so this must be an
// absolute URL, not a same-origin relative path.
const DEFAULT_API_BASE_URL = "https://injective-pakistan-backend-2gbb.vercel.app";

const RANGES = [
  { id: "24h", label: "24H" },
  { id: "7d", label: "7D" },
  { id: "30d", label: "30D" },
  { id: "90d", label: "90D" },
];

// Rendered instantly on first paint, replaced once /api/stats responds.
const FALLBACK_STATS = {
  priceUsd: null,
  staked: null,
  totalSupply: null,
  fetchedAt: null,
};

// ---------------- Formatting helpers (mirrors Home.jsx conventions) ----------------
function formatUsd(value, opts = {}) {
  if (value === null || value === undefined) return "—";
  if (opts.precise) return `$${value.toFixed(4)}`;
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

function formatCompact(value, suffix = "") {
  if (value === null || value === undefined) return "—";
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B${suffix}`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M${suffix}`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K${suffix}`;
  return `${value.toFixed(2)}${suffix}`;
}

function formatClock(date) {
  if (!date) return "—";
  return new Date(date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatAxisTime(date, range) {
  const d = new Date(date);
  if (range === "24h") return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function Dashboard({ apiBaseUrl = DEFAULT_API_BASE_URL }) {
  const [stats, setStats] = useState(FALLBACK_STATS);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState(false);
  const [isStale, setIsStale] = useState(false);

  const [range, setRange] = useState("24h");
  const [points, setPoints] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState(false);

  const [view, setView] = useState("chart"); // "chart" | "table"
  const [mounted, setMounted] = useState(false);

  // ---------------- Data fetching ----------------
  const loadLiveStats = useCallback(async () => {
    setStatsError(false);
    try {
      const res = await fetch(`${apiBaseUrl}/api/stats`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        setStatsError(true);
        return;
      }
      setStats({
        priceUsd: data.price,
        staked: data.staked,
        totalSupply: data.totalSupply,
        fetchedAt: data.updatedAt,
      });
      setIsStale(Boolean(data.stale));
    } catch (err) {
      console.error("Failed to load live dashboard stats:", err);
      setStatsError(true);
    } finally {
      setStatsLoading(false);
    }
  }, [apiBaseUrl]);

  const loadHistory = useCallback(
    async (selectedRange) => {
      setHistoryLoading(true);
      setHistoryError(false);
      try {
        const res = await fetch(`${apiBaseUrl}/api/stats/history?range=${selectedRange}`);
        const data = await res.json();
        if (!res.ok || !data.success) {
          setHistoryError(true);
          return;
        }
        setPoints(data.points || []);
      } catch (err) {
        console.error("Failed to load price history:", err);
        setHistoryError(true);
      } finally {
        setHistoryLoading(false);
      }
    },
    [apiBaseUrl]
  );

  // On mount: trigger entrance animation, load live stats, and poll every
  // 45s (matches the backend cache TTL, so we're never fetching faster
  // than the cache can actually refresh).
  useEffect(() => {
    setMounted(true);
    loadLiveStats();
    const interval = setInterval(loadLiveStats, 45_000);
    return () => clearInterval(interval);
  }, [loadLiveStats]);

  // Re-fetch chart/table data whenever the selected range changes.
  useEffect(() => {
    loadHistory(range);
  }, [range, loadHistory]);

  return (
    <>
      <style>{STYLES}</style>
      <div className={`db-page ${mounted ? "db-mounted" : ""}`}>
        {/* ---------------- Header ---------------- */}
        <header className="db-header">
          <div className="db-header-top">
            <div className="db-eyebrow">
              <span className="db-live-dot" />
              <span>LIVE NETWORK DATA</span>
            </div>
            {stats.fetchedAt && (
              <span className="db-updated">
                Updated {formatClock(stats.fetchedAt)}
                {isStale && <span className="db-delayed"> · delayed</span>}
              </span>
            )}
          </div>
          <h1 className="db-title">Injective Dashboard</h1>
          <p className="db-subtitle">
            Real-time INJ price, staking, and supply data — refreshed automatically every 45
            seconds.
          </p>
        </header>

        {statsError && (
          <div className="db-banner db-banner-error">
            <span>Couldn't refresh live stats.</span>
            <button className="db-retry" onClick={loadLiveStats}>
              Retry
            </button>
          </div>
        )}

        {/* ---------------- Price hero + stat grid ---------------- */}
        <section className="db-section">
          <div className="db-price-hero">
            <div className="db-price-main">
              <span className="db-price-label">INJ / USD</span>
              {statsLoading ? (
                <span className="db-price-skeleton" />
              ) : (
                <span className="db-price-value">
                  {formatUsd(stats.priceUsd, { precise: true })}
                </span>
              )}
            </div>
          </div>

          <div className="db-stats-grid">
            <StatCard
              label="Staked INJ"
              value={statsLoading ? null : formatCompact(stats.staked, " INJ")}
              loading={statsLoading}
            />
            <StatCard
              label="Total Supply"
              value={statsLoading ? null : formatCompact(stats.totalSupply, " INJ")}
              loading={statsLoading}
            />
          </div>
        </section>

        {/* ---------------- Chart / table section ---------------- */}
        <section className="db-section">
          <div className="db-chart-head">
            <div className="db-range-tabs" role="tablist" aria-label="Chart range">
              {RANGES.map((r) => (
                <button
                  key={r.id}
                  role="tab"
                  aria-selected={range === r.id}
                  className={`db-range-tab ${range === r.id ? "db-range-tab-active" : ""}`}
                  onClick={() => setRange(r.id)}
                >
                  {r.label}
                </button>
              ))}
            </div>

            <div className="db-view-toggle" role="tablist" aria-label="Chart or table view">
              <button
                role="tab"
                aria-selected={view === "chart"}
                className={`db-view-btn ${view === "chart" ? "db-view-btn-active" : ""}`}
                onClick={() => setView("chart")}
              >
                <ChartIcon /> Chart
              </button>
              <button
                role="tab"
                aria-selected={view === "table"}
                className={`db-view-btn ${view === "table" ? "db-view-btn-active" : ""}`}
                onClick={() => setView("table")}
              >
                <TableIcon /> Table
              </button>
            </div>
          </div>

          {historyError && (
            <div className="db-banner db-banner-error">
              <span>Couldn't load price history.</span>
              <button className="db-retry" onClick={() => loadHistory(range)}>
                Retry
              </button>
            </div>
          )}

          <div className="db-chart-panel">
            {historyLoading ? (
              <div className="db-chart-loading">Loading chart data…</div>
            ) : view === "chart" ? (
              <PriceChart points={points} range={range} />
            ) : (
              <PriceTable points={points} range={range} />
            )}
          </div>
        </section>

        <footer className="db-footer">
          <span>Prices via CoinGecko, cached server-side every 45s.</span>
          <span>Not financial advice — do your own research.</span>
        </footer>
      </div>
    </>
  );
}

// ---------------- Stat card ----------------
function StatCard({ label, value, loading }) {
  return (
    <div className="db-stat-card">
      <span className="db-stat-label">{label}</span>
      {loading ? (
        <span className="db-stat-skeleton" />
      ) : (
        <span className="db-stat-value">{value ?? "—"}</span>
      )}
    </div>
  );
}

// ---------------- Line chart ----------------
// Self-contained SVG line chart — no charting library dependency, so it
// works regardless of what's installed in the host project. Renders a
// gradient-filled area, a hover crosshair, and a floating tooltip.
function PriceChart({ points, range }) {
  const svgRef = useRef(null);
  const [hover, setHover] = useState(null); // { index, x, y }
  const width = 800;
  const height = 280;
  const padX = 12;
  const padY = 24;

  const { path, areaPath, scaleX, scaleY, min, max } = useMemo(() => {
    if (!points.length) {
      return { path: "", areaPath: "", scaleX: () => 0, scaleY: () => 0, min: 0, max: 0 };
    }
    const prices = points.map((p) => p.priceUsd);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const spread = max - min || 1;

    const scaleX = (i) => padX + (i / Math.max(points.length - 1, 1)) * (width - padX * 2);
    const scaleY = (v) => height - padY - ((v - min) / spread) * (height - padY * 2);

    const path = points
      .map((p, i) => `${i === 0 ? "M" : "L"} ${scaleX(i)} ${scaleY(p.priceUsd)}`)
      .join(" ");
    const areaPath = `${path} L ${scaleX(points.length - 1)} ${height} L ${scaleX(0)} ${height} Z`;

    return { path, areaPath, scaleX, scaleY, min, max };
  }, [points]);

  if (!points.length) {
    return <div className="db-chart-empty">No chart data available yet.</div>;
  }

  const handleMove = (e) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * width;
    const idx = Math.round(((relX - padX) / (width - padX * 2)) * (points.length - 1));
    const clamped = Math.min(Math.max(idx, 0), points.length - 1);
    setHover({ index: clamped, x: scaleX(clamped), y: scaleY(points[clamped].priceUsd) });
  };

  const first = points[0].priceUsd;
  const last = points[points.length - 1].priceUsd;
  const trendUp = last >= first;
  const lineColor = trendUp ? "#47d6c4" : "#e5645f";

  return (
    <div className="db-chart-wrap">
      <div className="db-chart-labels db-chart-labels-top">
        <span>{formatUsd(max, { precise: true })}</span>
      </div>

      <svg
        ref={svgRef}
        className="db-chart-svg"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="db-area-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lineColor} stopOpacity="0.28" />
            <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
          </linearGradient>
        </defs>

        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1="0" x2={width} y1={height * f} y2={height * f} className="db-chart-grid" />
        ))}

        <path d={areaPath} fill="url(#db-area-fill)" stroke="none" />
        <path d={path} fill="none" stroke={lineColor} strokeWidth="2" />

        {hover && (
          <>
            <line x1={hover.x} x2={hover.x} y1="0" y2={height} className="db-chart-hover-line" />
            <circle cx={hover.x} cy={hover.y} r="4" fill={lineColor} />
          </>
        )}
      </svg>

      <div className="db-chart-labels db-chart-labels-bottom">
        <span>{formatUsd(min, { precise: true })}</span>
      </div>

      {hover && (
        <div className="db-chart-tooltip" style={{ left: `${(hover.x / width) * 100}%` }}>
          <span className="db-chart-tooltip-price">
            {formatUsd(points[hover.index].priceUsd, { precise: true })}
          </span>
          <span className="db-chart-tooltip-time">
            {formatAxisTime(points[hover.index].timestamp, range)}
          </span>
        </div>
      )}

      <div className="db-chart-axis">
        <span>{formatAxisTime(points[0].timestamp, range)}</span>
        <span>{formatAxisTime(points[points.length - 1].timestamp, range)}</span>
      </div>
    </div>
  );
}

// ---------------- Table view ----------------
function PriceTable({ points, range }) {
  if (!points.length) {
    return <div className="db-chart-empty">No history data available yet.</div>;
  }
  // Newest first, capped so the table stays scannable rather than dumping
  // hundreds of rows at once.
  const rows = [...points].reverse().slice(0, 200);

  return (
    <div className="db-table-wrap">
      <table className="db-table">
        <thead>
          <tr>
            <th>Time</th>
            <th>Price (USD)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p, i) => (
            <tr key={i}>
              <td>{formatAxisTime(p.timestamp, range)}</td>
              <td>{formatUsd(p.priceUsd, { precise: true })}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------- Icons ----------------
function ChartIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 19V9M12 19V5M20 19v-7" strokeLinecap="round" />
    </svg>
  );
}
function TableIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 10h18M9 4v16" />
    </svg>
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
  --nv-violet: #9b8cff;
  --nv-amber: #e8a33d;
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
.db-header { padding: clamp(32px, 7vw, 64px) clamp(14px, 6vw, 96px) 0; }
.db-header-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 18px; }
.db-eyebrow {
  display: inline-flex; align-items: center; gap: 8px;
  font-family: var(--nv-font-mono); font-size: 11px; letter-spacing: 0.1em;
  color: var(--nv-signal);
  border: 1px solid var(--nv-hairline);
  background: var(--nv-signal-dim);
  padding: 7px 12px;
  border-radius: 999px;
}
.db-updated { font-family: var(--nv-font-mono); font-size: 11.5px; color: var(--nv-text-faint); }
.db-delayed { color: var(--nv-amber); }
.db-title {
  font-family: var(--nv-font-display); font-weight: 700;
  font-size: clamp(26px, 4.4vw, 44px);
  letter-spacing: -0.015em;
  margin: 0 0 12px;
}
.db-subtitle { font-size: clamp(13.5px, 1.6vw, 15px); line-height: 1.7; color: var(--nv-text-dim); max-width: 560px; margin: 0; }

/* ---------------- Banners ---------------- */
.db-banner {
  display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
  margin: 20px clamp(14px, 6vw, 96px) 0;
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 13px;
}
.db-banner-error { background: var(--nv-danger-dim); border: 1px solid rgba(229, 100, 95, 0.3); color: var(--nv-danger); }
.db-retry {
  font-family: var(--nv-font-mono); font-size: 11px;
  background: transparent; color: inherit;
  border: 1px solid currentColor;
  padding: 5px 10px; border-radius: 6px; cursor: pointer;
}

/* ---------------- Sections ---------------- */
.db-section { padding: clamp(28px, 5vw, 48px) clamp(14px, 6vw, 96px); border-bottom: 1px solid var(--nv-hairline-soft); }

/* Price hero */
.db-price-hero { margin-bottom: 22px; }
.db-price-main { display: flex; align-items: baseline; gap: 16px; flex-wrap: wrap; }
.db-price-label { font-family: var(--nv-font-mono); font-size: 12px; letter-spacing: 0.08em; color: var(--nv-text-faint); width: 100%; }
.db-price-value { font-family: var(--nv-font-display); font-weight: 700; font-size: clamp(34px, 6vw, 56px); letter-spacing: -0.01em; }
.db-price-skeleton {
  width: 220px; max-width: 60vw; height: clamp(34px, 6vw, 56px); border-radius: 8px;
  background: linear-gradient(90deg, var(--nv-hairline-soft) 25%, var(--nv-hairline) 50%, var(--nv-hairline-soft) 75%);
  background-size: 200% 100%;
  animation: db-shimmer 1.4s ease-in-out infinite;
}
@keyframes db-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

/* Stats grid: auto-fit reflows on its own across all breakpoints */
.db-stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1px; background: var(--nv-hairline); border: 1px solid var(--nv-hairline); border-radius: 10px; overflow: hidden; }
.db-stat-card { background: var(--nv-panel); padding: clamp(14px, 2.6vw, 18px) clamp(14px, 2.6vw, 18px); display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.db-stat-label { font-family: var(--nv-font-mono); font-size: 10px; letter-spacing: 0.07em; text-transform: uppercase; color: var(--nv-text-faint); }
.db-stat-value { font-family: var(--nv-font-display); font-weight: 700; font-size: clamp(15px, 1.8vw, 18px); color: var(--nv-text); }
.db-stat-skeleton {
  width: 70%; height: 18px; border-radius: 4px;
  background: linear-gradient(90deg, var(--nv-hairline-soft) 25%, var(--nv-hairline) 50%, var(--nv-hairline-soft) 75%);
  background-size: 200% 100%;
  animation: db-shimmer 1.4s ease-in-out infinite;
}

/* ---------------- Chart head (range + view toggle) ---------------- */
.db-chart-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 18px; }
.db-range-tabs, .db-view-toggle {
  display: inline-flex; gap: 2px;
  background: rgba(255, 255, 255, 0.025);
  border: 1px solid var(--nv-hairline);
  border-radius: 999px;
  padding: 3px;
}
.db-range-tab, .db-view-btn {
  font-family: var(--nv-font-mono); font-size: 12px; font-weight: 500;
  color: var(--nv-text-dim);
  background: transparent; border: none; cursor: pointer;
  padding: 7px 14px; border-radius: 999px;
  display: inline-flex; align-items: center; gap: 6px;
  transition: color 0.15s ease, background 0.15s ease;
}
.db-range-tab:hover, .db-view-btn:hover { color: var(--nv-text); background: rgba(255, 255, 255, 0.06); }
.db-range-tab-active, .db-view-btn-active { color: #061412; background: linear-gradient(135deg, var(--nv-signal), #6fe2d4); font-weight: 600; }

/* ---------------- Chart panel ---------------- */
.db-chart-panel {
  border: 1px solid var(--nv-hairline);
  border-radius: 12px;
  background: var(--nv-panel);
  padding: clamp(14px, 2.6vw, 22px);
  min-height: 320px;
}
.db-chart-loading, .db-chart-empty {
  display: flex; align-items: center; justify-content: center;
  height: 280px;
  font-family: var(--nv-font-mono); font-size: 13px; color: var(--nv-text-faint);
}
.db-chart-wrap { position: relative; }
.db-chart-svg { width: 100%; height: 280px; display: block; cursor: crosshair; }
.db-chart-grid { stroke: var(--nv-hairline-soft); stroke-width: 1; }
.db-chart-hover-line { stroke: var(--nv-text-faint); stroke-width: 1; stroke-dasharray: 3 3; }
.db-chart-labels { display: flex; justify-content: flex-end; font-family: var(--nv-font-mono); font-size: 11px; color: var(--nv-text-faint); }
.db-chart-labels-top { margin-bottom: 4px; }
.db-chart-labels-bottom { margin-top: 4px; }
.db-chart-axis { display: flex; justify-content: space-between; font-family: var(--nv-font-mono); font-size: 11px; color: var(--nv-text-faint); margin-top: 6px; }
.db-chart-tooltip {
  position: absolute; top: 8px; transform: translateX(-50%);
  display: flex; flex-direction: column; align-items: center; gap: 2px;
  background: rgba(11, 13, 16, 0.95);
  border: 1px solid var(--nv-hairline);
  border-radius: 8px;
  padding: 6px 10px;
  pointer-events: none;
  white-space: nowrap;
}
.db-chart-tooltip-price { font-family: var(--nv-font-mono); font-size: 12.5px; font-weight: 600; color: var(--nv-text); }
.db-chart-tooltip-time { font-family: var(--nv-font-mono); font-size: 10px; color: var(--nv-text-faint); }

/* ---------------- Table view ---------------- */
.db-table-wrap { max-height: 340px; overflow-y: auto; }
.db-table { width: 100%; border-collapse: collapse; font-family: var(--nv-font-mono); font-size: 12.5px; }
.db-table thead th {
  position: sticky; top: 0;
  text-align: left;
  font-size: 10.5px; letter-spacing: 0.06em; text-transform: uppercase;
  color: var(--nv-text-faint);
  background: var(--nv-panel);
  padding: 8px 10px;
  border-bottom: 1px solid var(--nv-hairline);
}
.db-table tbody td { padding: 8px 10px; border-bottom: 1px solid var(--nv-hairline-soft); color: var(--nv-text-dim); }
.db-table tbody tr:hover td { color: var(--nv-text); background: rgba(255, 255, 255, 0.02); }

/* ---------------- Footer ---------------- */
.db-footer {
  display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px;
  padding: 24px clamp(14px, 6vw, 96px) 40px;
  font-family: var(--nv-font-mono); font-size: 11px; color: var(--nv-text-faint);
}

@media (prefers-reduced-motion: reduce) {
  .db-live-dot, .db-price-skeleton, .db-stat-skeleton { animation: none !important; }
}

/* Tablet */
@media (max-width: 860px) {
  .db-chart-head { flex-direction: column; align-items: stretch; }
  .db-view-toggle { align-self: flex-start; }
}

/* Large phones */
@media (max-width: 680px) {
  .db-header-top { flex-direction: column; align-items: flex-start; gap: 8px; }
  .db-price-main { align-items: flex-start; }
  .db-footer { flex-direction: column; }
}

/* Small phones */
@media (max-width: 520px) {
  .db-stats-grid { grid-template-columns: repeat(2, 1fr); }
  .db-range-tabs, .db-view-toggle { width: 100%; justify-content: space-between; }
  .db-range-tab, .db-view-btn { flex: 1; justify-content: center; padding: 7px 8px; }
}

/* Smallest phones */
@media (max-width: 380px) {
  .db-stats-grid { grid-template-columns: 1fr; }
  .db-chart-panel { padding: 12px; }
}
`;