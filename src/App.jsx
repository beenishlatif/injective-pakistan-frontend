import { Link, Route, Routes, useLocation } from "react-router-dom";
import Home from "./pages/Home.jsx";
import Ecosystem from "./pages/Ecosystem.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import AIAssistant from "./pages/AIAssistant.jsx";
import Academy from "./pages/Academy.jsx";
import Game from "./pages/Game.jsx";
import Community from "./pages/Community.jsx";

// Branded-but-clear nav labels. Routes/components are unchanged —
// only the label shown in the nav is more distinct. "/community" is
// rendered separately as a standout CTA pill (see gnav-cta below),
// so it's excluded from the regular links list.
const navLinks = [
  { to: "/", label: "Overview" },
  { to: "/ecosystem", label: "Explore" },
  { to: "/ai-assistant", label: "Ask Nova" },
  { to: "/academy", label: "Academy" },
  { to: "/game", label: "Play" },
];

const communityLink = { to: "/community", label: "Join Community" };

// Backend base URL, injected via Vite env var (see .env -> VITE_API_BASE_URL)
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

export default function App() {
  const location = useLocation();
  const communityActive = location.pathname === communityLink.to;

  return (
    <div className="app-shell">
      <style>{NAV_STYLES}</style>

      {/* Floating glass pill navbar */}
      <div className="gnav-wrap">
        <div className="gnav-border">
          <nav className="gnav">
            <span className="gnav-glow" aria-hidden="true" />

            <Link to="/" className="gnav-brand">
              <span className="gnav-mark">
                <span className="gnav-mark-ring" aria-hidden="true" />
                <span className="gnav-mark-inner">N</span>
              </span>
              <span className="gnav-brand-text">
                <span className="gnav-title">INJECTIVE PK</span>
                <span className="gnav-sub">Community Hub</span>
              </span>
            </Link>

            <div className="gnav-links">
              {navLinks.map((link) => {
                const active = location.pathname === link.to;
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`gnav-link ${active ? "gnav-link-active" : ""}`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>

            <div className="gnav-right">
              <div className="gnav-status" aria-hidden="true">
                <span className="gnav-live-dot" />
                <span>LIVE</span>
              </div>

              <Link
                to={communityLink.to}
                className={`gnav-cta ${communityActive ? "gnav-cta-active" : ""}`}
              >
                <span className="gnav-cta-dot" />
                {communityLink.label}
                <svg
                  className="gnav-cta-arrow"
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  aria-hidden="true"
                >
                  <path d="M7 17L17 7M17 7H9M17 7V15" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            </div>
          </nav>
        </div>
      </div>

      {/* Page content */}
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route
            path="/ecosystem"
            element={<Ecosystem apiBaseUrl={API_BASE_URL} />}
          />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/ai-assistant" element={<AIAssistant />} />
          <Route path="/academy" element={<Academy />} />
          <Route path="/game" element={<Game />} />
          <Route path="/community" element={<Community />} />
        </Routes>
      </main>

      {/* Footer */}
      <footer className="app-footer">
        Injective Pakistan Hub — Community built, open source. ❤️ Pakistan
      </footer>
    </div>
  );
}

const NAV_STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap');

.app-shell {
  --nv-bg: #0b0d10;
  --nv-panel: #0d1013;
  --nv-hairline: #1d232b;
  --nv-hairline-soft: #171b21;
  --nv-text: #e7eaee;
  --nv-text-dim: #8992a1;
  --nv-text-faint: #545c67;
  --nv-signal: #47d6c4;
  --nv-signal-dim: rgba(71, 214, 196, 0.12);
  --nv-violet: #9b8cff;
  --nv-amber: #e8a33d;
  --nv-font-display: "Space Grotesk", "Inter", sans-serif;
  --nv-font-body: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --nv-font-mono: "IBM Plex Mono", "SFMono-Regular", Consolas, monospace;

  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--nv-bg);
  color: var(--nv-text);
  font-family: var(--nv-font-body);
}
.app-shell * { box-sizing: border-box; }

/* ---------------- Floating glass pill navbar ---------------- */
.gnav-wrap {
  position: sticky;
  top: 0;
  z-index: 50;
  display: flex;
  justify-content: center;
  padding: clamp(10px, 2vw, 18px) clamp(10px, 3vw, 20px) 0;
  pointer-events: none; /* let clicks pass through the padding area */
}

/* Slim animated gradient ring wrapping the whole pill — the "unique" edge glow */
.gnav-border {
  pointer-events: auto;
  width: 100%;
  max-width: 1226px;
  padding: 1.5px;
  border-radius: 999px;
  background: linear-gradient(
    115deg,
    rgba(71, 214, 196, 0.9),
    rgba(155, 140, 255, 0.75) 35%,
    rgba(232, 163, 61, 0.6) 60%,
    rgba(71, 214, 196, 0.9)
  );
  background-size: 260% 260%;
  animation: gnav-border-flow 9s ease infinite;
  box-shadow: 0 12px 44px rgba(0, 0, 0, 0.45);
}
@keyframes gnav-border-flow {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
@media (prefers-reduced-motion: reduce) {
  .gnav-border { animation: none; }
}

.gnav {
  pointer-events: auto;
  position: relative;
  width: 100%;
  display: flex;
  align-items: center;
  gap: clamp(10px, 2.4vw, 22px);
  flex-wrap: wrap;
  padding: 8px 10px 8px 16px;
  border-radius: 999px;
  background: rgba(11, 13, 16, 0.86);
  backdrop-filter: blur(18px) saturate(160%);
  -webkit-backdrop-filter: blur(18px) saturate(160%);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
  overflow: hidden;
}

/* Soft animated glow sweeping behind the pill for extra polish */
.gnav-glow {
  position: absolute;
  inset: -40% -10%;
  z-index: 0;
  pointer-events: none;
  background: conic-gradient(
    from 0deg,
    transparent 0deg,
    rgba(71, 214, 196, 0.16) 60deg,
    transparent 140deg,
    rgba(155, 140, 255, 0.14) 220deg,
    transparent 300deg,
    transparent 360deg
  );
  animation: gnav-spin 14s linear infinite;
  opacity: 0.9;
}
@keyframes gnav-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) {
  .gnav-glow { animation: none; }
}

.gnav-brand {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  margin-right: auto;
  padding-left: 2px;
  transition: transform 0.18s ease;
}
.gnav-brand:hover { transform: translateY(-1px); }
.gnav-mark {
  position: relative;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 14px rgba(71, 214, 196, 0.45);
}
.gnav-mark-ring {
  position: absolute;
  inset: -3px;
  border-radius: 50%;
  background: conic-gradient(
    from 0deg,
    var(--nv-signal),
    var(--nv-violet),
    var(--nv-amber),
    var(--nv-signal)
  );
  -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 1.5px));
  mask: radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 1.5px));
  animation: gnav-spin 6s linear infinite;
}
.gnav-mark-inner {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--nv-signal), var(--nv-violet));
  color: #061412;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--nv-font-display);
  font-weight: 700;
  font-size: 13px;
}
.gnav-brand-text { display: flex; flex-direction: column; line-height: 1.1; }
.gnav-title {
  font-family: var(--nv-font-display);
  font-weight: 700;
  font-size: 12.5px;
  letter-spacing: 0.08em;
  color: var(--nv-text);
  white-space: nowrap;
}
.gnav-sub {
  font-family: var(--nv-font-mono);
  font-size: 9px;
  color: var(--nv-text-faint);
  white-space: nowrap;
}

.gnav-links {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 2px;
  flex-wrap: wrap;
  background: rgba(255, 255, 255, 0.025);
  border: 1px solid rgba(255, 255, 255, 0.03);
  border-radius: 999px;
  padding: 3px;
}
.gnav-link {
  font-family: var(--nv-font-body);
  font-weight: 500;
  font-size: 13px;
  color: var(--nv-text-dim);
  text-decoration: none;
  padding: 7px 13px;
  border-radius: 999px;
  transition: color 0.15s ease, background 0.15s ease;
  white-space: nowrap;
}
.gnav-link:hover { color: var(--nv-text); background: rgba(255, 255, 255, 0.06); }
.gnav-link-active {
  color: #061412;
  background: linear-gradient(135deg, var(--nv-signal), #6fe2d4);
  font-weight: 600;
}

.gnav-right {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.gnav-status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: var(--nv-font-mono);
  font-size: 10px;
  letter-spacing: 0.1em;
  color: var(--nv-text-faint);
}
.gnav-live-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--nv-signal);
  box-shadow: 0 0 8px var(--nv-signal);
  animation: gnav-pulse 1.8s infinite;
}
@keyframes gnav-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
@media (prefers-reduced-motion: reduce) {
  .gnav-live-dot { animation: none; }
}

/* ---------------- Standout "Join Community" CTA ---------------- */
.gnav-cta {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  text-decoration: none;
  white-space: nowrap;
  font-family: var(--nv-font-display);
  font-weight: 700;
  font-size: 14px;
  letter-spacing: 0.01em;
  color: #061412;
  padding: 11px 22px;
  border-radius: 999px;
  background: linear-gradient(135deg, var(--nv-signal), var(--nv-violet) 130%);
  box-shadow:
    0 4px 18px rgba(71, 214, 196, 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 0.35);
  transition: transform 0.18s ease, box-shadow 0.18s ease, filter 0.18s ease;
}
.gnav-cta-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #061412;
  opacity: 0.7;
  animation: gnav-pulse 1.8s infinite;
}
.gnav-cta-arrow {
  transition: transform 0.18s ease;
}
.gnav-cta:hover .gnav-cta-arrow { transform: translate(2px, -2px); }
.gnav-cta:hover {
  transform: translateY(-2px) scale(1.03);
  box-shadow:
    0 8px 26px rgba(71, 214, 196, 0.5),
    inset 0 1px 0 rgba(255, 255, 255, 0.4);
  filter: brightness(1.05);
}
.gnav-cta:active { transform: translateY(0) scale(0.99); }
.gnav-cta-active {
  outline: 2px solid rgba(255, 255, 255, 0.55);
  outline-offset: 2px;
}

.app-main { flex: 1; }

.app-footer {
  background: var(--nv-panel);
  border-top: 1px solid var(--nv-hairline);
  padding: 24px;
  text-align: center;
  font-family: var(--nv-font-mono);
  font-size: 12px;
  color: var(--nv-text-faint);
}

/* Tablet: wrap links onto their own row under the brand/status */
@media (max-width: 900px) {
  .gnav { border-radius: 24px; justify-content: center; }
  .gnav-brand { margin-right: 0; flex: 1; }
  .gnav-links { order: 3; width: 100%; justify-content: center; }
  .gnav-right { order: 2; }
}

@media (max-width: 480px) {
  .gnav-sub { display: none; }
  .gnav-status { display: none; }
  .gnav-link { padding: 6px 10px; font-size: 12px; }
  .gnav-cta { padding: 9px 16px; font-size: 13px; }
}
`;