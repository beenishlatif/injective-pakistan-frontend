/**
 * Dashboard.jsx
 * ------------------------------------------------------------------
 * Live network dashboard for Injective Pakistan Hub.
 *
 * Tabs:
 *   Overview  — price hero, stats grid, market summary, fear & greed
 *   Markets   — history chart/table, INJ vs BTC/ETH/SOL/ATOM/BNB
 *   Network   — network status, validators, governance
 *   Analytics — portfolio calculator, ecosystem TVL
 *
 * Data sources (backend):
 *   GET /api/dashboard/live
 *   GET /api/dashboard/history?range=1h|24h|7d|30d|90d|1y|max
 *   GET /api/dashboard/compare?range=...&assets=btc,eth,sol,atom,bnb
 *   GET /api/dashboard/network
 *   GET /api/dashboard/validators
 *   GET /api/dashboard/governance
 *   GET /api/dashboard/feargreed
 *   GET /api/dashboard/ecosystem
 *   GET /api/dashboard/summary
 *
 * Same self-contained styling convention as before (CSS injected via
 * <style>, CSS variables prefixed --nv-). No chart library dependency.
 *
 * Props:
 *   apiBaseUrl?: string — defaults to the live backend origin.
 * ------------------------------------------------------------------
 */

import { useState, useEffect, useCallback, useMemo, useRef } from "react";

const DEFAULT_API_BASE_URL = "https://injective-pakistan-backend-2gbb.vercel.app";

const RANGES = [
  { key: "1h", label: "1H" },
  { key: "24h", label: "24H" },
  { key: "7d", label: "7D" },
  { key: "30d", label: "30D" },
  { key: "90d", label: "90D" },
  { key: "1y", label: "1Y" },
  { key: "max", label: "MAX" },
];

const METRICS = [
  { key: "injPriceUsd", label: "Price", format: (v) => formatUsd(v) },
  { key: "helixVolume24hUsd", label: "Helix Volume", format: (v) => formatUsd(v) },
  { key: "marketCapUsd", label: "Market Cap", format: (v) => formatUsd(v) },
];

const CURRENCIES = [
  { key: "usd", label: "USD", field: "injPriceUsd", format: (v) => formatUsd(v) },
  { key: "pkr", label: "PKR", field: "injPricePkr", format: (v) => formatPkr(v) },
  { key: "eur", label: "EUR", field: "injPriceEur", format: (v) => formatCurrency(v, "€") },
  { key: "gbp", label: "GBP", field: "injPriceGbp", format: (v) => formatCurrency(v, "£") },
];

const COMPARE_ASSETS = [
  { key: "inj", label: "INJ", color: "#47d6c4" },
  { key: "btc", label: "BTC", color: "#e8a33d" },
  { key: "eth", label: "ETH", color: "#8a8fe0" },
  { key: "sol", label: "SOL", color: "#c46be0" },
  { key: "atom", label: "ATOM", color: "#e06b8f" },
  { key: "bnb", label: "BNB", color: "#e0d16b" },
];
const COMPARE_COLORS = Object.fromEntries(COMPARE_ASSETS.map((a) => [a.key, a.color]));

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "markets", label: "Markets" },
  { key: "network", label: "Network" },
  { key: "analytics", label: "Analytics" },
];

// ---------------- Formatting helpers ----------------
function formatUsd(value) {
  if (value === null || value === undefined) return "—";
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

function formatPkr(value) {
  if (value === null || value === undefined) return "—";
  return `₨${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value)}`;
}

function formatCurrency(value, symbol) {
  if (value === null || value === undefined) return "—";
  return `${symbol}${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value)}`;
}

function formatInj(value, opts = {}) {
  if (value === null || value === undefined) return "—";
  const sign = opts.signed && value > 0 ? "+" : "";
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${sign}${(value / 1_000_000).toFixed(2)}M INJ`;
  if (abs >= 1_000) return `${sign}${(value / 1_000).toFixed(1)}K INJ`;
  return `${sign}${value.toFixed(2)} INJ`;
}

function formatNumber(value) {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function formatChange(value) {
  if (value === null || value === undefined) return null;
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function formatPercent(value) {
  if (value === null || value === undefined) return "—";
  return `${value.toFixed(2)}%`;
}

function formatTime(iso, range) {
  const d = new Date(iso);
  if (range === "1h" || range === "24h") return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function downloadCsv(filename, rows) {
  const csv = rows.map((r) => r.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Dashboard({ apiBaseUrl = DEFAULT_API_BASE_URL }) {
  const [activeTab, setActiveTab] = useState("overview");

  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [currency, setCurrency] = useState("usd");

  const [range, setRange] = useState("24h");
  const [metricKey, setMetricKey] = useState("injPriceUsd");
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState(false);
  const [view, setView] = useState("chart");

  const [compareSeries, setCompareSeries] = useState(null);
  const [compareLoading, setCompareLoading] = useState(true);
  const [compareError, setCompareError] = useState(false);
  const [compareAssets, setCompareAssets] = useState(["btc", "eth", "sol", "atom", "bnb"]);

  const [summary, setSummary] = useState(null);
  const [fearGreed, setFearGreed] = useState(null);
  const [networkStatus, setNetworkStatus] = useState(null);
  const [validators, setValidators] = useState(null);
  const [governance, setGovernance] = useState(null);
  const [ecosystem, setEcosystem] = useState(null);

  const [mounted, setMounted] = useState(false);

  const loadLive = useCallback(async () => {
    setStatsError(false);
    try {
      const res = await fetch(`${apiBaseUrl}/api/dashboard/live`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
        setLastUpdated(new Date());
      } else {
        setStatsError(true);
      }
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
        const res = await fetch(`${apiBaseUrl}/api/dashboard/history?range=${selectedRange}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.success) setHistory(data.snapshots || []);
        else setHistoryError(true);
      } catch (err) {
        console.error("Failed to load stats history:", err);
        setHistoryError(true);
      } finally {
        setHistoryLoading(false);
      }
    },
    [apiBaseUrl]
  );

  const loadComparison = useCallback(
    async (selectedRange, assets) => {
      setCompareLoading(true);
      setCompareError(false);
      try {
        const res = await fetch(
          `${apiBaseUrl}/api/dashboard/compare?range=${selectedRange}&assets=${assets.join(",")}`
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.success) setCompareSeries(data.series);
        else setCompareError(true);
      } catch (err) {
        console.error("Failed to load comparison data:", err);
        setCompareError(true);
      } finally {
        setCompareLoading(false);
      }
    },
    [apiBaseUrl]
  );

  const loadExtras = useCallback(async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/dashboard/summary`);
      const data = await res.json();
      if (data.success) setSummary(data.summary);
    } catch (err) {
      console.error("Failed to load summary:", err);
    }
    try {
      const res = await fetch(`${apiBaseUrl}/api/dashboard/feargreed`);
      const data = await res.json();
      if (data.success) setFearGreed(data.index);
    } catch (err) {
      console.error("Failed to load fear & greed index:", err);
    }
  }, [apiBaseUrl]);

  const loadNetworkTab = useCallback(async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/dashboard/network`);
      const data = await res.json();
      if (data.success) setNetworkStatus(data.status);
    } catch (err) {
      console.error("Failed to load network status:", err);
    }
    try {
      const res = await fetch(`${apiBaseUrl}/api/dashboard/validators`);
      const data = await res.json();
      if (data.success) setValidators(data.validators);
    } catch (err) {
      console.error("Failed to load validators:", err);
    }
    try {
      const res = await fetch(`${apiBaseUrl}/api/dashboard/governance`);
      const data = await res.json();
      if (data.success) setGovernance(data.proposal);
    } catch (err) {
      console.error("Failed to load governance:", err);
    }
  }, [apiBaseUrl]);

  const loadEcosystem = useCallback(async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/dashboard/ecosystem`);
      const data = await res.json();
      if (data.success) setEcosystem(data.protocols);
    } catch (err) {
      console.error("Failed to load ecosystem data:", err);
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    setMounted(true);
    loadLive();
    loadExtras();
    const interval = setInterval(loadLive, 30_000);
    return () => clearInterval(interval);
  }, [loadLive, loadExtras]);

  useEffect(() => {
    loadHistory(range);
    loadComparison(range, compareAssets);
  }, [range, compareAssets, loadHistory, loadComparison]);

  useEffect(() => {
    if (activeTab === "network" && !networkStatus) loadNetworkTab();
    if (activeTab === "analytics" && !ecosystem) loadEcosystem();
  }, [activeTab, networkStatus, ecosystem, loadNetworkTab, loadEcosystem]);

  const priceSeries = useMemo(
    () => history.map((s) => s.injPriceUsd).filter((v) => v !== null && v !== undefined),
    [history]
  );

  const activeMetric = METRICS.find((m) => m.key === metricKey) || METRICS[0];
  const metricSeries = useMemo(
    () => history.map((s) => s[metricKey]).filter((v) => v !== null && v !== undefined),
    [history, metricKey]
  );

  const activeCurrency = CURRENCIES.find((c) => c.key === currency) || CURRENCIES[0];
  const heroPrice = stats ? stats[activeCurrency.field] : null;

  const handleExportCsv = () => {
    const rows = [["Time", "Price (USD)", "Staked (INJ)", "Helix Volume (USD)", "Staking APR (%)"]];
    history.forEach((s) => {
      rows.push([
        new Date(s.createdAt).toISOString(),
        s.injPriceUsd ?? "",
        s.totalStakedInj ?? "",
        s.helixVolume24hUsd ?? "",
        s.stakingAprPercent ?? "",
      ]);
    });
    downloadCsv(`injective-stats-${range}.csv`, rows);
  };

  const toggleCompareAsset = (key) => {
    setCompareAssets((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  return (
    <>
      <style>{STYLES}</style>

      <div className={`db-page ${mounted ? "db-mounted" : ""}`}>
        {/* ---------------- Header ---------------- */}
        <header className="db-header">
          <div>
            <span className="db-eyebrow">
              <span className="db-live-dot" /> DASHBOARD / LIVE NETWORK DATA
            </span>
            <h1 className="db-title">Injective, in real time</h1>
          </div>
          <div className="db-header-right">
            <span className="db-updated">
              {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : "Loading…"}
            </span>
            <button className="db-refresh" onClick={loadLive} disabled={statsLoading}>
              Refresh
            </button>
          </div>
        </header>

        {statsError && (
          <div className="db-banner">Couldn't refresh live stats — showing the last known values.</div>
        )}

        {/* ---------------- Tabs ---------------- */}
        <nav className="db-tabs">
          {TABS.map((t) => (
            <button
              key={t.key}
              className={`db-tab-btn ${activeTab === t.key ? "db-tab-active" : ""}`}
              onClick={() => setActiveTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {/* ---------------- Price hero (always visible) ---------------- */}
        <section className="db-hero">
          <div className="db-hero-price">
            <div className="db-hero-label-row">
              <span className="db-hero-label">INJ / {activeCurrency.label}</span>
              <div className="db-currency-toggle">
                {CURRENCIES.map((c) => (
                  <button
                    key={c.key}
                    className={currency === c.key ? "db-currency-active" : ""}
                    onClick={() => setCurrency(c.key)}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            {statsLoading && !stats ? (
              <span className="db-skeleton db-skeleton-lg" />
            ) : (
              <span className="db-hero-value">{activeCurrency.format(heroPrice)}</span>
            )}
            {stats?.injPriceChange24h != null && (
              <span className={`db-hero-delta ${stats.injPriceChange24h >= 0 ? "db-up" : "db-down"}`}>
                {formatChange(stats.injPriceChange24h)} (24h)
              </span>
            )}
            {stats?.high24hUsd != null && stats?.low24hUsd != null && (
              <span className="db-hero-range">
                24H range: {formatUsd(stats.low24hUsd)} – {formatUsd(stats.high24hUsd)}
              </span>
            )}
          </div>
          <div className="db-hero-spark">
            <Sparkline values={priceSeries} positive={(stats?.injPriceChange24h ?? 0) >= 0} />
          </div>
        </section>

        {/* ================= OVERVIEW TAB ================= */}
        {activeTab === "overview" && (
          <>
            <section className="db-section">
              <div className="db-section-head">
                <span className="db-section-eyebrow">NETWORK / SNAPSHOT</span>
              </div>
              <div className="db-stats-grid">
                <StatCard label="Market Cap" value={formatUsd(stats?.marketCapUsd)} loading={statsLoading} />
                <StatCard
                  label="Circulating Supply"
                  value={stats?.circulatingSupply != null ? `${formatNumber(stats.circulatingSupply)} INJ` : "—"}
                  loading={statsLoading}
                />
                <StatCard
                  label="Total Supply"
                  value={stats?.totalSupply != null ? `${formatNumber(stats.totalSupply)} INJ` : "—"}
                  loading={statsLoading}
                />
                <StatCard label="Total Staked" value={formatInj(stats?.totalStakedInj)} loading={statsLoading} />
                <StatCard
                  label="Staking APR"
                  value={formatPercent(stats?.stakingAprPercent)}
                  sub="Nominal — before community tax & commission"
                  loading={statsLoading}
                />
                <StatCard
                  label="Net Supply Change"
                  value={formatInj(stats?.netSupplyChangeInj, { signed: true })}
                  sub="Vs. genesis (100M INJ) — burns net of inflation"
                  deltaPositive={stats?.netSupplyChangeInj != null ? stats.netSupplyChangeInj <= 0 : null}
                  loading={statsLoading}
                />
                <StatCard
                  label="Helix 24H Volume"
                  value={formatUsd(stats?.helixVolume24hUsd)}
                  sub="Summed across all Helix pairs"
                  loading={statsLoading}
                />
                <StatCard
                  label="24H High / Low"
                  value={
                    stats?.high24hUsd != null && stats?.low24hUsd != null
                      ? `${formatUsd(stats.high24hUsd)} / ${formatUsd(stats.low24hUsd)}`
                      : "—"
                  }
                  loading={statsLoading}
                />
              </div>
            </section>

            <section className="db-section">
              <div className="db-two-col">
                <div className="db-panel-card">
                  <span className="db-section-eyebrow">TODAY'S SUMMARY</span>
                  <p className="db-summary-text">{summary || "Generating summary…"}</p>
                </div>
                <FearGreedMeter data={fearGreed} />
              </div>
            </section>
          </>
        )}

        {/* ================= MARKETS TAB ================= */}
        {activeTab === "markets" && (
          <>
            <section className="db-section db-history">
              <div className="db-section-head">
                <span className="db-section-eyebrow">HISTORY</span>
                <div className="db-controls">
                  <div className="db-range-group">
                    {RANGES.map((r) => (
                      <button
                        key={r.key}
                        className={`db-range-btn ${range === r.key ? "db-range-active" : ""}`}
                        onClick={() => setRange(r.key)}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                  {view === "chart" && (
                    <div className="db-range-group">
                      {METRICS.map((m) => (
                        <button
                          key={m.key}
                          className={`db-range-btn ${metricKey === m.key ? "db-range-active" : ""}`}
                          onClick={() => setMetricKey(m.key)}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="db-view-group">
                    <button
                      className={`db-view-btn ${view === "chart" ? "db-view-active" : ""}`}
                      onClick={() => setView("chart")}
                    >
                      Chart
                    </button>
                    <button
                      className={`db-view-btn ${view === "table" ? "db-view-active" : ""}`}
                      onClick={() => setView("table")}
                    >
                      Table
                    </button>
                  </div>
                  <button className="db-export" onClick={handleExportCsv} disabled={!history.length}>
                    Export CSV
                  </button>
                </div>
              </div>

              {historyError && (
                <button className="db-retry" onClick={() => loadHistory(range)}>
                  Retry loading history
                </button>
              )}

              {!historyError && historyLoading && <div className="db-history-skeleton" />}

              {!historyError && !historyLoading && history.length === 0 && (
                <p className="db-empty">
                  No history yet for this range — snapshots build up over time as the backend scheduler runs.
                </p>
              )}

              {!historyError && !historyLoading && history.length > 0 && view === "chart" && (
                <div className="db-chart-panel">
                  <Sparkline
                    values={metricSeries}
                    positive={(stats?.injPriceChange24h ?? 0) >= 0}
                    height={220}
                    showAxis
                    labels={history.map((s) => formatTime(s.createdAt, range))}
                    valueFormat={activeMetric.format}
                  />
                </div>
              )}

              {!historyError && !historyLoading && history.length > 0 && view === "table" && (
                <div className="db-table-wrap">
                  <table className="db-table">
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>Price</th>
                        <th>Staked</th>
                        <th>Helix Vol</th>
                        <th>APR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...history].reverse().map((s, i) => (
                        <tr key={i}>
                          <td>{formatTime(s.createdAt, range)}</td>
                          <td>{formatUsd(s.injPriceUsd)}</td>
                          <td>{formatInj(s.totalStakedInj)}</td>
                          <td>{formatUsd(s.helixVolume24hUsd)}</td>
                          <td>{formatPercent(s.stakingAprPercent)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="db-section">
              <div className="db-section-head">
                <span className="db-section-eyebrow">% CHANGE COMPARISON</span>
                <div className="db-compare-toggle-group">
                  {COMPARE_ASSETS.filter((a) => a.key !== "inj").map((a) => (
                    <button
                      key={a.key}
                      className={`db-compare-toggle ${compareAssets.includes(a.key) ? "db-compare-toggle-active" : ""}`}
                      style={compareAssets.includes(a.key) ? { borderColor: a.color, color: a.color } : {}}
                      onClick={() => toggleCompareAsset(a.key)}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>

              {compareError && (
                <button className="db-retry" onClick={() => loadComparison(range, compareAssets)}>
                  Retry loading comparison
                </button>
              )}
              {!compareError && compareLoading && <div className="db-history-skeleton" />}
              {!compareError && !compareLoading && compareSeries && (
                <div className="db-chart-panel">
                  <div className="db-compare-legend">
                    {Object.keys(compareSeries).map((key) => (
                      <span key={key} className="db-legend-item">
                        <span className="db-legend-dot" style={{ background: COMPARE_COLORS[key] }} />
                        {key.toUpperCase()}
                      </span>
                    ))}
                  </div>
                  <MultiLineChart series={compareSeries} colors={COMPARE_COLORS} height={220} />
                </div>
              )}
            </section>
          </>
        )}

        {/* ================= NETWORK TAB ================= */}
        {activeTab === "network" && (
          <section className="db-section">
            <div className="db-stats-grid db-stats-grid-3">
              <div className="db-panel-card">
                <span className="db-section-eyebrow">LIVE NETWORK STATUS</span>
                {networkStatus ? (
                  <div className="db-kv-list">
                    <div className="db-kv-row">
                      <span>Network</span>
                      <span className={networkStatus.healthy ? "db-up" : "db-down"}>
                        {networkStatus.healthy ? "🟢 Healthy" : "🔴 Degraded"}
                      </span>
                    </div>
                    <div className="db-kv-row">
                      <span>RPC / LCD</span>
                      <span className={networkStatus.rpcOnline ? "db-up" : "db-down"}>
                        {networkStatus.rpcOnline ? "Online" : "Offline"}
                      </span>
                    </div>
                    <div className="db-kv-row">
                      <span>Latest Block</span>
                      <span>{networkStatus.latestBlockHeight ? formatNumber(networkStatus.latestBlockHeight) : "—"}</span>
                    </div>
                    <div className="db-kv-row">
                      <span>Block Time</span>
                      <span>{networkStatus.blockTimeSeconds != null ? `${networkStatus.blockTimeSeconds}s` : "—"}</span>
                    </div>
                  </div>
                ) : (
                  <span className="db-skeleton" />
                )}
              </div>

              <div className="db-panel-card">
                <span className="db-section-eyebrow">VALIDATORS</span>
                {validators ? (
                  <div className="db-kv-list">
                    <div className="db-kv-row">
                      <span>Total</span>
                      <span>{validators.total ?? "—"}</span>
                    </div>
                    <div className="db-kv-row">
                      <span>Active</span>
                      <span className="db-up">{validators.active ?? "—"}</span>
                    </div>
                    <div className="db-kv-row">
                      <span>Jailed</span>
                      <span className={validators.jailed ? "db-down" : ""}>{validators.jailed ?? "—"}</span>
                    </div>
                  </div>
                ) : (
                  <span className="db-skeleton" />
                )}
              </div>

              <div className="db-panel-card">
                <span className="db-section-eyebrow">GOVERNANCE</span>
                {governance ? (
                  <div className="db-kv-list">
                    <div className="db-kv-row">
                      <span>Latest Proposal</span>
                      <span title={governance.title}>{governance.title}</span>
                    </div>
                    <div className="db-kv-row">
                      <span>Status</span>
                      <span>{(governance.status || "").replace("PROPOSAL_STATUS_", "").replace(/_/g, " ")}</span>
                    </div>
                    <div className="db-kv-row">
                      <span>Voting Ends</span>
                      <span>{formatDate(governance.votingEndTime)}</span>
                    </div>
                  </div>
                ) : (
                  <span className="db-skeleton" />
                )}
              </div>
            </div>
          </section>
        )}

        {/* ================= ANALYTICS TAB ================= */}
        {activeTab === "analytics" && (
          <>
            <section className="db-section">
              <div className="db-section-head">
                <span className="db-section-eyebrow">PORTFOLIO CALCULATOR</span>
              </div>
              <PortfolioCalculator currentPrice={stats?.injPriceUsd} />
            </section>

            <section className="db-section">
              <div className="db-section-head">
                <span className="db-section-eyebrow">TOP ECOSYSTEM PROTOCOLS</span>
              </div>
              <div className="db-stats-grid db-stats-grid-3">
                {ecosystem
                  ? ecosystem.map((p) => (
                      <div key={p.key} className="db-panel-card">
                        <span className="db-stat-label">{p.label}</span>
                        <span className="db-stat-value">{p.tvlUsd != null ? formatUsd(p.tvlUsd) : "—"}</span>
                        <span className="db-stat-sub">Total Value Locked</span>
                      </div>
                    ))
                  : [1, 2, 3].map((i) => (
                      <div key={i} className="db-panel-card">
                        <span className="db-skeleton" />
                      </div>
                    ))}
              </div>
            </section>
          </>
        )}
      </div>
    </>
  );
}

// ---------------- Stat card ----------------
function StatCard({ label, value, sub, loading, deltaPositive }) {
  return (
    <div className="db-stat-card">
      <span className="db-stat-label">{label}</span>
      {loading ? (
        <span className="db-skeleton" />
      ) : (
        <span
          className={`db-stat-value ${
            deltaPositive === true ? "db-up" : deltaPositive === false ? "db-down" : ""
          }`}
        >
          {value}
        </span>
      )}
      {sub && !loading && <span className="db-stat-sub">{sub}</span>}
    </div>
  );
}

// ---------------- Portfolio calculator ----------------
function PortfolioCalculator({ currentPrice }) {
  const [investment, setInvestment] = useState("100");
  const [buyPrice, setBuyPrice] = useState("");

  const investmentNum = parseFloat(investment) || 0;
  const buyPriceNum = parseFloat(buyPrice) || 0;

  const injAmount = buyPriceNum > 0 ? investmentNum / buyPriceNum : 0;
  const currentValue = currentPrice ? injAmount * currentPrice : null;
  const profitUsd = currentValue != null ? currentValue - investmentNum : null;
  const profitPct = investmentNum > 0 && profitUsd != null ? (profitUsd / investmentNum) * 100 : null;

  return (
    <div className="db-panel-card db-calc-card">
      <div className="db-calc-inputs">
        <label className="db-calc-field">
          <span>Investment (USD)</span>
          <input
            type="number"
            value={investment}
            onChange={(e) => setInvestment(e.target.value)}
            placeholder="100"
          />
        </label>
        <label className="db-calc-field">
          <span>Bought at (USD)</span>
          <input
            type="number"
            value={buyPrice}
            onChange={(e) => setBuyPrice(e.target.value)}
            placeholder={currentPrice ? currentPrice.toFixed(2) : "e.g. 5.20"}
          />
        </label>
      </div>
      <div className="db-calc-results">
        <div className="db-calc-result">
          <span className="db-stat-label">Current Price</span>
          <span className="db-stat-value">{currentPrice ? formatUsd(currentPrice) : "—"}</span>
        </div>
        <div className="db-calc-result">
          <span className="db-stat-label">INJ Held</span>
          <span className="db-stat-value">{injAmount ? injAmount.toFixed(4) : "—"}</span>
        </div>
        <div className="db-calc-result">
          <span className="db-stat-label">Current Value</span>
          <span className="db-stat-value">{currentValue != null ? formatUsd(currentValue) : "—"}</span>
        </div>
        <div className="db-calc-result">
          <span className="db-stat-label">Profit / Loss</span>
          <span className={`db-stat-value ${profitPct != null ? (profitPct >= 0 ? "db-up" : "db-down") : ""}`}>
            {profitPct != null ? `${formatChange(profitPct)} (${formatUsd(profitUsd)})` : "—"}
          </span>
        </div>
      </div>
    </div>
  );
}

// ---------------- Fear & Greed meter ----------------
function FearGreedMeter({ data }) {
  const value = data?.value ?? null;
  const label = data?.label ?? "Loading…";
  const angle = value != null ? (value / 100) * 180 : 0;

  return (
    <div className="db-panel-card db-feargreed-card">
      <span className="db-section-eyebrow">CRYPTO MARKET SENTIMENT</span>
      <span className="db-stat-sub">Broad crypto Fear &amp; Greed Index (not INJ-specific)</span>
      <div className="db-gauge-wrap">
        <svg viewBox="0 0 200 110" className="db-gauge-svg">
          <path d="M10,100 A90,90 0 0,1 190,100" fill="none" stroke="var(--nv-hairline)" strokeWidth="14" />
          <path
            d="M10,100 A90,90 0 0,1 190,100"
            fill="none"
            stroke="url(#db-gauge-grad)"
            strokeWidth="14"
            strokeDasharray={`${(value ?? 0) * 2.83} 283`}
          />
          <defs>
            <linearGradient id="db-gauge-grad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--nv-danger)" />
              <stop offset="50%" stopColor="#e8c33d" />
              <stop offset="100%" stopColor="var(--nv-signal)" />
            </linearGradient>
          </defs>
          <line
            x1="100"
            y1="100"
            x2={100 + 70 * Math.cos(Math.PI - (angle * Math.PI) / 180)}
            y2={100 - 70 * Math.sin(Math.PI - (angle * Math.PI) / 180)}
            stroke="var(--nv-text)"
            strokeWidth="2.5"
          />
          <circle cx="100" cy="100" r="4" fill="var(--nv-text)" />
        </svg>
        <div className="db-gauge-readout">
          <span className="db-hero-value" style={{ fontSize: 28 }}>{value != null ? value : "—"}</span>
          <span className="db-stat-label">{label}</span>
        </div>
      </div>
    </div>
  );
}

// ---------------- Sparkline / line chart with hover tooltip ----------------
function Sparkline({ values, positive = true, height = 72, showAxis = false, labels = [], valueFormat }) {
  const width = 640;
  const padding = showAxis ? 28 : 4;
  const [hoverIdx, setHoverIdx] = useState(null);
  const svgRef = useRef(null);

  if (!values || values.length < 2) {
    return (
      <div className="db-spark-empty" style={{ height }}>
        Not enough data yet
      </div>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = values.map((v, i) => {
    const x = padding + (i / (values.length - 1)) * (width - padding * 2);
    const y = height - padding - ((v - min) / range) * (height - padding * 2);
    return [x, y];
  });

  const linePath = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${points[points.length - 1][0].toFixed(1)},${height - padding} L${points[0][0].toFixed(
    1
  )},${height - padding} Z`;

  const color = positive ? "var(--nv-signal)" : "var(--nv-danger)";
  const gradientId = `db-spark-grad-${positive ? "up" : "down"}`;
  const labelStep = Math.max(1, Math.floor(labels.length / 5));

  const handleMove = (e) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * width;
    let closest = 0;
    let closestDist = Infinity;
    points.forEach(([x], i) => {
      const d = Math.abs(x - relX);
      if (d < closestDist) {
        closestDist = d;
        closest = i;
      }
    });
    setHoverIdx(closest);
  };

  return (
    <div className="db-spark-wrap">
      <svg
        ref={svgRef}
        className="db-spark-svg"
        viewBox={`0 0 ${width} ${height + (showAxis ? 20 : 0)}`}
        preserveAspectRatio="none"
        onMouseMove={showAxis ? handleMove : undefined}
        onMouseLeave={() => setHoverIdx(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#${gradientId})`} stroke="none" />
        <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={points[points.length - 1][0]} cy={points[points.length - 1][1]} r="3.5" fill={color} />

        {hoverIdx !== null && (
          <>
            <line
              x1={points[hoverIdx][0]}
              y1={padding}
              x2={points[hoverIdx][0]}
              y2={height - padding}
              stroke="var(--nv-hairline)"
              strokeWidth="1"
              strokeDasharray="3,3"
            />
            <circle cx={points[hoverIdx][0]} cy={points[hoverIdx][1]} r="4" fill={color} stroke="var(--nv-bg)" strokeWidth="1.5" />
          </>
        )}

        {showAxis &&
          labels.map((label, i) =>
            i % labelStep === 0 ? (
              <text
                key={i}
                x={points[i][0]}
                y={height + 16}
                fontSize="10"
                fill="var(--nv-text-faint)"
                textAnchor="middle"
                fontFamily="var(--nv-font-mono)"
              >
                {label}
              </text>
            ) : null
          )}
      </svg>

      {hoverIdx !== null && (
        <div className="db-spark-tooltip">
          <span className="db-spark-tooltip-time">{labels[hoverIdx]}</span>
          <span className="db-spark-tooltip-value">
            {valueFormat ? valueFormat(values[hoverIdx]) : values[hoverIdx]}
          </span>
        </div>
      )}
    </div>
  );
}

// ---------------- Multi-line comparison chart ----------------
function MultiLineChart({ series, colors, height = 220 }) {
  const width = 640;
  const padding = 12;
  const [hoverX, setHoverX] = useState(null);
  const svgRef = useRef(null);

  const keys = Object.keys(series).filter((k) => series[k]?.length > 1);
  if (keys.length === 0) {
    return (
      <div className="db-spark-empty" style={{ height }}>
        Not enough data yet
      </div>
    );
  }

  const allValues = keys.flatMap((k) => series[k].map((p) => p.pctChange));
  const min = Math.min(...allValues, 0);
  const max = Math.max(...allValues, 0);
  const range = max - min || 1;

  const maxLen = Math.max(...keys.map((k) => series[k].length));
  const xFor = (i) => padding + (i / (maxLen - 1)) * (width - padding * 2);
  const yFor = (v) => height - padding - ((v - min) / range) * (height - padding * 2);
  const zeroY = yFor(0);

  const handleMove = (e) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * width;
    const idx = Math.round(((relX - padding) / (width - padding * 2)) * (maxLen - 1));
    setHoverX(Math.max(0, Math.min(maxLen - 1, idx)));
  };

  return (
    <div className="db-spark-wrap">
      <svg
        ref={svgRef}
        className="db-spark-svg"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverX(null)}
      >
        <line x1={padding} y1={zeroY} x2={width - padding} y2={zeroY} stroke="var(--nv-hairline)" strokeWidth="1" strokeDasharray="2,4" />

        {keys.map((key) => {
          const pts = series[key];
          const path = pts
            .map((p, i) => `${i === 0 ? "M" : "L"}${xFor(i).toFixed(1)},${yFor(p.pctChange).toFixed(1)}`)
            .join(" ");
          return <path key={key} d={path} fill="none" stroke={colors[key] || "#888"} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />;
        })}

        {hoverX !== null && (
          <line
            x1={xFor(hoverX)}
            y1={padding}
            x2={xFor(hoverX)}
            y2={height - padding}
            stroke="var(--nv-hairline)"
            strokeWidth="1"
            strokeDasharray="3,3"
          />
        )}
        {hoverX !== null &&
          keys.map((key) => {
            const p = series[key][hoverX];
            if (!p) return null;
            return <circle key={key} cx={xFor(hoverX)} cy={yFor(p.pctChange)} r="4" fill={colors[key] || "#888"} stroke="var(--nv-bg)" strokeWidth="1.5" />;
          })}
      </svg>

      {hoverX !== null && (
        <div className="db-spark-tooltip">
          {keys.map((key) => {
            const p = series[key][hoverX];
            if (!p) return null;
            return (
              <span key={key} className="db-spark-tooltip-value" style={{ color: colors[key] }}>
                {key.toUpperCase()} {p.pctChange >= 0 ? "+" : ""}
                {p.pctChange.toFixed(2)}%
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------- Styles ----------------
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
  padding: clamp(20px, 5vw, 48px) clamp(14px, 6vw, 96px) 80px;
  opacity: 0;
  transform: translateY(6px);
  transition: opacity 0.5s ease, transform 0.5s ease;
}
.db-page.db-mounted { opacity: 1; transform: translateY(0); }
.db-page * { box-sizing: border-box; }

.db-live-dot {
  width: 6px; height: 6px; border-radius: 50%; display: inline-block;
  background: var(--nv-signal); animation: db-live 1.8s infinite; margin-right: 6px;
}
@keyframes db-live { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
.db-up { color: var(--nv-signal) !important; }
.db-down { color: var(--nv-danger) !important; }

.db-header { display: flex; align-items: flex-end; justify-content: space-between; flex-wrap: wrap; gap: 16px; margin-bottom: 20px; }
.db-eyebrow { display: inline-flex; align-items: center; font-family: var(--nv-font-mono); font-size: 11px; letter-spacing: 0.1em; color: var(--nv-text-faint); margin-bottom: 10px; }
.db-title { font-family: var(--nv-font-display); font-weight: 700; font-size: clamp(24px, 3.4vw, 34px); margin: 0; letter-spacing: -0.01em; }
.db-header-right { display: flex; align-items: center; gap: 12px; }
.db-updated { font-family: var(--nv-font-mono); font-size: 11.5px; color: var(--nv-text-faint); }
.db-refresh {
  font-family: var(--nv-font-mono); font-size: 12px; color: var(--nv-text);
  background: transparent; border: 1px solid var(--nv-hairline); border-radius: 7px;
  padding: 8px 14px; cursor: pointer; transition: border-color 0.15s ease, background 0.15s ease;
}
.db-refresh:hover:not(:disabled) { border-color: var(--nv-signal); background: var(--nv-signal-dim); }
.db-refresh:disabled { opacity: 0.5; cursor: default; }

.db-banner {
  font-size: 13px; color: var(--nv-danger); background: var(--nv-danger-dim);
  border: 1px solid rgba(229, 100, 95, 0.25); border-radius: 8px; padding: 10px 14px; margin-bottom: 20px;
}

.db-tabs { display: flex; gap: 6px; border-bottom: 1px solid var(--nv-hairline); margin-bottom: 24px; overflow-x: auto; }
.db-tab-btn {
  font-family: var(--nv-font-mono); font-size: 12.5px; color: var(--nv-text-dim);
  background: transparent; border: none; padding: 10px 16px; cursor: pointer;
  border-bottom: 2px solid transparent; white-space: nowrap;
}
.db-tab-btn:hover { color: var(--nv-text); }
.db-tab-active { color: var(--nv-signal); border-bottom-color: var(--nv-signal); }

.db-hero {
  display: flex; align-items: center; justify-content: space-between; gap: 24px; flex-wrap: wrap;
  border: 1px solid var(--nv-hairline); border-radius: 12px; background: var(--nv-panel);
  padding: clamp(20px, 4vw, 32px); margin-bottom: 28px;
}
.db-hero-price { display: flex; flex-direction: column; gap: 6px; min-width: 200px; }
.db-hero-label-row { display: flex; align-items: center; gap: 12px; }
.db-hero-label { font-family: var(--nv-font-mono); font-size: 11px; letter-spacing: 0.08em; color: var(--nv-text-faint); }
.db-currency-toggle { display: inline-flex; border: 1px solid var(--nv-hairline); border-radius: 6px; overflow: hidden; }
.db-currency-toggle button {
  font-family: var(--nv-font-mono); font-size: 10.5px; color: var(--nv-text-dim);
  background: transparent; border: none; padding: 3px 8px; cursor: pointer;
}
.db-currency-active { background: var(--nv-signal-dim); color: var(--nv-signal) !important; }
.db-hero-value { font-family: var(--nv-font-display); font-weight: 700; font-size: clamp(32px, 5vw, 46px); line-height: 1; }
.db-hero-delta { font-family: var(--nv-font-mono); font-size: 14px; font-weight: 500; }
.db-hero-range { font-family: var(--nv-font-mono); font-size: 11.5px; color: var(--nv-text-faint); }
.db-hero-spark { flex: 1; min-width: 220px; max-width: 420px; }
.db-spark-wrap { position: relative; width: 100%; }
.db-spark-svg { width: 100%; height: 72px; display: block; cursor: crosshair; }
.db-spark-empty { display: flex; align-items: center; justify-content: center; font-size: 12px; color: var(--nv-text-faint); }
.db-spark-tooltip {
  position: absolute; top: 6px; right: 6px;
  background: var(--nv-bg); border: 1px solid var(--nv-hairline); border-radius: 6px;
  padding: 6px 10px; display: flex; flex-direction: column; gap: 2px; pointer-events: none;
}
.db-spark-tooltip-time { font-family: var(--nv-font-mono); font-size: 10px; color: var(--nv-text-faint); }
.db-spark-tooltip-value { font-family: var(--nv-font-display); font-weight: 700; font-size: 13px; color: var(--nv-text); }

.db-section { padding: 26px 0; border-bottom: 1px solid var(--nv-hairline-soft); }
.db-section-head { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-bottom: 18px; }
.db-section-eyebrow { font-family: var(--nv-font-mono); font-size: 11px; letter-spacing: 0.1em; color: var(--nv-text-faint); display: block; margin-bottom: 6px; }

.db-stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; background: var(--nv-hairline); border: 1px solid var(--nv-hairline); border-radius: 10px; overflow: hidden; }
.db-stats-grid-3 { grid-template-columns: repeat(3, 1fr); }
.db-stat-card { background: var(--nv-panel); padding: 18px 20px; display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.db-stat-label { font-family: var(--nv-font-mono); font-size: 10.5px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--nv-text-faint); }
.db-stat-value { font-family: var(--nv-font-display); font-weight: 700; font-size: clamp(15px, 1.8vw, 19px); }
.db-stat-sub { font-size: 11px; color: var(--nv-text-faint); }

.db-skeleton, .db-skeleton-lg {
  display: inline-block; border-radius: 4px;
  background: linear-gradient(90deg, var(--nv-hairline-soft) 25%, var(--nv-hairline) 50%, var(--nv-hairline-soft) 75%);
  background-size: 200% 100%; animation: db-shimmer 1.4s ease-in-out infinite;
}
.db-skeleton { width: 65%; height: 18px; }
.db-skeleton-lg { width: 160px; height: 40px; }
@keyframes db-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

.db-controls { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
.db-range-group, .db-view-group { display: inline-flex; border: 1px solid var(--nv-hairline); border-radius: 8px; overflow: hidden; }
.db-range-btn, .db-view-btn {
  font-family: var(--nv-font-mono); font-size: 11.5px; color: var(--nv-text-dim);
  background: transparent; border: none; padding: 8px 13px; cursor: pointer;
  border-right: 1px solid var(--nv-hairline);
}
.db-range-btn:last-child, .db-view-btn:last-child { border-right: none; }
.db-range-active, .db-view-active { background: var(--nv-signal-dim); color: var(--nv-signal); }
.db-export {
  font-family: var(--nv-font-mono); font-size: 11.5px; color: var(--nv-text);
  background: transparent; border: 1px solid var(--nv-hairline); border-radius: 8px;
  padding: 8px 13px; cursor: pointer;
}
.db-export:hover:not(:disabled) { border-color: var(--nv-signal); background: var(--nv-signal-dim); color: var(--nv-signal); }
.db-export:disabled { opacity: 0.4; cursor: default; }

.db-retry {
  font-family: var(--nv-font-mono); font-size: 11px; background: var(--nv-danger-dim); color: var(--nv-danger);
  border: 1px solid rgba(229, 100, 95, 0.3); padding: 8px 12px; border-radius: 6px; cursor: pointer;
}
.db-empty { font-size: 13px; color: var(--nv-text-faint); }
.db-history-skeleton { height: 220px; border-radius: 10px; background: var(--nv-panel); border: 1px solid var(--nv-hairline); }

.db-chart-panel { border: 1px solid var(--nv-hairline); border-radius: 10px; background: var(--nv-panel); padding: 20px; }
.db-chart-panel .db-spark-svg { height: 240px; }

.db-compare-legend { display: flex; gap: 16px; margin-bottom: 12px; flex-wrap: wrap; }
.db-legend-item { display: inline-flex; align-items: center; gap: 6px; font-family: var(--nv-font-mono); font-size: 11px; color: var(--nv-text-dim); }
.db-legend-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }

.db-compare-toggle-group { display: flex; gap: 6px; flex-wrap: wrap; }
.db-compare-toggle {
  font-family: var(--nv-font-mono); font-size: 11px; color: var(--nv-text-faint);
  background: transparent; border: 1px solid var(--nv-hairline); border-radius: 6px;
  padding: 5px 10px; cursor: pointer;
}
.db-compare-toggle-active { background: rgba(255,255,255,0.03); }

.db-table-wrap { border: 1px solid var(--nv-hairline); border-radius: 10px; overflow: hidden auto; max-height: 360px; }
.db-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.db-table th {
  position: sticky; top: 0; background: var(--nv-panel);
  text-align: left; font-family: var(--nv-font-mono); font-size: 10.5px; letter-spacing: 0.06em;
  color: var(--nv-text-faint); padding: 10px 14px; border-bottom: 1px solid var(--nv-hairline);
}
.db-table td { padding: 10px 14px; border-bottom: 1px solid var(--nv-hairline-soft); color: var(--nv-text-dim); }
.db-table tr:last-child td { border-bottom: none; }

.db-two-col { display: grid; grid-template-columns: 1.4fr 1fr; gap: 16px; }
.db-panel-card { background: var(--nv-panel); border: 1px solid var(--nv-hairline); border-radius: 10px; padding: 20px; display: flex; flex-direction: column; gap: 6px; }
.db-summary-text { font-size: 14px; line-height: 1.6; color: var(--nv-text-dim); margin: 8px 0 0; }

.db-kv-list { display: flex; flex-direction: column; gap: 10px; margin-top: 8px; }
.db-kv-row { display: flex; justify-content: space-between; gap: 12px; font-size: 13px; }
.db-kv-row span:first-child { color: var(--nv-text-faint); font-family: var(--nv-font-mono); font-size: 11px; }
.db-kv-row span:last-child { color: var(--nv-text); text-align: right; max-width: 60%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.db-calc-card { display: grid; grid-template-columns: 1fr 1.4fr; gap: 24px; padding: 24px; }
.db-calc-inputs { display: flex; flex-direction: column; gap: 14px; }
.db-calc-field { display: flex; flex-direction: column; gap: 6px; }
.db-calc-field span { font-family: var(--nv-font-mono); font-size: 10.5px; letter-spacing: 0.06em; color: var(--nv-text-faint); text-transform: uppercase; }
.db-calc-field input {
  background: var(--nv-bg); border: 1px solid var(--nv-hairline); border-radius: 8px; color: var(--nv-text);
  padding: 10px 12px; font-family: var(--nv-font-mono); font-size: 14px;
}
.db-calc-field input:focus { outline: none; border-color: var(--nv-signal); }
.db-calc-results { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; align-content: start; }
.db-calc-result { display: flex; flex-direction: column; gap: 4px; }

.db-feargreed-card { align-items: stretch; }
.db-gauge-wrap { display: flex; align-items: center; gap: 16px; margin-top: 8px; }
.db-gauge-svg { width: 140px; height: 78px; flex-shrink: 0; }
.db-gauge-readout { display: flex; flex-direction: column; gap: 2px; }

@media (prefers-reduced-motion: reduce) {
  .db-live-dot, .db-skeleton, .db-skeleton-lg { animation: none !important; }
}
@media (max-width: 960px) {
  .db-stats-grid, .db-stats-grid-3 { grid-template-columns: repeat(2, 1fr); }
  .db-two-col { grid-template-columns: 1fr; }
  .db-calc-card { grid-template-columns: 1fr; }
}
@media (max-width: 520px) {
  .db-stats-grid, .db-stats-grid-3 { grid-template-columns: 1fr; }
  .db-hero { flex-direction: column; align-items: stretch; }
  .db-hero-spark { max-width: none; }
  .db-calc-results { grid-template-columns: 1fr; }
}
`;