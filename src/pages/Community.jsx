/**
 * Community.jsx
 * ------------------------------------------------------------------
 * Full-page "Community Hub" for the Injective Pakistan website.
 * Introduces the community, shows live stats, why-join benefits,
 * and a join form.
 *
 * Render as a full page/route (e.g. /community), not as a widget.
 * Visually matches AIAssistant.jsx (same dark palette, Space
 * Grotesk / Inter / IBM Plex Mono type system, teal signal accent +
 * amber highlight) so the two pages feel like one product.
 *
 * Data comes from the community module backend:
 *   GET  /api/community/stats
 *   GET  /api/community/members/featured
 *   GET  /api/community/events
 *   POST /api/community/join
 *
 * Props:
 *   apiBaseUrl?: string — defaults to the live backend origin (see
 *   DEFAULT_API_BASE_URL below). If the frontend and backend are
 *   ever deployed on the SAME domain (e.g. Vercel rewrites/proxy is
 *   set up), you can override this back to '' so calls stay
 *   same-origin instead.
 * ------------------------------------------------------------------
 */

import { useState, useEffect, useCallback } from "react";

// ---------------- API base URL ----------------
// The frontend and backend are deployed on two different Vercel
// domains, so same-origin ("") fetches to /api/community/... were
// hitting the FRONTEND's own domain (which has no such route) and
// getting back Vercel's HTML "page not found" response instead of
// JSON — hence the data not loading after deployment even though it
// worked locally. Pointing this at the actual backend origin fixes
// that (same fix already applied in Home.jsx).
const DEFAULT_API_BASE_URL = "https://injective-pakistan-backend-2gbb.vercel.app";

const PILLARS = [
  {
    title: "Trade",
    body: "On-chain order books, perps and spot markets — learn the mechanics from traders who use them daily.",
  },
  {
    title: "Build",
    body: "Ship on Injective's iBuild and CosmWasm/EVM stack, with local devs who've shipped before to review your work.",
  },
  {
    title: "Learn",
    body: "Urdu and English AMAs, workshops and explainers that take you from first wallet to first trade to first deploy.",
  },
];

const BENEFITS = [
  {
    title: "Verified, vetted community",
    body: "Every member is manually reviewed before they get access — no bots, no noise, just real traders and builders.",
    icon: "shield",
  },
  {
    title: "Direct mentor access",
    body: "Ask questions in Urdu or English and get answers from people who've actually shipped on-chain, not generic support.",
    icon: "bolt",
  },
  {
    title: "Private working groups",
    body: "Separate channels for traders, builders and researchers so the conversation stays focused and useful.",
    icon: "layers",
  },
  {
    title: "Early access",
    body: "First look at new Injective tooling, testnets and local events before they're announced publicly.",
    icon: "compass",
  },
];

const RESOURCE_LINKS = [
  { label: "Injective Docs", href: "https://docs.injective.network" },
  { label: "Injective Hub", href: "https://hub.injective.network" },
  { label: "Injective on X", href: "https://twitter.com/Injective" },
];

function initials(name) {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

function formatEventDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { day: "--", month: "---", full: "" };
  return {
    day: date.toLocaleDateString([], { day: "2-digit" }),
    month: date.toLocaleDateString([], { month: "short" }).toUpperCase(),
    full: date.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric", year: "numeric" }),
    time: date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  };
}

export default function Community({ apiBaseUrl = DEFAULT_API_BASE_URL }) {
  const [stats, setStats] = useState(null);
  const [members, setMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [events, setEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(true);

  const [form, setForm] = useState({
    name: "",
    email: "",
    city: "",
    telegramHandle: "",
    bio: "",
  });
  const [formStatus, setFormStatus] = useState("idle"); // idle | submitting | success | error
  const [formError, setFormError] = useState("");

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/community/stats`);
      const data = await res.json();
      if (res.ok && data.success) setStats(data.stats);
    } catch (err) {
      console.error("Failed to load community stats:", err);
    }
  }, [apiBaseUrl]);

  const fetchMembers = useCallback(async () => {
    setMembersLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/community/members/featured`);
      const data = await res.json();
      if (res.ok && data.success) setMembers(data.members);
    } catch (err) {
      console.error("Failed to load featured members:", err);
    } finally {
      setMembersLoading(false);
    }
  }, [apiBaseUrl]);

  const fetchEvents = useCallback(async () => {
    setEventsLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/community/events`);
      const data = await res.json();
      if (res.ok && data.success) setEvents(data.events);
    } catch (err) {
      console.error("Failed to load events:", err);
    } finally {
      setEventsLoading(false);
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    fetchStats();
    fetchMembers();
    fetchEvents();
  }, [fetchStats, fetchMembers, fetchEvents]);

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleJoinSubmit(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) {
      setFormStatus("error");
      setFormError("Name and email are required.");
      return;
    }
    setFormStatus("submitting");
    setFormError("");
    try {
      const res = await fetch(`${apiBaseUrl}/api/community/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Something went wrong.");
      }
      setFormStatus("success");
      setForm({ name: "", email: "", city: "", telegramHandle: "", bio: "" });
      fetchStats();
    } catch (err) {
      setFormStatus("error");
      setFormError(err.message || "Couldn't submit your request. Please try again.");
    }
  }

  const statEntries = [
    { label: "Members", value: stats?.members },
    { label: "Cities", value: stats?.cities },
    { label: "Meetups", value: stats?.events },
  ];

  return (
    <>
      <style>{STYLES}</style>

      <div className="ch-page">
        {/* ---------------- Hero ---------------- */}
        <section className="ch-hero">
          <div className="ch-hero-inner">
            <div className="ch-eyebrow">
              <span className="ch-live-dot" />
              INJECTIVE PAKISTAN &middot; COMMUNITY HUB
            </div>
            <h1 className="ch-hero-title">
              The desk where Pakistan
              <br />
              builds on Injective.
            </h1>
            <p className="ch-hero-sub">
              Traders, builders and researchers across the country, in one room. On-chain
              order books, real deployments, and a community that answers in Urdu and English.
            </p>

            <div className="ch-hero-actions">
              <a className="ch-btn ch-btn-primary" href="#join">
                Join the community
              </a>
              <a
                className="ch-btn ch-btn-ghost"
                href="https://t.me"
                target="_blank"
                rel="noreferrer"
              >
                Open Telegram
              </a>
            </div>

            <div className="ch-stat-row">
              {statEntries.map((s) => (
                <div className="ch-stat" key={s.label}>
                  <span className="ch-stat-value">
                    {s.value === undefined || s.value === null ? "—" : s.value}
                  </span>
                  <span className="ch-stat-label">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------- Pillars ---------------- */}
        <section className="ch-section">
          <div className="ch-section-head">
            <span className="ch-section-eyebrow">What happens here</span>
            <h2 className="ch-section-title">Three reasons people stay</h2>
          </div>
          <div className="ch-pillars">
            {PILLARS.map((p, i) => (
              <div className="ch-pillar" key={p.title}>
                <span className="ch-pillar-index">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="ch-pillar-title">{p.title}</h3>
                <p className="ch-pillar-body">{p.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ---------------- Why join / Benefits ---------------- */}
        <section className="ch-section">
          <div className="ch-section-head">
            <span className="ch-section-eyebrow">Why join</span>
            <h2 className="ch-section-title">Built to actually be useful</h2>
          </div>
          <div className="ch-benefits-grid">
            {BENEFITS.map((b) => (
              <div className="ch-benefit-card" key={b.title}>
                <div className="ch-benefit-icon">
                  <BenefitIcon name={b.icon} />
                </div>
                <h3 className="ch-benefit-title">{b.title}</h3>
                <p className="ch-benefit-body">{b.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ---------------- Join form ---------------- */}
        <section className="ch-section ch-join-section" id="join">
          <div className="ch-join-grid">
            <div>
              <span className="ch-section-eyebrow">Get involved</span>
              <h2 className="ch-section-title">Join the community</h2>
              <p className="ch-join-sub">
                Tell us a little about yourself. Approved members get listed here and invited
                to the private groups, workshops and meetups.
              </p>
              <div className="ch-resource-list">
                {RESOURCE_LINKS.map((r) => (
                  <a
                    className="ch-resource-link"
                    key={r.label}
                    href={r.href}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ArrowIcon />
                    <span>{r.label}</span>
                  </a>
                ))}
              </div>
            </div>

            <form className="ch-form" onSubmit={handleJoinSubmit}>
              <div className="ch-form-row">
                <label className="ch-field">
                  <span>Name *</span>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => updateField("name", e.target.value)}
                    placeholder="Your full name"
                    required
                  />
                </label>
                <label className="ch-field">
                  <span>Email *</span>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => updateField("email", e.target.value)}
                    placeholder="you@example.com"
                    required
                  />
                </label>
              </div>

              <div className="ch-form-row">
                <label className="ch-field">
                  <span>City</span>
                  <input
                    type="text"
                    value={form.city}
                    onChange={(e) => updateField("city", e.target.value)}
                    placeholder="Lahore, Karachi, Islamabad…"
                  />
                </label>
                <label className="ch-field">
                  <span>Telegram handle</span>
                  <input
                    type="text"
                    value={form.telegramHandle}
                    onChange={(e) => updateField("telegramHandle", e.target.value)}
                    placeholder="@yourhandle"
                  />
                </label>
              </div>

              <label className="ch-field">
                <span>What brings you here?</span>
                <textarea
                  rows={3}
                  value={form.bio}
                  onChange={(e) => updateField("bio", e.target.value)}
                  placeholder="Trader, builder, researcher — tell us in a line or two."
                />
              </label>

              <button
                type="submit"
                className="ch-btn ch-btn-primary ch-form-submit"
                disabled={formStatus === "submitting"}
              >
                {formStatus === "submitting" ? "Submitting…" : "Request to join"}
              </button>

              {formStatus === "success" && (
                <p className="ch-form-note ch-form-note-success">
                  Request received — we'll be in touch shortly.
                </p>
              )}
              {formStatus === "error" && (
                <p className="ch-form-note ch-form-note-error">{formError}</p>
              )}
            </form>
          </div>
        </section>

        {/* ---------------- Footer ---------------- */}
        <footer className="ch-footer">
          <span>Injective Pakistan &middot; Community Hub</span>
          <span className="ch-footer-dim">Built on Injective</span>
        </footer>
      </div>
    </>
  );
}

function ArrowIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M7 17L17 7M17 7H9M17 7V15" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BenefitIcon({ name }) {
  const common = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8 };
  switch (name) {
    case "shield":
      return (
        <svg {...common}>
          <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" strokeLinejoin="round" />
          <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "bolt":
      return (
        <svg {...common}>
          <path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" strokeLinejoin="round" />
        </svg>
      );
    case "layers":
      return (
        <svg {...common}>
          <path d="M12 3l9 5-9 5-9-5 9-5z" strokeLinejoin="round" />
          <path d="M3 13l9 5 9-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "compass":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M14.5 9.5L13 13l-3.5 1.5L11 11l3.5-1.5z" strokeLinejoin="round" />
        </svg>
      );
    default:
      return null;
  }
}

// ---------------- Self-contained styles ----------------
// Reuses the same design tokens as AIAssistant.jsx (--nv-*) so both
// pages read as one product, with a "ch-" (Community Hub) class
// prefix to avoid collisions when both components are mounted.
const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap');

:root {
  --nv-bg: #0b0d10;
  --nv-panel: #0d1013;
  --nv-sidebar: #08090b;
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
}

.ch-page {
  width: 100%;
  min-height: 100vh;
  background: var(--nv-bg);
  color: var(--nv-text);
  font-family: var(--nv-font-body);
  overflow-x: hidden;
}

/* ---------------- Hero ---------------- */
.ch-hero {
  border-bottom: 1px solid var(--nv-hairline);
  padding: clamp(56px, 10vw, 108px) clamp(20px, 8vw, 160px) clamp(48px, 7vw, 80px);
  background:
    radial-gradient(60% 55% at 15% 0%, var(--nv-signal-dim), transparent 60%),
    radial-gradient(45% 40% at 100% 10%, var(--nv-amber-dim), transparent 60%);
}
.ch-hero-inner { max-width: 760px; }
.ch-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-family: var(--nv-font-mono);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.14em;
  color: var(--nv-signal);
  border: 1px solid var(--nv-hairline);
  background: var(--nv-signal-dim);
  padding: 6px 12px;
  border-radius: 999px;
  margin-bottom: 22px;
}
.ch-live-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--nv-signal);
  animation: ch-live 1.8s infinite;
}
@keyframes ch-live { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }

.ch-hero-title {
  font-family: var(--nv-font-display);
  font-weight: 700;
  font-size: clamp(32px, 5.2vw, 54px);
  line-height: 1.08;
  letter-spacing: -0.015em;
  margin: 0 0 20px;
  color: var(--nv-text);
}
.ch-hero-sub {
  font-size: clamp(14.5px, 1.6vw, 16.5px);
  line-height: 1.7;
  color: var(--nv-text-dim);
  max-width: 560px;
  margin: 0 0 32px;
}

.ch-hero-actions { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 44px; }
.ch-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-family: var(--nv-font-mono);
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  text-decoration: none;
  padding: 13px 22px;
  border-radius: 7px;
  cursor: pointer;
  border: 1px solid transparent;
  transition: transform 0.15s ease, border-color 0.15s ease, background 0.15s ease, color 0.15s ease;
}
.ch-btn:hover { transform: translateY(-1px); }
.ch-btn-primary { background: var(--nv-signal); color: #061412; border-color: var(--nv-signal); }
.ch-btn-primary:hover { background: #5be3d1; }
.ch-btn-ghost { background: transparent; color: var(--nv-text); border-color: var(--nv-hairline); }
.ch-btn-ghost:hover { border-color: var(--nv-signal); color: var(--nv-signal); background: var(--nv-signal-dim); }

.ch-stat-row { display: flex; gap: clamp(28px, 5vw, 56px); flex-wrap: wrap; }
.ch-stat { display: flex; flex-direction: column; gap: 4px; }
.ch-stat-value {
  font-family: var(--nv-font-display);
  font-weight: 700;
  font-size: 28px;
  color: var(--nv-text);
}
.ch-stat-label {
  font-family: var(--nv-font-mono);
  font-size: 10.5px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--nv-text-faint);
}

/* ---------------- Sections ---------------- */
.ch-section {
  padding: clamp(48px, 7vw, 80px) clamp(20px, 8vw, 160px);
  border-bottom: 1px solid var(--nv-hairline);
}
.ch-section-head { max-width: 640px; margin-bottom: 34px; }
.ch-section-eyebrow {
  display: block;
  font-family: var(--nv-font-mono);
  font-size: 10.5px;
  font-weight: 500;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--nv-amber);
  margin-bottom: 10px;
}
.ch-section-title {
  font-family: var(--nv-font-display);
  font-weight: 700;
  font-size: clamp(22px, 3vw, 30px);
  letter-spacing: -0.01em;
  margin: 0;
  color: var(--nv-text);
}
.ch-muted { color: var(--nv-text-faint); font-size: 13.5px; }

/* ---------------- Pillars ---------------- */
.ch-pillars {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1px;
  background: var(--nv-hairline);
  border: 1px solid var(--nv-hairline);
  border-radius: 10px;
  overflow: hidden;
}
.ch-pillar { background: var(--nv-panel); padding: 26px 24px; }
.ch-pillar-index {
  display: block;
  font-family: var(--nv-font-mono);
  font-size: 11px;
  color: var(--nv-text-faint);
  margin-bottom: 14px;
}
.ch-pillar-title {
  font-family: var(--nv-font-display);
  font-size: 17px;
  font-weight: 700;
  margin: 0 0 8px;
  color: var(--nv-text);
}
.ch-pillar-body { font-size: 13.5px; line-height: 1.65; color: var(--nv-text-dim); margin: 0; }

/* ---------------- Benefits ---------------- */
.ch-benefits-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
  gap: 16px;
}
.ch-benefit-card {
  border: 1px solid var(--nv-hairline);
  border-radius: 10px;
  padding: 24px 22px;
  background: rgba(255, 255, 255, 0.012);
  transition: border-color 0.15s ease, transform 0.15s ease;
}
.ch-benefit-card:hover { border-color: var(--nv-signal); transform: translateY(-2px); }
.ch-benefit-icon {
  width: 40px;
  height: 40px;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--nv-signal-dim);
  color: var(--nv-signal);
  border: 1px solid var(--nv-hairline);
  margin-bottom: 16px;
}
.ch-benefit-title {
  font-family: var(--nv-font-display);
  font-weight: 700;
  font-size: 15.5px;
  margin: 0 0 8px;
  color: var(--nv-text);
}
.ch-benefit-body { font-size: 13px; line-height: 1.6; color: var(--nv-text-dim); margin: 0; }

/* ---------------- Join section ---------------- */
.ch-join-section { border-bottom: none; }
.ch-join-grid {
  display: grid;
  grid-template-columns: 1fr 1.15fr;
  gap: clamp(32px, 6vw, 72px);
  align-items: start;
}
.ch-join-sub { font-size: 14px; line-height: 1.7; color: var(--nv-text-dim); margin: 16px 0 26px; max-width: 420px; }
.ch-resource-list { display: flex; flex-direction: column; gap: 4px; }
.ch-resource-link {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  color: var(--nv-text-dim);
  text-decoration: none;
  font-size: 13.5px;
  padding: 9px 4px;
  border-bottom: 1px solid var(--nv-hairline-soft);
  transition: color 0.15s ease;
}
.ch-resource-link svg { color: var(--nv-text-faint); transition: transform 0.15s ease, color 0.15s ease; }
.ch-resource-link:hover { color: var(--nv-signal); }
.ch-resource-link:hover svg { color: var(--nv-signal); transform: translate(1px, -1px); }

.ch-form {
  border: 1px solid var(--nv-hairline);
  border-radius: 12px;
  padding: 28px;
  background: rgba(255, 255, 255, 0.012);
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.ch-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.ch-field { display: flex; flex-direction: column; gap: 7px; font-size: 12.5px; color: var(--nv-text-dim); }
.ch-field span { font-family: var(--nv-font-mono); font-size: 10.5px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--nv-text-faint); }
.ch-field input,
.ch-field textarea {
  background: var(--nv-bg);
  border: 1px solid var(--nv-hairline);
  border-radius: 7px;
  color: var(--nv-text);
  padding: 11px 12px;
  font-family: var(--nv-font-body);
  font-size: 13.5px;
  outline: none;
  resize: vertical;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.ch-field input::placeholder,
.ch-field textarea::placeholder { color: var(--nv-text-faint); }
.ch-field input:focus,
.ch-field textarea:focus { border-color: var(--nv-signal); box-shadow: 0 0 0 3px var(--nv-signal-dim); }

.ch-form-submit { align-self: flex-start; margin-top: 4px; }
.ch-form-submit:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
.ch-form-note { font-size: 12.5px; margin: 0; font-family: var(--nv-font-mono); }
.ch-form-note-success { color: var(--nv-signal); }
.ch-form-note-error { color: var(--nv-danger); }

/* ---------------- Footer ---------------- */
.ch-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px clamp(20px, 8vw, 160px) 34px;
  font-family: var(--nv-font-mono);
  font-size: 11px;
  letter-spacing: 0.06em;
  color: var(--nv-text-faint);
}
.ch-footer-dim { color: var(--nv-hairline); }

@media (prefers-reduced-motion: reduce) {
  .ch-live-dot { animation: none !important; opacity: 1 !important; }
}

/* ---------------- Responsive ---------------- */
@media (max-width: 860px) {
  .ch-join-grid { grid-template-columns: 1fr; }
}
@media (max-width: 560px) {
  .ch-form-row { grid-template-columns: 1fr; }
  .ch-hero-actions { flex-direction: column; align-items: stretch; }
  .ch-stat-row { gap: 28px; }
  .ch-footer { flex-direction: column; gap: 6px; align-items: flex-start; }
}
`;