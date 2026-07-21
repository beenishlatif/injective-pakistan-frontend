/**
 * Ecosystem.jsx
 * ------------------------------------------------------------------
 * Full-page Ecosystem directory for the Injective website.
 * Lists dApps/projects built on Injective — searchable, filterable
 * by category, with a featured spotlight strip and a "submit your
 * project" CTA.
 *
 * Drop this file into your React project (e.g. src/components/) and
 * render <Ecosystem /> as a full page/route (e.g. /ecosystem).
 *
 * Visual language matches AIAssistant.jsx (Nova) so the site feels
 * like one product: same dark palette, same Space Grotesk / Inter /
 * IBM Plex Mono type stack, same hairline-border + signal-teal /
 * amber accent system. Self-contained styling — no Tailwind needed.
 *
 * Props:
 *   apiBaseUrl?: string — defaults to '' (same-origin requests to /api/ecosystem/...)
 *
 * Backend contract (see /backend folder shipped alongside this file):
 *   GET  /api/ecosystem/projects?search=&category=&page=&limit=
 *   GET  /api/ecosystem/projects/featured
 *   GET  /api/ecosystem/stats
 * ------------------------------------------------------------------
 */

import { useState, useEffect, useCallback, useRef } from "react";

const CATEGORIES = [
  "All",
  "DEX",
  "Lending",
  "Staking",
  "RWA",
  "AI",
  "NFT",
  "Gaming",
  "Infrastructure",
  "Wallet",
  "DAO",
  "Other",
];

// ---- helpers -------------------------------------------------------
function useDebouncedValue(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function formatCompactNumber(n) {
  if (n === null || n === undefined) return "—";
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + "B";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
}

// ---- small presentational pieces -----------------------------------
function ExternalLinkIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M7 17L17 7M17 7H9M17 7V15" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21L16.65 16.65" strokeLinecap="round" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 6L15 12L9 18" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ProjectLogo({ name, logoUrl }) {
  const initial = (name || "?").trim().charAt(0).toUpperCase();
  if (logoUrl) {
    return <img className="eco-logo-img" src={logoUrl} alt="" loading="lazy" />;
  }
  return <div className="eco-logo-fallback">{initial}</div>;
}

function ProjectCard({ project, featured = false }) {
  return (
    <a
      className={`eco-card ${featured ? "eco-card-featured" : ""}`}
      href={project.website || "#"}
      target="_blank"
      rel="noreferrer noopener"
    >
      <div className="eco-card-top">
        <ProjectLogo name={project.name} logoUrl={project.logoUrl} />
        <span className="eco-card-category">{project.category}</span>
      </div>
      <div className="eco-card-name">{project.name}</div>
      <p className="eco-card-desc">{project.description}</p>
      <div className="eco-card-foot">
        <span className="eco-card-visit">
          Visit site <ExternalLinkIcon />
        </span>
        {typeof project.tvl === "number" && (
          <span className="eco-card-tvl">TVL ${formatCompactNumber(project.tvl)}</span>
        )}
      </div>
    </a>
  );
}

function CardSkeleton() {
  return (
    <div className="eco-card eco-card-skeleton">
      <div className="eco-skel eco-skel-logo" />
      <div className="eco-skel eco-skel-line" style={{ width: "55%" }} />
      <div className="eco-skel eco-skel-line" style={{ width: "90%" }} />
      <div className="eco-skel eco-skel-line" style={{ width: "70%" }} />
    </div>
  );
}

export default function Ecosystem({ apiBaseUrl = "" }) {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 350);
  const [category, setCategory] = useState("All");

  const [projects, setProjects] = useState([]);
  const [featured, setFeatured] = useState([]);
  const [stats, setStats] = useState(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isFeaturedLoading, setIsFeaturedLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const requestId = useRef(0);

  // ---- fetch: stats + featured (once) ----
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${apiBaseUrl}/api/ecosystem/stats`);
        const data = await res.json();
        if (res.ok && data.success) setStats(data.stats);
      } catch (err) {
        console.error("Failed to load ecosystem stats:", err);
      }
    })();

    (async () => {
      setIsFeaturedLoading(true);
      try {
        const res = await fetch(`${apiBaseUrl}/api/ecosystem/projects/featured`);
        const data = await res.json();
        if (res.ok && data.success) setFeatured(data.projects);
      } catch (err) {
        console.error("Failed to load featured projects:", err);
      } finally {
        setIsFeaturedLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- fetch: project list (on search/category/page change) ----
  const fetchProjects = useCallback(
    async (reset) => {
      const currentPage = reset ? 1 : page;
      const myRequestId = ++requestId.current;
      setIsLoading(true);
      setErrorMsg("");
      try {
        const params = new URLSearchParams({
          page: String(currentPage),
          limit: "12",
        });
        if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
        if (category !== "All") params.set("category", category);

        const res = await fetch(`${apiBaseUrl}/api/ecosystem/projects?${params.toString()}`);
        const data = await res.json();
        if (myRequestId !== requestId.current) return; // stale response, ignore
        if (!res.ok || !data.success) throw new Error(data.error || "Request failed");

        setProjects((prev) => (reset ? data.projects : [...prev, ...data.projects]));
        setHasMore(Boolean(data.hasMore));
        if (reset) setPage(1);
      } catch (err) {
        console.error(err);
        if (myRequestId === requestId.current) {
          setErrorMsg("Couldn't load ecosystem projects. Please try again.");
        }
      } finally {
        if (myRequestId === requestId.current) setIsLoading(false);
      }
    },
    [apiBaseUrl, debouncedSearch, category, page]
  );

  // reset + refetch whenever search or category changes
  useEffect(() => {
    fetchProjects(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, category]);

  function handleLoadMore() {
    setPage((p) => p + 1);
  }
  useEffect(() => {
    if (page > 1) fetchProjects(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const showEmptyState = !isLoading && projects.length === 0;

  return (
    <>
      <style>{STYLES}</style>

      <div className="eco-page">
        {/* ---------------- Top bar ---------------- */}
        <div className="eco-topbar">
          <span className="eco-topbar-crumb">Injective / Ecosystem</span>
        </div>

        {/* ---------------- Hero ---------------- */}
        <section className="eco-hero">
          <div className="eco-hero-inner">
            <span className="eco-eyebrow">
              <span className="eco-live-dot" /> Ecosystem directory
            </span>
            <h1 className="eco-hero-title">Everything built on Injective</h1>
            <p className="eco-hero-sub">
              DeFi protocols, NFT marketplaces, infrastructure and more — discover
              and explore the apps powering the Injective chain.
            </p>

            <div className="eco-stats-strip">
              <div className="eco-stat">
                <span className="eco-stat-value">
                  {stats ? formatCompactNumber(stats.totalProjects) : "—"}
                </span>
                <span className="eco-stat-label">Projects</span>
              </div>
              <div className="eco-stat-divider" />
              <div className="eco-stat">
                <span className="eco-stat-value">
                  {stats ? `$${formatCompactNumber(stats.totalTvl)}` : "—"}
                </span>
                <span className="eco-stat-label">Total TVL</span>
              </div>
              <div className="eco-stat-divider" />
              <div className="eco-stat">
                <span className="eco-stat-value">
                  {stats ? stats.categoryCount : "—"}
                </span>
                <span className="eco-stat-label">Categories</span>
              </div>
            </div>
          </div>
        </section>

        {/* ---------------- Featured strip ---------------- */}
        {(isFeaturedLoading || featured.length > 0) && (
          <section className="eco-section">
            <div className="eco-section-head">
              <h2 className="eco-section-title">Spotlight</h2>
            </div>
            <div className="eco-featured-row">
              {isFeaturedLoading
                ? [1, 2, 3].map((i) => <CardSkeleton key={i} />)
                : featured.map((p) => (
                    <ProjectCard key={p._id || p.slug} project={p} featured />
                  ))}
            </div>
          </section>
        )}

        {/* ---------------- Search + filters ---------------- */}
        <section className="eco-controls">
          <div className="eco-search-bar">
            <SearchIcon />
            <input
              className="eco-search-input"
              type="text"
              placeholder="Search projects…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="eco-chip-row">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                className={`eco-filter-chip ${category === c ? "eco-filter-chip-active" : ""}`}
                onClick={() => setCategory(c)}
              >
                {c}
              </button>
            ))}
          </div>
        </section>

        {/* ---------------- Project grid ---------------- */}
        <section className="eco-section eco-grid-section">
          {errorMsg && <div className="eco-error">{errorMsg}</div>}

          {showEmptyState ? (
            <div className="eco-empty">
              <p className="eco-empty-title">No projects match that search</p>
              <p className="eco-empty-sub">
                Try a different keyword, or clear the category filter.
              </p>
            </div>
          ) : (
            <>
              <div className="eco-grid">
                {projects.map((p) => (
                  <ProjectCard key={p._id || p.slug} project={p} />
                ))}
                {isLoading &&
                  page === 1 &&
                  [1, 2, 3, 4, 5, 6].map((i) => <CardSkeleton key={`s-${i}`} />)}
              </div>

              {hasMore && (
                <button className="eco-load-more" onClick={handleLoadMore} disabled={isLoading}>
                  {isLoading ? "Loading…" : "Load more"}
                  {!isLoading && <ArrowIcon />}
                </button>
              )}
            </>
          )}
        </section>

        {/* ---------------- Submit CTA ---------------- */}
        <section className="eco-cta">
          <div className="eco-cta-inner">
            <div>
              <h3 className="eco-cta-title">Building on Injective?</h3>
              <p className="eco-cta-sub">
                Get your project listed in the ecosystem directory.
              </p>
            </div>
            <a className="eco-cta-btn" href="/ecosystem/submit">
              Submit your project <ArrowIcon />
            </a>
          </div>
        </section>
      </div>
    </>
  );
}

// ---------------- Self-contained styles (matches AIAssistant.jsx) ----------------
const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap');

:root {
  --eco-bg: #0b0d10;
  --eco-panel: #0d1013;
  --eco-hairline: #1d232b;
  --eco-hairline-soft: #171b21;
  --eco-text: #e7eaee;
  --eco-text-dim: #8992a1;
  --eco-text-faint: #545c67;
  --eco-signal: #47d6c4;
  --eco-signal-dim: rgba(71, 214, 196, 0.1);
  --eco-amber: #e8a33d;
  --eco-amber-dim: rgba(232, 163, 61, 0.08);
  --eco-danger: #e5645f;
  --eco-danger-dim: rgba(229, 100, 95, 0.1);
  --eco-font-display: "Space Grotesk", "Inter", sans-serif;
  --eco-font-body: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --eco-font-mono: "IBM Plex Mono", "SFMono-Regular", Consolas, monospace;
}

.eco-page {
  width: 100%;
  min-height: 100vh;
  background: var(--eco-bg);
  font-family: var(--eco-font-body);
  color: var(--eco-text);
}

.eco-topbar {
  padding: 15px clamp(16px, 8vw, 160px) 13px;
  border-bottom: 1px solid var(--eco-hairline);
}
.eco-topbar-crumb {
  font-family: var(--eco-font-mono);
  font-size: 10.5px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--eco-text-faint);
}

/* ---------------- Hero ---------------- */
.eco-hero {
  padding: 56px clamp(16px, 8vw, 160px) 34px;
  border-bottom: 1px solid var(--eco-hairline);
}
.eco-hero-inner { max-width: 720px; }
.eco-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-family: var(--eco-font-mono);
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--eco-signal);
  margin-bottom: 14px;
}
.eco-live-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--eco-signal);
  animation: eco-live 1.8s infinite;
}
@keyframes eco-live { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }

.eco-hero-title {
  font-family: var(--eco-font-display);
  font-weight: 700;
  font-size: clamp(28px, 4vw, 40px);
  letter-spacing: -0.01em;
  margin: 0 0 12px;
  color: var(--eco-text);
}
.eco-hero-sub {
  font-size: 15px;
  line-height: 1.65;
  color: var(--eco-text-dim);
  margin: 0 0 30px;
  max-width: 560px;
}

.eco-stats-strip { display: flex; align-items: center; gap: 22px; }
.eco-stat { display: flex; flex-direction: column; gap: 4px; }
.eco-stat-value {
  font-family: var(--eco-font-display);
  font-weight: 700;
  font-size: 22px;
  color: var(--eco-text);
}
.eco-stat-label {
  font-family: var(--eco-font-mono);
  font-size: 10.5px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--eco-text-faint);
}
.eco-stat-divider { width: 1px; height: 30px; background: var(--eco-hairline); }

/* ---------------- Sections ---------------- */
.eco-section { padding: 34px clamp(16px, 8vw, 160px); border-bottom: 1px solid var(--eco-hairline); }
.eco-section-head { margin-bottom: 18px; }
.eco-section-title {
  font-family: var(--eco-font-display);
  font-weight: 700;
  font-size: 16px;
  color: var(--eco-text);
  margin: 0;
}

.eco-featured-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 14px;
}

/* ---------------- Controls ---------------- */
.eco-controls {
  padding: 20px clamp(16px, 8vw, 160px);
  border-bottom: 1px solid var(--eco-hairline);
  background: rgba(255, 255, 255, 0.012);
  display: flex;
  flex-direction: column;
  gap: 14px;
  position: sticky;
  top: 0;
  z-index: 5;
  backdrop-filter: blur(6px);
}
.eco-search-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--eco-bg);
  border: 1px solid var(--eco-hairline);
  border-radius: 8px;
  padding: 10px 14px;
  color: var(--eco-text-faint);
  max-width: 420px;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.eco-search-bar:focus-within { border-color: var(--eco-signal); box-shadow: 0 0 0 3px var(--eco-signal-dim); }
.eco-search-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--eco-text);
  font-family: var(--eco-font-body);
  font-size: 13.5px;
}
.eco-search-input::placeholder { color: var(--eco-text-faint); }

.eco-chip-row { display: flex; flex-wrap: wrap; gap: 8px; }
.eco-filter-chip {
  font-family: var(--eco-font-mono);
  font-size: 11px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  background: transparent;
  border: 1px solid var(--eco-hairline);
  color: var(--eco-text-dim);
  padding: 7px 12px;
  border-radius: 20px;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease, color 0.15s ease;
}
.eco-filter-chip:hover { border-color: var(--eco-signal); color: var(--eco-text); }
.eco-filter-chip-active {
  border-color: var(--eco-signal);
  background: var(--eco-signal-dim);
  color: var(--eco-signal);
}
.eco-filter-chip:focus-visible { outline: 2px solid var(--eco-signal); outline-offset: 2px; }

/* ---------------- Grid + cards ---------------- */
.eco-grid-section { border-bottom: none; }
.eco-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 14px;
}

.eco-card {
  display: flex;
  flex-direction: column;
  background: var(--eco-panel);
  border: 1px solid var(--eco-hairline);
  border-radius: 10px;
  padding: 16px;
  text-decoration: none;
  color: var(--eco-text);
  transition: border-color 0.15s ease, transform 0.15s ease, background 0.15s ease;
}
.eco-card:hover { border-color: var(--eco-signal); transform: translateY(-2px); }
.eco-card-featured { border-left: 2px solid var(--eco-amber); background: var(--eco-amber-dim); }
.eco-card-featured:hover { border-color: var(--eco-amber); }

.eco-card-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.eco-logo-img { width: 34px; height: 34px; border-radius: 7px; object-fit: cover; border: 1px solid var(--eco-hairline); }
.eco-logo-fallback {
  width: 34px; height: 34px; border-radius: 7px;
  background: var(--eco-signal-dim);
  border: 1px solid var(--eco-hairline);
  color: var(--eco-signal);
  display: flex; align-items: center; justify-content: center;
  font-family: var(--eco-font-display);
  font-weight: 700;
  font-size: 14px;
}
.eco-card-category {
  font-family: var(--eco-font-mono);
  font-size: 9.5px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--eco-text-faint);
  border: 1px solid var(--eco-hairline-soft);
  padding: 3px 8px;
  border-radius: 20px;
}
.eco-card-name {
  font-family: var(--eco-font-display);
  font-weight: 700;
  font-size: 15px;
  margin-bottom: 6px;
}
.eco-card-desc {
  font-size: 12.5px;
  line-height: 1.6;
  color: var(--eco-text-dim);
  margin: 0 0 16px;
  flex: 1;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.eco-card-foot { display: flex; align-items: center; justify-content: space-between; }
.eco-card-visit {
  display: inline-flex; align-items: center; gap: 5px;
  font-family: var(--eco-font-mono);
  font-size: 10.5px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--eco-signal);
}
.eco-card-tvl {
  font-family: var(--eco-font-mono);
  font-size: 10.5px;
  color: var(--eco-text-faint);
}

/* ---------------- Skeletons ---------------- */
.eco-card-skeleton { gap: 10px; }
.eco-skel { background: var(--eco-hairline-soft); border-radius: 5px; animation: eco-pulse 1.4s ease-in-out infinite; }
.eco-skel-logo { width: 34px; height: 34px; border-radius: 7px; margin-bottom: 6px; }
.eco-skel-line { height: 10px; }
@keyframes eco-pulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }

/* ---------------- Empty / error ---------------- */
.eco-empty { text-align: left; max-width: 460px; padding: 30px 0; }
.eco-empty-title {
  font-family: var(--eco-font-display);
  font-weight: 700;
  font-size: 17px;
  margin: 0 0 6px;
}
.eco-empty-sub { color: var(--eco-text-dim); font-size: 13.5px; margin: 0; }

.eco-error {
  font-family: var(--eco-font-mono);
  font-size: 12px;
  color: var(--eco-danger);
  background: var(--eco-danger-dim);
  border: 1px solid rgba(229, 100, 95, 0.25);
  padding: 9px 11px;
  border-radius: 6px;
  margin-bottom: 16px;
}

/* ---------------- Load more ---------------- */
.eco-load-more {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 22px auto 0;
  background: transparent;
  border: 1px solid var(--eco-hairline);
  color: var(--eco-text);
  font-family: var(--eco-font-mono);
  font-size: 11.5px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 10px 18px;
  border-radius: 8px;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
}
.eco-load-more:hover:not(:disabled) { border-color: var(--eco-signal); background: var(--eco-signal-dim); }
.eco-load-more:disabled { opacity: 0.5; cursor: not-allowed; }

/* ---------------- CTA ---------------- */
.eco-cta { padding: 40px clamp(16px, 8vw, 160px) 60px; }
.eco-cta-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 18px;
  background: var(--eco-panel);
  border: 1px solid var(--eco-hairline);
  border-left: 2px solid var(--eco-amber);
  border-radius: 10px;
  padding: 24px 26px;
}
.eco-cta-title {
  font-family: var(--eco-font-display);
  font-weight: 700;
  font-size: 17px;
  margin: 0 0 4px;
}
.eco-cta-sub { color: var(--eco-text-dim); font-size: 13px; margin: 0; }
.eco-cta-btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  background: var(--eco-amber-dim);
  border: 1px solid var(--eco-amber);
  color: var(--eco-amber);
  text-decoration: none;
  font-family: var(--eco-font-mono);
  font-size: 11.5px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 11px 16px;
  border-radius: 8px;
  transition: background 0.15s ease, color 0.15s ease;
  flex-shrink: 0;
}
.eco-cta-btn:hover { background: var(--eco-amber); color: #1a1206; }

@media (prefers-reduced-motion: reduce) {
  .eco-live-dot, .eco-skel { animation: none !important; opacity: 1 !important; }
  .eco-card:hover { transform: none; }
}

@media (max-width: 640px) {
  .eco-cta-inner { flex-direction: column; align-items: flex-start; }
}
`;