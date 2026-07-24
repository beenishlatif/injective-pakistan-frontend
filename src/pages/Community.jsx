/**
 * Community.jsx
 * ------------------------------------------------------------------
 * Full-page "Community Hub" for the Injective Pakistan website.
 * Introduces the community, why-join benefits, a "how to join"
 * walkthrough, featured members, upcoming events, and resource links.
 *
 * Render as a full page/route (e.g. /community), not as a widget.
 * Visually matches AIAssistant.jsx (same dark palette, Space
 * Grotesk / Inter / IBM Plex Mono type system, teal signal accent +
 * amber highlight) so the two pages feel like one product.
 * ------------------------------------------------------------------
 */

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

const JOIN_STEPS = [
  {
    title: "Say hello on Telegram",
    body: "Open the group and introduce yourself — one line on whether you trade, build, or both.",
  },
  {
    title: "Get matched to a working group",
    body: "A team member routes you to the Traders, Builders, or Research channel based on what you're doing.",
  },
  {
    title: "Show up to the next meetup",
    body: "Join an AMA, workshop, or city meetup — most people make their first real connection there.",
  },
];

const RESOURCE_LINKS = [
  { label: "Injective Docs", href: "https://docs.injective.network" },
  { label: "Injective Hub", href: "https://hub.injective.network" },
  { label: "Injective on X", href: "https://twitter.com/Injective" },
];

export default function Community() {
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
              <a
                className="ch-btn ch-btn-primary"
                href="https://t.me"
                target="_blank"
                rel="noreferrer"
              >
                Open Telegram
              </a>
              <a className="ch-btn ch-btn-ghost" href="https://t.me" target="_blank" rel="noreferrer">
                Join the Telegram group
              </a>
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

        {/* ---------------- How to join ---------------- */}
        <section className="ch-section">
          <div className="ch-section-head">
            <span className="ch-section-eyebrow">Getting in</span>
            <h2 className="ch-section-title">Three steps, no gatekeeping</h2>
          </div>
          <div className="ch-steps">
            {JOIN_STEPS.map((s, i) => (
              <div className="ch-step" key={s.title}>
                <div className="ch-step-marker">
                  <span>{i + 1}</span>
                </div>
                {i < JOIN_STEPS.length - 1 && <span className="ch-step-connector" />}
                <h3 className="ch-step-title">{s.title}</h3>
                <p className="ch-step-body">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ---------------- Resources / CTA ---------------- */}
        <section className="ch-section ch-cta-section">
          <div className="ch-cta-inner">
            <span className="ch-section-eyebrow">Get involved</span>
            <h2 className="ch-section-title">Come say hello</h2>
            <p className="ch-join-sub">
              The fastest way in is Telegram — introduce yourself, tell us what you're
              trading or building, and someone from the team will point you to the right
              working group.
            </p>
            <a
              className="ch-btn ch-btn-primary"
              href="https://t.me"
              target="_blank"
              rel="noreferrer"
            >
              Open Telegram
            </a>
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

function EmptyState({ icon, title, body, actionLabel, actionHref }) {
  return (
    <div className="ch-empty">
      <div className="ch-empty-icon">
        <EmptyIcon name={icon} />
      </div>
      <h3 className="ch-empty-title">{title}</h3>
      <p className="ch-empty-body">{body}</p>
      {actionLabel && actionHref && (
        <a className="ch-empty-action" href={actionHref} target="_blank" rel="noreferrer">
          {actionLabel}
          <ArrowIcon />
        </a>
      )}
    </div>
  );
}

function EmptyIcon({ name }) {
  const common = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6 };
  if (name === "calendar") {
    return (
      <svg {...common}>
        <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
        <path d="M3.5 9.5h17" strokeLinecap="round" />
        <path d="M8 3v3.5M16 3v3.5" strokeLinecap="round" />
        <path d="M8 13.5h.01M12 13.5h.01M16 13.5h.01M8 17h.01M12 17h.01" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="9" cy="9" r="3.3" />
      <path d="M3.5 19.5c0-3.3 2.5-5.8 5.5-5.8s5.5 2.5 5.5 5.8" strokeLinecap="round" />
      <circle cx="17" cy="8" r="2.4" opacity="0.6" />
      <path d="M20.5 18.8c-.15-2.5-1.6-4.4-3.6-5" strokeLinecap="round" opacity="0.6" />
    </svg>
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
.ch-btn:focus-visible { outline: 2px solid var(--nv-signal); outline-offset: 2px; }
.ch-btn-primary { background: var(--nv-signal); color: #061412; border-color: var(--nv-signal); }
.ch-btn-primary:hover { background: #5be3d1; }
.ch-btn-ghost { background: transparent; color: var(--nv-text); border-color: var(--nv-hairline); }
.ch-btn-ghost:hover { border-color: var(--nv-signal); color: var(--nv-signal); background: var(--nv-signal-dim); }

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
.ch-pillar { background: var(--nv-panel); padding: 26px 24px; transition: background 0.15s ease; }
.ch-pillar:hover { background: #10141a; }
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

/* ---------------- How to join steps ---------------- */
.ch-steps {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 28px;
}
.ch-step { position: relative; padding-top: 4px; }
.ch-step-marker {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--nv-panel);
  border: 1px solid var(--nv-signal);
  color: var(--nv-signal);
  font-family: var(--nv-font-mono);
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 18px;
  position: relative;
  z-index: 1;
}
.ch-step-connector {
  position: absolute;
  top: 17px;
  left: 34px;
  width: calc(100% - 34px + 28px);
  height: 1px;
  background: var(--nv-hairline);
}
.ch-step-title {
  font-family: var(--nv-font-display);
  font-weight: 700;
  font-size: 15.5px;
  margin: 0 0 8px;
  color: var(--nv-text);
}
.ch-step-body { font-size: 13px; line-height: 1.6; color: var(--nv-text-dim); margin: 0; }

/* ---------------- Featured members ---------------- */
.ch-members-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  gap: 16px;
}
.ch-member-card {
  border: 1px solid var(--nv-hairline);
  border-radius: 10px;
  padding: 22px 20px;
  background: rgba(255, 255, 255, 0.012);
  transition: border-color 0.15s ease, transform 0.15s ease;
}
.ch-member-card:hover { border-color: var(--nv-signal); transform: translateY(-2px); }
.ch-member-avatar {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--nv-amber-dim);
  color: var(--nv-amber);
  border: 1px solid var(--nv-hairline);
  font-family: var(--nv-font-mono);
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 14px;
}
.ch-member-name {
  font-family: var(--nv-font-display);
  font-weight: 700;
  font-size: 15px;
  margin: 0 0 4px;
  color: var(--nv-text);
}
.ch-member-role {
  display: block;
  font-family: var(--nv-font-mono);
  font-size: 10.5px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--nv-signal);
  margin-bottom: 2px;
}
.ch-member-city {
  display: block;
  font-size: 12px;
  color: var(--nv-text-faint);
  margin-bottom: 10px;
}
.ch-member-bio { font-size: 13px; line-height: 1.6; color: var(--nv-text-dim); margin: 0; }

/* ---------------- Events ---------------- */
.ch-events-list { display: flex; flex-direction: column; gap: 1px; background: var(--nv-hairline); border: 1px solid var(--nv-hairline); border-radius: 10px; overflow: hidden; }
.ch-event-row { display: flex; gap: 18px; padding: 20px 22px; background: var(--nv-panel); align-items: flex-start; transition: background 0.15s ease; }
.ch-event-row:hover { background: #10141a; }
.ch-event-date {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 56px;
  padding: 8px 4px;
  border-radius: 8px;
  background: var(--nv-signal-dim);
  border: 1px solid var(--nv-hairline);
}
.ch-event-day { font-family: var(--nv-font-display); font-weight: 700; font-size: 18px; color: var(--nv-text); line-height: 1.1; }
.ch-event-month { font-family: var(--nv-font-mono); font-size: 10px; letter-spacing: 0.08em; color: var(--nv-signal); }
.ch-event-title { font-family: var(--nv-font-display); font-weight: 700; font-size: 15.5px; margin: 0 0 6px; color: var(--nv-text); }
.ch-event-desc { font-size: 13px; line-height: 1.6; color: var(--nv-text-dim); margin: 0 0 8px; }
.ch-event-meta { display: flex; gap: 14px; font-family: var(--nv-font-mono); font-size: 11px; color: var(--nv-text-faint); }

/* ---------------- Empty states ---------------- */
.ch-empty {
  border: 1px dashed var(--nv-hairline);
  border-radius: 10px;
  padding: clamp(32px, 5vw, 48px) clamp(20px, 5vw, 40px);
  text-align: center;
  max-width: 480px;
  margin: 0 auto;
  background: rgba(255, 255, 255, 0.012);
}
.ch-empty-icon {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--nv-signal-dim);
  color: var(--nv-signal);
  border: 1px solid var(--nv-hairline);
  margin: 0 auto 18px;
}
.ch-empty-title {
  font-family: var(--nv-font-display);
  font-weight: 700;
  font-size: 15.5px;
  margin: 0 0 8px;
  color: var(--nv-text);
}
.ch-empty-body {
  font-size: 13px;
  line-height: 1.65;
  color: var(--nv-text-dim);
  margin: 0 0 20px;
}
.ch-empty-action {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-family: var(--nv-font-mono);
  font-size: 11.5px;
  font-weight: 500;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--nv-signal);
  text-decoration: none;
  border: 1px solid var(--nv-hairline);
  background: var(--nv-signal-dim);
  padding: 10px 16px;
  border-radius: 7px;
  transition: border-color 0.15s ease, transform 0.15s ease;
}
.ch-empty-action:hover { border-color: var(--nv-signal); transform: translateY(-1px); }

/* ---------------- Skeleton loading ---------------- */
.ch-skeleton {
  position: relative;
  overflow: hidden;
  background: var(--nv-panel);
  min-height: 120px;
  border: 1px solid var(--nv-hairline);
}
.ch-skeleton::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.04), transparent);
  animation: ch-shimmer 1.4s infinite;
}
@keyframes ch-shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }

/* ---------------- CTA / Resources ---------------- */
.ch-cta-section { border-bottom: none; }
.ch-cta-inner { max-width: 560px; }
.ch-join-sub { font-size: 14px; line-height: 1.7; color: var(--nv-text-dim); margin: 16px 0 24px; max-width: 460px; }
.ch-resource-list { display: flex; flex-direction: column; gap: 4px; margin-top: 28px; }
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
  .ch-skeleton::after { animation: none !important; }
}

/* ---------------- Responsive ---------------- */
@media (max-width: 720px) {
  .ch-steps { grid-template-columns: 1fr; gap: 30px; }
  .ch-step-connector { display: none; }
}
@media (max-width: 560px) {
  .ch-hero-actions { flex-direction: column; align-items: stretch; }
  .ch-event-row { flex-direction: column; }
  .ch-footer { flex-direction: column; gap: 6px; align-items: flex-start; }
}
`;