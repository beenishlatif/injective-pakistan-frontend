/**
 * Home.jsx
 * ------------------------------------------------------------------
 * Landing page for Injective Pakistan Hub.
 *
 * Sections:
 *   1. Hero (thesis statement + live ticker strip)
 *   2. Live Stats grid (price / staked / burned / volume)
 *   3. Ecosystem Explorer preview (top protocols)
 *   4. AI Assistant (Nova) preview
 *   5. Learn / resource center preview
 *   6. Community band (open-source + reach stats)
 *   7. Footer
 *
 * NOTE: The nav bar has been intentionally removed from this page.
 *       If you need site-wide navigation, mount a separate <Nav />
 *       component above <Home /> at the layout/router level instead.
 *
 * Data sources (backend, MongoDB-backed):
 *   GET /api/home/stats              -> live network stats (cached snapshot)
 *   GET /api/home/ecosystem-featured -> featured ecosystem protocols
 *
 * Self-contained styling (same convention as AIAssistant.jsx) so it
 * renders correctly whether or not Tailwind is wired up in the host
 * project. Drop into src/pages/ and route "/" -> <Home />.
 *
 * Responsiveness:
 *   Layout is fluid via clamp()/fr-grid for spacing and type sizing,
 *   plus explicit breakpoints for the harder cases (multi-column grids
 *   and the two-column AI section) so the page holds up cleanly from
 *   small phones (~360px) up to desktop.
 *
 * Props:
 *   apiBaseUrl?: string — defaults to '' (same-origin /api/home/... calls)
 * ------------------------------------------------------------------
 */

import { useState, useEffect, useCallback } from "react";

// ---------------- Fallback data (shown instantly, replaced once the API responds) ----------------
// These are placeholder values rendered immediately on first paint, before
// the live network stats have loaded from the backend. This avoids a blank
// or empty-looking hero while the fetch is in flight.
const FALLBACK_STATS = {
  injPriceUsd: null,
  injPriceChange24h: null,
  totalStakedInj: null,
  totalBurnedInj: null,
  helixVolume24hUsd: null,
};

// Featured ecosystem protocols shown until (or unless) the live
// /api/home/ecosystem-featured endpoint returns real data.
const FALLBACK_ECOSYSTEM = [
  {
    slug: "helix",
    name: "Helix",
    category: "DEX",
    description: "On-chain order book exchange for spot and perpetual markets.",
    websiteUrl: "https://helixapp.com",
    tvlUsd: null,
  },
  {
    slug: "mito",
    name: "Mito",
    category: "AI",
    description: "Automated, on-chain vault strategies and structured yield products.",
    websiteUrl: "https://mito.fi",
    tvlUsd: null,
  },
  {
    slug: "black-panther",
    name: "Black Panther",
    category: "DEX",
    description: "Community-driven DEX and launchpad built natively on Injective.",
    websiteUrl: "https://blackpanther.fi",
    tvlUsd: null,
  },
  {
    slug: "hydro",
    name: "Hydro",
    category: "Lending",
    description: "Money market protocol for lending and borrowing INJ ecosystem assets.",
    websiteUrl: "https://hydroprotocol.finance",
    tvlUsd: null,
  },
];

// Beginner guides featured on the homepage. Each guide links out to a
// full write-up at /learn/:id.
const GUIDES = [
  {
    id: "wallet-setup",
    title: "Wallet Setup",
    subtitle: "How to create a wallet",
    summary:
      "Install Keplr or MetaMask and set up your first Injective wallet — a clear, step-by-step walkthrough.",
    minutes: 6,
  },
  {
    id: "helix-trading",
    title: "Trading on Helix",
    subtitle: "How to trade on Helix",
    summary:
      "Understand the order book, place market and limit orders, and complete your first trade.",
    minutes: 9,
  },
  {
    id: "inj-staking",
    title: "Staking INJ",
    subtitle: "How to stake INJ",
    summary:
      "Choosing a validator, earning staking rewards, and the unstaking period — explained in plain language.",
    minutes: 7,
  },
];

// Rotating sample question/answer pairs shown in the Nova AI preview panel
// on the homepage (purely illustrative — not a live chat).
const SAMPLE_QA = [
  {
    q: "How do I trade on Helix?",
    a: "Connect your wallet, select a market, then place a buy or sell order — everything settles on-chain.",
  },
  {
    q: "What is INJ's burn mechanism?",
    a: "Protocol fees are used in a weekly buyback auction, and the winning INJ tokens are then permanently burned.",
  },
];

// ---------------- Formatting helpers ----------------
// Compact USD formatting: 1,250,000 -> "$1.25M", 3,400 -> "$3.4K", etc.
function formatUsd(value) {
  if (value === null || value === undefined) return "—";
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

// Compact INJ token amount formatting, mirrors formatUsd's scaling.
function formatInj(value) {
  if (value === null || value === undefined) return "—";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M INJ`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K INJ`;
  return `${value.toFixed(2)} INJ`;
}

// Formats a percentage change with an explicit "+" sign for positive values,
// so the ticker/stat cards can style gains and losses differently.
function formatChange(value) {
  if (value === null || value === undefined) return null;
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export default function Home({ apiBaseUrl = "" }) {
  // Live network stats (price, staked, burned, volume) + loading/error state.
  const [stats, setStats] = useState(FALLBACK_STATS);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState(false);

  // Featured ecosystem protocols + loading state.
  const [ecosystem, setEcosystem] = useState(FALLBACK_ECOSYSTEM);
  const [ecosystemLoading, setEcosystemLoading] = useState(true);

  // Which sample Q&A is currently highlighted in the Nova preview panel.
  const [activeQa, setActiveQa] = useState(0);
  // Used purely to trigger the page's fade/slide-in entrance animation
  // once the component has mounted on the client.
  const [mounted, setMounted] = useState(false);

  // Fetches the live network stats snapshot. Wrapped in useCallback so it
  // has a stable identity for the setInterval polling effect below.
  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    setStatsError(false);
    try {
      const res = await fetch(`${apiBaseUrl}/api/home/stats`);
      const data = await res.json();
      if (res.ok && data.success) {
        setStats(data.stats);
      } else {
        setStatsError(true);
      }
    } catch (err) {
      console.error("Failed to load live stats:", err);
      setStatsError(true);
    } finally {
      setStatsLoading(false);
    }
  }, [apiBaseUrl]);

  // Fetches the featured ecosystem protocols. On failure, silently keeps
  // showing the FALLBACK_ECOSYSTEM list rather than surfacing an error —
  // this section is a preview, not critical live data.
  const loadEcosystem = useCallback(async () => {
    setEcosystemLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/home/ecosystem-featured`);
      const data = await res.json();
      if (res.ok && data.success && data.projects?.length) {
        setEcosystem(data.projects);
      }
    } catch (err) {
      console.error("Failed to load ecosystem highlights:", err);
      // keep fallback list on failure
    } finally {
      setEcosystemLoading(false);
    }
  }, [apiBaseUrl]);

  // On mount: trigger the entrance animation, kick off both data fetches,
  // and start a 60s polling interval to keep the live stats fresh.
  useEffect(() => {
    setMounted(true);
    loadStats();
    loadEcosystem();
    const interval = setInterval(loadStats, 60_000); // refresh every 60s
    return () => clearInterval(interval);
  }, [loadStats, loadEcosystem]);

  // Cycles the highlighted Q&A in the Nova preview panel every ~4.2s.
  useEffect(() => {
    const t = setInterval(() => setActiveQa((i) => (i + 1) % SAMPLE_QA.length), 4200);
    return () => clearInterval(t);
  }, []);

  // Items rendered inside the scrolling ticker strip in the hero.
  const tickerItems = [
    { label: "INJ", value: statsLoading ? "…" : formatUsd(stats.injPriceUsd) },
    { label: "24H", value: statsLoading ? "…" : formatChange(stats.injPriceChange24h) || "—" },
    { label: "STAKED", value: statsLoading ? "…" : formatInj(stats.totalStakedInj) },
    { label: "BURNED", value: statsLoading ? "…" : formatInj(stats.totalBurnedInj) },
    { label: "HELIX VOL", value: statsLoading ? "…" : formatUsd(stats.helixVolume24hUsd) },
  ];

  return (
    <>
      <style>{STYLES}</style>

      <div className={`hp-page ${mounted ? "hp-mounted" : ""}`}>
        {/* ---------------- Hero ---------------- */}
        <section className="hp-hero">
          <div className="hp-hero-inner">
            <div className="hp-eyebrow">
              <span className="hp-live-dot" />
              <span>PAKISTAN'S FIRST INJECTIVE ECOSYSTEM HUB</span>
            </div>
            <h1 className="hp-hero-title">
              On-chain order books.
              <br />
              Explained clearly, for everyone.
            </h1>
            <p className="hp-hero-sub">
              Ecosystem maps, live network signal, and an AI assistant that answers your
              Injective questions. Built by the community, for the community, at zero
              cost to you.
            </p>
            <div className="hp-hero-actions">
              <a className="hp-btn hp-btn-primary" href="/ecosystem">
                Explore Ecosystem
                <ChevronIcon />
              </a>
              <a className="hp-btn hp-btn-ghost" href="/ai-assistant">
                Ask Nova AI
              </a>
            </div>
          </div>

          {/* Signature element: live signal ticker strip.
              The item list is duplicated ([...items, ...items]) so the
              CSS marquee animation (hp-scroll, translateX -50%) can loop
              seamlessly without a visible jump cut. */}
          <div className="hp-ticker" role="status" aria-label="Live Injective network stats">
            <div className="hp-ticker-track">
              {[...tickerItems, ...tickerItems].map((item, i) => (
                <span className="hp-ticker-item" key={i}>
                  <span className="hp-ticker-label">{item.label}</span>
                  <span
                    className={`hp-ticker-value ${
                      item.label === "24H" && stats.injPriceChange24h != null
                        ? stats.injPriceChange24h >= 0
                          ? "hp-up"
                          : "hp-down"
                        : ""
                    }`}
                  >
                    {item.value}
                  </span>
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------- Live stats grid ---------------- */}
        <section className="hp-section">
          <div className="hp-section-head">
            <span className="hp-section-eyebrow">NETWORK / LIVE</span>
            <h2 className="hp-section-title">Signal from the chain</h2>
            {statsError && (
              <button className="hp-retry" onClick={loadStats}>
                Retry
              </button>
            )}
          </div>

          {/* 4 columns on desktop -> 2 on tablet -> 1 on small phones,
              see .hp-stats-grid breakpoints in STYLES below. */}
          <div className="hp-stats-grid">
            <StatCard
              label="INJ Price"
              value={statsLoading ? null : formatUsd(stats.injPriceUsd)}
              delta={statsLoading ? null : formatChange(stats.injPriceChange24h)}
              deltaPositive={stats.injPriceChange24h >= 0}
              loading={statsLoading}
            />
            <StatCard
              label="Total Staked"
              value={statsLoading ? null : formatInj(stats.totalStakedInj)}
              sub="Securing the network"
              loading={statsLoading}
            />
            <StatCard
              label="Total Burned"
              value={statsLoading ? null : formatInj(stats.totalBurnedInj)}
              sub="Weekly auction burns"
              loading={statsLoading}
            />
            <StatCard
              label="Helix 24H Volume"
              value={statsLoading ? null : formatUsd(stats.helixVolume24hUsd)}
              sub="On-chain order book"
              loading={statsLoading}
            />
          </div>
        </section>

        {/* ---------------- Ecosystem preview ---------------- */}
        <section className="hp-section">
          <div className="hp-section-head">
            <span className="hp-section-eyebrow">ECOSYSTEM / FEATURED</span>
            <h2 className="hp-section-title">Built on Injective</h2>
            <a className="hp-section-link" href="/ecosystem">
              View full map <ChevronIcon />
            </a>
          </div>

          {/* auto-fit/minmax means this grid reflows on its own at any
              width, no extra breakpoints needed. */}
          <div className="hp-ecosystem-grid">
            {(ecosystemLoading ? FALLBACK_ECOSYSTEM : ecosystem).map((project, i) => (
              <a
                key={project.slug}
                className="hp-eco-card"
                href={project.websiteUrl}
                target="_blank"
                rel="noreferrer"
              >
                <div className="hp-eco-card-top">
                  <span className="hp-eco-index">PROTOCOL/{String(i + 1).padStart(2, "0")}</span>
                  <span className="hp-eco-category">{project.category}</span>
                </div>
                <h3 className="hp-eco-name">{project.name}</h3>
                <p className="hp-eco-desc">{project.description}</p>
                <div className="hp-eco-card-bottom">
                  <span className="hp-eco-tvl">
                    {project.tvlUsd ? `TVL ${formatUsd(project.tvlUsd)}` : "TVL —"}
                  </span>
                  <span className="hp-eco-visit">
                    Visit <ChevronIcon />
                  </span>
                </div>
              </a>
            ))}
          </div>
        </section>

        {/* ---------------- AI Assistant preview ---------------- */}
        <section className="hp-section hp-ai-section">
          <div className="hp-ai-copy">
            <span className="hp-section-eyebrow">AI ASSISTANT / NOVA</span>
            <h2 className="hp-section-title">Ask anything about Injective</h2>
            <p className="hp-section-body">
              Nova is trained on Injective's docs, tokenomics, and ecosystem — ready to
              explain staking, trading, or building on Injective in clear, simple
              language.
            </p>
            <a className="hp-btn hp-btn-primary" href="/ai-assistant">
              Open Nova
              <ChevronIcon />
            </a>
          </div>

          <div className="hp-ai-preview" aria-hidden="true">
            <div className="hp-ai-preview-head">
              <span className="hp-live-dot" />
              <span>NOVA — LIVE PREVIEW</span>
            </div>
            {SAMPLE_QA.map((qa, i) => (
              <div key={i} className={`hp-ai-qa ${i === activeQa ? "hp-ai-qa-active" : ""}`}>
                <div className="hp-ai-q">{qa.q}</div>
                <div className="hp-ai-a">{qa.a}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ---------------- Learn / resource center preview ---------------- */}
        <section className="hp-section">
          <div className="hp-section-head">
            <span className="hp-section-eyebrow">LEARN / RESOURCE CENTER</span>
            <h2 className="hp-section-title">Guides that meet you where you are</h2>
            <a className="hp-section-link" href="/learn">
              All guides <ChevronIcon />
            </a>
          </div>

          <div className="hp-guides-grid">
            {GUIDES.map((g) => (
              <a key={g.id} className="hp-guide-card" href={`/learn/${g.id}`}>
                <div className="hp-guide-top">
                  <span className="hp-guide-min">{g.minutes} MIN READ</span>
                </div>
                <h3 className="hp-guide-title">{g.title}</h3>
                <p className="hp-guide-subtitle">{g.subtitle}</p>
                <p className="hp-guide-summary">{g.summary}</p>
                <span className="hp-guide-arrow">
                  <ChevronIcon />
                </span>
              </a>
            ))}
          </div>
        </section>

        {/* ---------------- Community band ---------------- */}
        <section className="hp-community">
          <div className="hp-community-item">
            <span className="hp-community-num">220M+</span>
            <span className="hp-community-label">People reachable in the region</span>
          </div>
          <div className="hp-community-divider" />
          <div className="hp-community-item">
            <span className="hp-community-num">$0</span>
            <span className="hp-community-label">Cost to the Injective community</span>
          </div>
          <div className="hp-community-divider" />
          <div className="hp-community-item">
            <span className="hp-community-num">100%</span>
            <span className="hp-community-label">Open source, on GitHub</span>
          </div>
        </section>

        {/* ---------------- Footer ---------------- */}
        <footer className="hp-footer">
          <div className="hp-footer-top">
            <div className="hp-footer-brand">
              <span className="hp-footer-mark">N</span>
              <span className="hp-footer-title">INJECTIVE PK</span>
            </div>
            <p className="hp-footer-tagline">
              Community-built. Not affiliated with Injective Labs. Made for Pakistan's
              on-chain community.
            </p>
          </div>
          <div className="hp-footer-links">
            <div className="hp-footer-col">
              <span className="hp-footer-col-title">Product</span>
              <a href="/ecosystem">Ecosystem</a>
              <a href="/dashboard">Dashboard</a>
              <a href="/ai-assistant">AI Assistant</a>
              <a href="/learn">Learn</a>
            </div>
            <div className="hp-footer-col">
              <span className="hp-footer-col-title">Community</span>
              <a href="https://github.com" target="_blank" rel="noreferrer">
                GitHub
              </a>
              <a href="https://discord.com" target="_blank" rel="noreferrer">
                Discord
              </a>
              <a href="https://twitter.com" target="_blank" rel="noreferrer">
                X / Twitter
              </a>
            </div>
          </div>
          <div className="hp-footer-bottom">
            <span>© {new Date().getFullYear()} Injective Pakistan Hub</span>
            <span>Built with the community, for the community.</span>
          </div>
        </footer>
      </div>
    </>
  );
}

// ---------------- Stat card ----------------
// Renders one tile in the "Signal from the chain" grid. Shows a shimmering
// skeleton in place of the value while data is loading, an optional
// colored delta (e.g. 24h price change), or a plain sub-label otherwise.
function StatCard({ label, value, delta, deltaPositive, sub, loading }) {
  return (
    <div className="hp-stat-card">
      <span className="hp-stat-label">{label}</span>
      {loading ? (
        <span className="hp-stat-skeleton" />
      ) : (
        <span className="hp-stat-value">{value ?? "—"}</span>
      )}
      {delta && !loading && (
        <span className={`hp-stat-delta ${deltaPositive ? "hp-up" : "hp-down"}`}>{delta}</span>
      )}
      {sub && !delta && !loading && <span className="hp-stat-sub">{sub}</span>}
    </div>
  );
}

// ---------------- Icons ----------------
// Small inline SVG icon kept local to this file so the component has no
// external icon-library dependency.
function ChevronIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 6L15 12L9 18" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ---------------- Self-contained styles (same design language as AIAssistant.jsx) ----------------
// All CSS lives in this template string and is injected via a <style> tag
// at render time, so the component works standalone even without Tailwind
// configured in the host project. Responsive behavior comes from two
// techniques used together:
//   1. Fluid sizing with clamp() for padding, type, and gaps — scales
//      smoothly between the min/max bounds without needing a breakpoint.
//   2. A small number of explicit @media breakpoints (860px, 680px, 520px,
//      380px) for layout changes that clamp() can't express: collapsing
//      multi-column grids to fewer columns or a single column, and
//      stacking the two-column AI section.
const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap');

.hp-page {
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
  opacity: 0;
  transform: translateY(6px);
  transition: opacity 0.5s ease, transform 0.5s ease;
}
.hp-page.hp-mounted { opacity: 1; transform: translateY(0); }
.hp-page * { box-sizing: border-box; }

.hp-live-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--nv-signal);
  animation: hp-live 1.8s infinite;
  flex-shrink: 0;
  display: inline-block;
}
@keyframes hp-live { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }

/* ---------------- Hero ---------------- */
.hp-hero { padding: clamp(40px, 10vw, 108px) clamp(14px, 6vw, 96px) 0; }
.hp-hero-inner { max-width: 760px; }
.hp-eyebrow {
  display: inline-flex; align-items: center; gap: 8px;
  font-family: var(--nv-font-mono); font-size: 11px; letter-spacing: 0.1em;
  color: var(--nv-signal);
  border: 1px solid var(--nv-hairline);
  background: var(--nv-signal-dim);
  padding: 7px 12px;
  border-radius: 999px;
  margin-bottom: 22px;
}
.hp-hero-title {
  font-family: var(--nv-font-display);
  font-weight: 700;
  font-size: clamp(30px, 5.4vw, 58px);
  line-height: 1.12;
  letter-spacing: -0.015em;
  margin: 0 0 20px;
  color: var(--nv-text);
}
.hp-hero-sub {
  font-size: clamp(14px, 1.8vw, 16px);
  line-height: 1.7;
  color: var(--nv-text-dim);
  max-width: 560px;
  margin: 0 0 32px;
}
.hp-hero-actions { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: clamp(36px, 6vw, 52px); }
.hp-btn {
  display: inline-flex; align-items: center; gap: 8px;
  font-family: var(--nv-font-body); font-weight: 600; font-size: 14px;
  text-decoration: none;
  padding: 13px 20px;
  border-radius: 8px;
  border: 1px solid transparent;
  transition: transform 0.15s ease, opacity 0.15s ease, border-color 0.15s ease, background 0.15s ease;
}
.hp-btn svg { transition: transform 0.15s ease; }
.hp-btn:hover svg { transform: translateX(2px); }
.hp-btn-primary { background: var(--nv-signal); color: #061412; }
.hp-btn-primary:hover { opacity: 0.88; }
.hp-btn-ghost { border-color: var(--nv-hairline); color: var(--nv-text); }
.hp-btn-ghost:hover { border-color: var(--nv-signal); background: var(--nv-signal-dim); }

/* Ticker (signature element) */
.hp-ticker {
  border-top: 1px solid var(--nv-hairline);
  border-bottom: 1px solid var(--nv-hairline);
  background: rgba(255, 255, 255, 0.012);
  overflow: hidden;
  white-space: nowrap;
}
.hp-ticker-track {
  display: inline-flex;
  animation: hp-scroll 26s linear infinite;
  padding: 13px 0;
}
.hp-page:hover .hp-ticker-track { animation-play-state: paused; }
@keyframes hp-scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
.hp-ticker-item {
  display: inline-flex; align-items: baseline; gap: 8px;
  padding: 0 clamp(16px, 3vw, 34px);
  border-right: 1px solid var(--nv-hairline-soft);
  font-family: var(--nv-font-mono);
}
.hp-ticker-label { font-size: 10.5px; letter-spacing: 0.08em; color: var(--nv-text-faint); }
.hp-ticker-value { font-size: 13px; font-weight: 500; color: var(--nv-text); }
.hp-up { color: var(--nv-signal) !important; }
.hp-down { color: var(--nv-danger) !important; }

/* ---------------- Sections ---------------- */
.hp-section { padding: clamp(40px, 7vw, 84px) clamp(14px, 6vw, 96px); border-bottom: 1px solid var(--nv-hairline-soft); }
.hp-section-head {
  display: flex; align-items: baseline; flex-wrap: wrap; gap: 6px 16px;
  margin-bottom: 26px;
}
.hp-section-eyebrow {
  font-family: var(--nv-font-mono); font-size: 11px; letter-spacing: 0.1em;
  color: var(--nv-text-faint);
  width: 100%;
}
.hp-section-title {
  font-family: var(--nv-font-display); font-weight: 700;
  font-size: clamp(21px, 2.6vw, 30px);
  letter-spacing: -0.01em;
  margin: 0;
  color: var(--nv-text);
}
.hp-section-body { font-size: 15px; line-height: 1.75; color: var(--nv-text-dim); max-width: 480px; margin: 14px 0 26px; }
.hp-section-link {
  margin-left: auto;
  display: inline-flex; align-items: center; gap: 4px;
  font-family: var(--nv-font-mono); font-size: 12px; letter-spacing: 0.04em;
  color: var(--nv-signal); text-decoration: none;
}
.hp-section-link:hover { text-decoration: underline; }
.hp-retry {
  margin-left: auto;
  font-family: var(--nv-font-mono); font-size: 11px;
  background: var(--nv-danger-dim); color: var(--nv-danger);
  border: 1px solid rgba(229, 100, 95, 0.3);
  padding: 6px 10px; border-radius: 6px; cursor: pointer;
}

/* Stats grid: 4 cols desktop -> 2 cols tablet (860px) -> 1 col phones (520px) */
.hp-stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; background: var(--nv-hairline); border: 1px solid var(--nv-hairline); border-radius: 10px; overflow: hidden; }
.hp-stat-card { background: var(--nv-panel); padding: clamp(16px, 3vw, 22px) clamp(14px, 3vw, 20px); display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.hp-stat-label { font-family: var(--nv-font-mono); font-size: 10.5px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--nv-text-faint); }
.hp-stat-value { font-family: var(--nv-font-display); font-weight: 700; font-size: clamp(19px, 2.4vw, 24px); color: var(--nv-text); }
.hp-stat-delta { font-family: var(--nv-font-mono); font-size: 12.5px; font-weight: 500; }
.hp-stat-sub { font-size: 12px; color: var(--nv-text-faint); }
.hp-stat-skeleton {
  width: 70%; height: 22px; border-radius: 4px;
  background: linear-gradient(90deg, var(--nv-hairline-soft) 25%, var(--nv-hairline) 50%, var(--nv-hairline-soft) 75%);
  background-size: 200% 100%;
  animation: hp-shimmer 1.4s ease-in-out infinite;
}
@keyframes hp-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

/* Ecosystem grid: auto-fit reflows on its own, no breakpoint needed */
.hp-ecosystem-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 14px; }
.hp-eco-card {
  display: flex; flex-direction: column; gap: 10px;
  background: var(--nv-panel);
  border: 1px solid var(--nv-hairline);
  border-radius: 10px;
  padding: 20px;
  text-decoration: none;
  color: var(--nv-text);
  transition: border-color 0.15s ease, transform 0.15s ease;
}
.hp-eco-card:hover { border-color: var(--nv-signal); transform: translateY(-2px); }
.hp-eco-card-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.hp-eco-index { font-family: var(--nv-font-mono); font-size: 10px; color: var(--nv-text-faint); letter-spacing: 0.06em; }
.hp-eco-category { font-family: var(--nv-font-mono); font-size: 10px; color: var(--nv-amber); background: var(--nv-amber-dim); padding: 3px 8px; border-radius: 999px; letter-spacing: 0.05em; white-space: nowrap; }
.hp-eco-name { font-family: var(--nv-font-display); font-weight: 700; font-size: 18px; margin: 0; }
.hp-eco-desc { font-size: 13px; line-height: 1.6; color: var(--nv-text-dim); margin: 0; flex: 1; }
.hp-eco-card-bottom { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding-top: 10px; border-top: 1px solid var(--nv-hairline-soft); }
.hp-eco-tvl { font-family: var(--nv-font-mono); font-size: 11px; color: var(--nv-text-faint); }
.hp-eco-visit { display: inline-flex; align-items: center; gap: 3px; font-family: var(--nv-font-mono); font-size: 11px; color: var(--nv-signal); white-space: nowrap; }

/* AI section: two columns desktop -> stacked single column on tablet/mobile */
.hp-ai-section { display: grid; grid-template-columns: 1fr 1fr; gap: clamp(24px, 5vw, 40px); align-items: center; }
.hp-ai-preview {
  border: 1px solid var(--nv-hairline);
  border-radius: 12px;
  background: var(--nv-panel);
  padding: 20px;
  display: flex; flex-direction: column; gap: 16px;
  min-width: 0;
}
.hp-ai-preview-head {
  display: flex; align-items: center; gap: 8px;
  font-family: var(--nv-font-mono); font-size: 10.5px; letter-spacing: 0.08em;
  color: var(--nv-text-faint);
  padding-bottom: 12px;
  border-bottom: 1px solid var(--nv-hairline-soft);
}
.hp-ai-qa { opacity: 0.35; transition: opacity 0.4s ease; padding: 4px 0; }
.hp-ai-qa-active { opacity: 1; }
.hp-ai-q {
  display: inline-block;
  font-size: 13px; color: var(--nv-text);
  background: var(--nv-amber-dim);
  border-right: 2px solid var(--nv-amber);
  padding: 9px 12px;
  border-radius: 6px 3px 6px 6px;
  margin-bottom: 8px;
}
.hp-ai-a { font-size: 13px; line-height: 1.6; color: var(--nv-text-dim); border-left: 2px solid var(--nv-signal); padding-left: 12px; }

/* Guides: auto-fit reflows on its own, no breakpoint needed */
.hp-guides-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 14px; }
.hp-guide-card {
  position: relative;
  display: flex; flex-direction: column; gap: 6px;
  background: var(--nv-panel);
  border: 1px solid var(--nv-hairline);
  border-radius: 10px;
  padding: 20px;
  padding-right: 40px;
  text-decoration: none;
  color: var(--nv-text);
  transition: border-color 0.15s ease, transform 0.15s ease;
}
.hp-guide-card:hover { border-color: var(--nv-signal); transform: translateY(-2px); }
.hp-guide-min { font-family: var(--nv-font-mono); font-size: 10px; letter-spacing: 0.06em; color: var(--nv-text-faint); }
.hp-guide-title { font-family: var(--nv-font-display); font-weight: 700; font-size: 16.5px; margin: 2px 0 0; }
.hp-guide-subtitle { font-size: 13px; color: var(--nv-signal); margin: 0; }
.hp-guide-summary { font-size: 12.5px; line-height: 1.6; color: var(--nv-text-dim); margin: 4px 0 0; }
.hp-guide-arrow { position: absolute; top: 18px; right: 18px; color: var(--nv-text-faint); }

/* Community band */
.hp-community {
  display: flex; align-items: center; justify-content: center;
  gap: clamp(20px, 4vw, 56px);
  padding: clamp(32px, 6vw, 44px) 20px;
  flex-wrap: wrap;
  border-bottom: 1px solid var(--nv-hairline-soft);
}
.hp-community-item { display: flex; flex-direction: column; align-items: center; gap: 4px; text-align: center; }
.hp-community-num { font-family: var(--nv-font-display); font-weight: 700; font-size: clamp(22px, 3vw, 28px); color: var(--nv-signal); }
.hp-community-label { font-family: var(--nv-font-mono); font-size: 11px; color: var(--nv-text-faint); max-width: 160px; }
.hp-community-divider { width: 1px; height: 34px; background: var(--nv-hairline); }

/* Footer */
.hp-footer { padding: clamp(36px, 6vw, 48px) clamp(14px, 6vw, 96px) 32px; }
.hp-footer-top { margin-bottom: 32px; }
.hp-footer-brand { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
.hp-footer-mark {
  width: 28px; height: 28px; flex-shrink: 0;
  border: 1px solid var(--nv-hairline);
  border-radius: 6px;
  background: var(--nv-signal-dim);
  color: var(--nv-signal);
  display: flex; align-items: center; justify-content: center;
  font-family: var(--nv-font-display); font-weight: 700; font-size: 13px;
}
.hp-footer-title { font-family: var(--nv-font-display); font-weight: 700; font-size: 13px; letter-spacing: 0.08em; color: var(--nv-text); }
.hp-footer-tagline { font-size: 13px; color: var(--nv-text-faint); max-width: 420px; line-height: 1.6; }
.hp-footer-links { display: flex; gap: clamp(28px, 8vw, 96px); margin-bottom: 36px; flex-wrap: wrap; }
.hp-footer-col { display: flex; flex-direction: column; gap: 10px; }
.hp-footer-col-title { font-family: var(--nv-font-mono); font-size: 10.5px; letter-spacing: 0.08em; color: var(--nv-text-faint); margin-bottom: 2px; }
.hp-footer-col a { color: var(--nv-text-dim); text-decoration: none; font-size: 13px; }
.hp-footer-col a:hover { color: var(--nv-signal); }
.hp-footer-bottom {
  display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px;
  padding-top: 20px; border-top: 1px solid var(--nv-hairline-soft);
  font-family: var(--nv-font-mono); font-size: 11px; color: var(--nv-text-faint);
}

@media (prefers-reduced-motion: reduce) {
  .hp-live-dot, .hp-ticker-track, .hp-stat-skeleton { animation: none !important; }
}

/* Tablet: drop the stats grid to 2 columns, stack the AI section. */
@media (max-width: 860px) {
  .hp-stats-grid { grid-template-columns: repeat(2, 1fr); }
  .hp-ai-section { grid-template-columns: 1fr; }
}

/* Large phones: hero actions and community band get tighter, ecosystem/
   guide cards allow smaller minimum widths so 2-up layouts remain
   comfortable instead of overflowing. */
@media (max-width: 680px) {
  .hp-hero-actions { flex-direction: column; align-items: stretch; }
  .hp-hero-actions .hp-btn { justify-content: center; }
  .hp-ecosystem-grid, .hp-guides-grid { grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); }
  .hp-community { gap: 24px 20px; }
  .hp-footer-bottom { flex-direction: column; }
}

/* Small phones: single-column stats and single-column card grids,
   smaller ticker item padding. */
@media (max-width: 520px) {
  .hp-stats-grid { grid-template-columns: 1fr; }
  .hp-ecosystem-grid, .hp-guides-grid { grid-template-columns: 1fr; }
  .hp-community { flex-direction: column; gap: 20px; }
  .hp-community-divider { width: 60%; height: 1px; }
}

/* Smallest phones: trim section padding further and tighten the
   ticker so labels/values don't crowd the viewport edge. */
@media (max-width: 380px) {
  .hp-ticker-item { padding: 0 12px; gap: 6px; }
  .hp-eco-card, .hp-guide-card { padding: 16px; }
}
`;