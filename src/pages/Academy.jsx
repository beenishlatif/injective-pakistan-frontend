/**
 * Academy.jsx
 * ------------------------------------------------------------------
 * Injective Pakistan Academy — structured learning hub.
 *
 * Sections:
 *   1. Hero (thesis statement + live "next up" snapshot card — the
 *      snapshot card is this page's own signature element, so it no
 *      longer shares its exact silhouette with Home.jsx's hero)
 *   2. Live academy stats strip (learners / certificates / tracks — 3,
 *      evenly balanced columns, now padded to match the rest of the page)
 *   3. Learning Path (signature timeline — each track expands to reveal
 *      its modules)
 *   4. On-chain Certificates (labeled clearly as a sample preview — the
 *      card shown is illustrative, not a real learner's credential,
 *      unless real completed-enrollment data is available, in which
 *      case it shows the most recent real one)
 *   5. Quick Reference (glossary, now with a category tag per term and
 *      two more entries so the grid fills evenly)
 *   6. Built in the Open (how the curriculum is written & reviewed)
 *   7. Who's Learning (NEW — real enrolled-learner list from the API)
 *   8. FAQ (accordion)
 *   9. Ask Nova banner
 *  10. Enroll CTA (captures name + email, posts to the backend, then
 *      refreshes the "Who's Learning" table and stats on success)
 *  11. Footer
 *
 * Backend contract (Node/Express/MongoDB):
 *   GET  /api/academy/stats        -> live academy stats snapshot
 *   GET  /api/academy/tracks       -> learning tracks + modules, in order
 *   GET  /api/academy/enrollments  -> recent enrolled learners (masked email)
 *   POST /api/academy/enroll       -> { name, email, trackSlug } -> enrolls a learner
 *
 * Props:
 *   apiBaseUrl?: string — defaults to the live backend origin. If the
 *   frontend and backend are ever deployed on the SAME domain (e.g.
 *   Vercel rewrites/proxy is set up), you can override this back to
 *   '' so calls stay same-origin instead.
 * ------------------------------------------------------------------
 */

import { useState, useEffect, useCallback, useMemo } from "react";

// ---------------- API base URL ----------------
// The frontend and backend are deployed on two different Vercel
// domains, so same-origin ("") fetches to /api/academy/... were hitting
// the FRONTEND's own domain (which has no such route) and getting back
// Vercel's HTML "page not found" response instead of JSON — hence the
// "Unexpected token '<'... is not valid JSON" errors. Pointing this at
// the actual backend origin fixes that (same pattern as Home.jsx).
const DEFAULT_API_BASE_URL = "https://injective-pakistan-backend-2gbb.vercel.app";

// ---------------- Fallback data (shown instantly, replaced once the API responds) ----------------
const FALLBACK_STATS = {
  learnersEnrolled: null,
  certificatesIssued: null,
  tracksLive: null,
};

// Full learning path. Order matters here — this genuinely is a sequence,
// each track builds on the last, so the numbered/step treatment in the UI
// is meaningful rather than decorative.
const FALLBACK_TRACKS = [
  {
    slug: "foundations",
    step: 1,
    level: "Foundations",
    title: "How Injective Works",
    description:
      "The mental model every other track builds on: what a Layer-1 order book chain is, how Injective differs from Ethereum L2s, and why it exists.",
    durationHours: 3,
    modules: [
      { title: "Blockchains, in plain terms", minutes: 12 },
      { title: "Injective vs. Ethereum L2s", minutes: 15 },
      { title: "Wallets: Keplr & MetaMask setup", minutes: 18 },
      { title: "Reading a block explorer", minutes: 14 },
    ],
  },
  {
    slug: "trader",
    step: 2,
    level: "Trader Track",
    title: "Trading On-Chain Order Books",
    description:
      "Move from spectator to participant: place your first trade on Helix, understand order types, and manage risk on a fully on-chain exchange.",
    durationHours: 4,
    modules: [
      { title: "Spot vs. perpetual markets", minutes: 16 },
      { title: "Order book mechanics on Helix", minutes: 20 },
      { title: "Placing market & limit orders", minutes: 18 },
      { title: "Position sizing & risk basics", minutes: 22 },
    ],
  },
  {
    slug: "builder",
    step: 3,
    level: "Builder Track",
    title: "Shipping on Injective",
    description:
      "For developers: spin up a local environment, understand the module system, and deploy a working contract to testnet.",
    durationHours: 6,
    modules: [
      { title: "Dev environment & CLI setup", minutes: 20 },
      { title: "Injective's module architecture", minutes: 25 },
      { title: "Writing your first contract", minutes: 35 },
      { title: "Testnet deployment walkthrough", minutes: 28 },
    ],
  },
  {
    slug: "validator",
    step: 4,
    level: "Advanced",
    title: "Staking & Validator Economics",
    description:
      "How consensus, delegation, and the weekly burn auction fit together — and what it takes to run or delegate to a validator responsibly.",
    durationHours: 3,
    modules: [
      { title: "Proof-of-stake on Injective", minutes: 14 },
      { title: "Choosing a validator to delegate to", minutes: 16 },
      { title: "Unstaking periods & slashing risk", minutes: 12 },
      { title: "Inside the burn auction", minutes: 18 },
    ],
  },
];

// Real, factual terms — not curriculum marketing copy — so this section
// actually answers "what does that word mean" the moment it comes up.
// Eight terms (two full rows on desktop) with a category tag each, so
// the grid reads as complete rather than half-filled.
const GLOSSARY = [
  {
    term: "INJ",
    category: "Token",
    definition: "Injective's native token — used for gas, staking, governance votes, and the weekly burn auction.",
  },
  {
    term: "Helix",
    category: "Exchange",
    definition: "The flagship on-chain order book exchange built on Injective, used throughout the Trader track.",
  },
  {
    term: "Burn Auction",
    category: "Tokenomics",
    definition: "A weekly auction where protocol fees are used to buy back INJ, which is then permanently destroyed.",
  },
  {
    term: "Staking",
    category: "Network",
    definition: "Locking INJ with a validator to help secure the network in exchange for a share of rewards.",
  },
  {
    term: "IBC",
    category: "Interoperability",
    definition: "Inter-Blockchain Communication — the protocol Injective uses to move assets between Cosmos chains.",
  },
  {
    term: "Testnet",
    category: "Development",
    definition: "A practice version of the network with no real value at stake — where the Builder track's exercises run.",
  },
  {
    term: "Delegator",
    category: "Network",
    definition: "Anyone who stakes INJ with a validator instead of running their own — most delegators never run a node.",
  },
  {
    term: "Slashing",
    category: "Security",
    definition: "A penalty that burns part of a validator's (and its delegators') stake for downtime or misbehavior.",
  },
];

// The actual process behind the curriculum: written and reviewed in the
// open on GitHub. This replaces a set of fabricated "mentor" bios that
// don't correspond to real people — the steps below are a genuine
// sequence, which is why they're numbered.
const PROCESS_STEPS = [
  {
    step: 1,
    title: "Drafted on GitHub",
    body: "Any community member can open a pull request proposing a new module, a correction, or a rewrite of something unclear.",
  },
  {
    step: 2,
    title: "Reviewed in the open",
    body: "Changes are discussed and reviewed publicly on the repository before merging — nothing ships without visible review.",
  },
  {
    step: 3,
    title: "Published to the path",
    body: "Once merged, the update goes live on this page immediately. There's no separate editorial team gatekeeping releases.",
  },
];

const FAQS = [
  {
    q: "Is this official Injective content?",
    a: "No — Injective Pakistan is a community-run hub, not affiliated with Injective Labs. Content is written by community contributors and reviewed in the open on GitHub.",
  },
  {
    q: "Do I need any crypto experience to start?",
    a: "No. The Foundations track assumes zero prior experience and starts with what a wallet even is.",
  },
  {
    q: "Are the tracks free, and do I need to hold INJ?",
    a: "The entire Academy is free with no paid tier. You don't need to hold or spend INJ to complete any track — the Trader and Builder tracks use testnet, not real funds.",
  },
  {
    q: "How does the on-chain certificate work?",
    a: "When you finish a track's final module, a completion credential is minted to your wallet address — a permanent, publicly verifiable record you control. A wallet is only needed at that final step, not to start learning.",
  },
  {
    q: "Can I skip ahead to the Builder track?",
    a: "You can, but each track assumes the vocabulary from the one before it. Skipping Foundations usually means backtracking later.",
  },
  {
    q: "What if a guide doesn't answer my question?",
    a: "Ask Nova, the sitewide AI assistant, or raise it directly on the GitHub repository — most gaps in the curriculum started as exactly that kind of question.",
  },
];

// ---------------- Formatting helpers ----------------
function formatCompact(value) {
  if (value === null || value === undefined) return "—";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return `${value}`;
}

function totalMinutes(track) {
  return track.modules.reduce((sum, m) => sum + m.minutes, 0);
}

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function Academy({ apiBaseUrl = DEFAULT_API_BASE_URL }) {
  const [stats, setStats] = useState(FALLBACK_STATS);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState(false);

  const [tracks, setTracks] = useState(FALLBACK_TRACKS);
  const [tracksLoading, setTracksLoading] = useState(true);

  // Real enrolled learners, for the "Who's Learning" table and to back
  // the on-chain certificate preview with a real example when one exists.
  const [learners, setLearners] = useState([]);
  const [learnersLoading, setLearnersLoading] = useState(true);
  const [learnersError, setLearnersError] = useState(false);

  // Which track is expanded in the learning-path timeline. Foundations
  // (index 0) starts open since it's the natural entry point.
  const [openTrack, setOpenTrack] = useState("foundations");
  // Which FAQ item is expanded, if any.
  const [openFaq, setOpenFaq] = useState(null);
  const [mounted, setMounted] = useState(false);

  // Enrollment form state.
  const [form, setForm] = useState({ name: "", email: "", trackSlug: "foundations" });
  const [submitState, setSubmitState] = useState("idle"); // idle | submitting | success | error
  const [submitMessage, setSubmitMessage] = useState("");

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    setStatsError(false);
    try {
      const res = await fetch(`${apiBaseUrl}/api/academy/stats`);
      const data = await res.json();
      if (res.ok && data.success) {
        setStats(data.stats);
      } else {
        setStatsError(true);
      }
    } catch (err) {
      console.error("Failed to load academy stats:", err);
      setStatsError(true);
    } finally {
      setStatsLoading(false);
    }
  }, [apiBaseUrl]);

  const loadTracks = useCallback(async () => {
    setTracksLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/academy/tracks`);
      const data = await res.json();
      if (res.ok && data.success && data.tracks?.length) {
        setTracks(data.tracks);
      }
    } catch (err) {
      console.error("Failed to load academy tracks:", err);
      // keep fallback tracks on failure
    } finally {
      setTracksLoading(false);
    }
  }, [apiBaseUrl]);

  const loadLearners = useCallback(async () => {
    setLearnersLoading(true);
    setLearnersError(false);
    try {
      const res = await fetch(`${apiBaseUrl}/api/academy/enrollments?limit=20`);
      const data = await res.json();
      if (res.ok && data.success) {
        setLearners(data.learners || []);
      } else {
        setLearnersError(true);
      }
    } catch (err) {
      console.error("Failed to load enrolled learners:", err);
      setLearnersError(true);
    } finally {
      setLearnersLoading(false);
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    setMounted(true);
    loadStats();
    loadTracks();
    loadLearners();
  }, [loadStats, loadTracks, loadLearners]);

  const activeTracks = tracksLoading ? FALLBACK_TRACKS : tracks;

  const totalCurriculumHours = useMemo(
    () => activeTracks.reduce((sum, t) => sum + t.durationHours, 0),
    [activeTracks]
  );

  // The most recent real completed learner, if the API has one — used to
  // make the certificate card show an actual example instead of only a
  // hardcoded placeholder.
  const latestCertificate = useMemo(
    () => learners.find((l) => l.completed) || null,
    [learners]
  );

  async function handleEnroll(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) return;
    setSubmitState("submitting");
    setSubmitMessage("");
    try {
      const res = await fetch(`${apiBaseUrl}/api/academy/enroll`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSubmitState("success");
        setSubmitMessage(data.message || "You're in — check your inbox for the first module.");
        setForm({ name: "", email: "", trackSlug: form.trackSlug });
        // Reflect the new signup immediately in the live stats + table.
        loadStats();
        loadLearners();
      } else {
        setSubmitState("error");
        setSubmitMessage(data.message || "Something went wrong. Please try again.");
      }
    } catch (err) {
      console.error("Enrollment failed:", err);
      setSubmitState("error");
      setSubmitMessage("Couldn't reach the server. Check your connection and try again.");
    }
  }

  // Exactly three stats, evenly balanced — no dangling empty column.
  const statItems = [
    {
      label: "Learners Enrolled",
      value: statsLoading ? "…" : formatCompact(stats.learnersEnrolled),
      icon: <UsersIcon />,
    },
    {
      label: "Certificates Issued",
      value: statsLoading ? "…" : formatCompact(stats.certificatesIssued),
      icon: <CertificateIcon />,
    },
    {
      label: "Tracks Live",
      value: statsLoading ? "…" : formatCompact(stats.tracksLive ?? activeTracks.length),
      icon: <LayersIcon />,
    },
  ];

  return (
    <>
      <style>{STYLES}</style>

      <div className={`ac-page ${mounted ? "ac-mounted" : ""}`}>
        {/* ---------------- Hero ---------------- */}
        <section className="ac-hero">
          <div className="ac-hero-ledger" aria-hidden="true" />
          <div className="ac-hero-inner">
            <div className="ac-hero-copy">
              <div className="ac-eyebrow">
                <span className="ac-live-dot" />
                <span>INJECTIVE PK / ACADEMY</span>
              </div>
              <h1 className="ac-hero-title">
                Four tracks. Zero cost.
                <br />
                One clear path to fluent.
              </h1>
              <p className="ac-hero-sub">
                A free, structured curriculum for going from "what is a wallet" to
                shipping contracts and delegating stake — in an order that actually
                makes sense, with a verifiable credential at the end of every track.
              </p>
              <div className="ac-hero-actions">
                <a className="ac-btn ac-btn-primary" href="#enroll">
                  Start Foundations
                  <ChevronIcon />
                </a>
                <a className="ac-btn ac-btn-ghost" href="#path">
                  See the full path
                </a>
              </div>
            </div>

            {/* Signature element: a live "next up" snapshot, not a stat block —
                this is what makes the Academy hero read differently from the
                Home page hero while using the same token set. */}
            <div className="ac-hero-snapshot" aria-hidden="true">
              <span className="ac-snapshot-label">UP NEXT · STEP 01</span>
              <span className="ac-snapshot-title">{FALLBACK_TRACKS[0].title}</span>
              <div className="ac-snapshot-modules">
                {FALLBACK_TRACKS[0].modules.slice(0, 3).map((m, i) => (
                  <div className="ac-snapshot-row" key={m.title}>
                    <span className="ac-snapshot-check">{i === 0 ? "●" : "○"}</span>
                    <span className="ac-snapshot-mtitle">{m.title}</span>
                    <span className="ac-snapshot-mmin">{m.minutes}m</span>
                  </div>
                ))}
              </div>
              <div className="ac-snapshot-foot">
                <span>{FALLBACK_TRACKS[0].modules.length} modules</span>
                <span>~{FALLBACK_TRACKS[0].durationHours}h total</span>
              </div>
            </div>
          </div>
        </section>

        {/* ---------------- Live stats strip ---------------- */}
        <section className="ac-stats-wrap">
          <div className="ac-stats-strip" aria-label="Live academy stats">
            {statItems.map((item) => (
              <div className="ac-stat-item" key={item.label}>
                <span className="ac-stat-icon">{item.icon}</span>
                <div className="ac-stat-text">
                  <span className="ac-stat-value">{item.value}</span>
                  <span className="ac-stat-label">{item.label}</span>
                </div>
              </div>
            ))}
            {statsError && (
              <button className="ac-retry" onClick={loadStats}>
                Retry
              </button>
            )}
          </div>
        </section>

        {/* ---------------- Learning Path (signature element) ---------------- */}
        <section className="ac-section" id="path">
          <div className="ac-section-head">
            <span className="ac-section-eyebrow">CURRICULUM / IN ORDER</span>
            <h2 className="ac-section-title">The Learning Path</h2>
            <p className="ac-section-body">
              {activeTracks.length} tracks, roughly {totalCurriculumHours} hours end to
              end. Each one unlocks the vocabulary the next one assumes — tap a track to
              see its modules.
            </p>
          </div>

          <div className="ac-timeline">
            {activeTracks.map((track, i) => {
              const isOpen = openTrack === track.slug;
              const isLast = i === activeTracks.length - 1;
              return (
                <div className={`ac-tl-row ${isOpen ? "ac-tl-open" : ""}`} key={track.slug}>
                  <div className="ac-tl-rail">
                    <span className="ac-tl-node">{track.step}</span>
                    {!isLast && <span className="ac-tl-line" />}
                  </div>

                  <div className="ac-tl-card">
                    <button
                      className="ac-tl-header"
                      onClick={() => setOpenTrack(isOpen ? null : track.slug)}
                      aria-expanded={isOpen}
                    >
                      <div className="ac-tl-header-text">
                        <span className="ac-tl-level">{track.level}</span>
                        <h3 className="ac-tl-title">{track.title}</h3>
                        <p className="ac-tl-desc">{track.description}</p>
                        <div className="ac-tl-meta">
                          <span>{track.modules.length} modules</span>
                          <span className="ac-tl-dot">•</span>
                          <span>~{track.durationHours}h</span>
                        </div>
                      </div>
                      <span className={`ac-tl-toggle ${isOpen ? "ac-tl-toggle-open" : ""}`}>
                        <ChevronDownIcon />
                      </span>
                    </button>

                    {isOpen && (
                      <div className="ac-tl-modules">
                        {track.modules.map((m, mi) => (
                          <div className="ac-module-row" key={m.title}>
                            <span className="ac-module-index">
                              {String(mi + 1).padStart(2, "0")}
                            </span>
                            <span className="ac-module-title">{m.title}</span>
                            <span className="ac-module-minutes">{m.minutes} min</span>
                          </div>
                        ))}
                        <div className="ac-tl-footer">
                          <span className="ac-tl-footer-total">
                            {totalMinutes(track)} minutes total
                          </span>
                          <a className="ac-tl-cta" href="#enroll">
                            Enroll in {track.level}
                            <ChevronIcon />
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ---------------- On-chain certificates ---------------- */}
        <section className="ac-section ac-cert-section">
          <div className="ac-cert-copy">
            <span className="ac-section-eyebrow ac-eyebrow-violet">CREDENTIALS / ON-CHAIN</span>
            <h2 className="ac-section-title">A certificate you actually own</h2>
            <p className="ac-section-body">
              Finish a track's last module and a completion credential is minted to your
              wallet address. It isn't a PDF someone can lose or fake — it's a permanent,
              publicly verifiable record, visible on any Injective block explorer.
            </p>
            <ul className="ac-cert-points">
              <li>Tied to your wallet, not an email you might abandon</li>
              <li>Verifiable by anyone — no login, no institution to call</li>
              <li>One credential per track, four to collect on the full path</li>
            </ul>
          </div>

          <div className="ac-cert-card" aria-hidden="true">
            <div className="ac-cert-card-top">
              <span className="ac-cert-badge">
                {latestCertificate ? "REAL · MOST RECENT" : "SAMPLE PREVIEW"}
              </span>
              <span className="ac-cert-chain">Injective</span>
            </div>
            <div className="ac-cert-body">
              <span className="ac-cert-label">Certificate of Completion</span>
              <span className="ac-cert-track">
                {latestCertificate
                  ? latestCertificate.trackTitle || latestCertificate.trackLabel
                  : "Foundations — How Injective Works"}
              </span>
              <span className="ac-cert-recipient">
                issued to {latestCertificate ? latestCertificate.name : "inj1••••••••••••q7x9"}
              </span>
            </div>
            <div className="ac-cert-card-bottom">
              <span className="ac-cert-hash">
                {latestCertificate ? formatDate(latestCertificate.completedAt) : "tx 0x8f2a…c471"}
              </span>
              <span className="ac-cert-date">
                {latestCertificate ? "Real learner record" : "Illustrative example only"}
              </span>
            </div>
          </div>
        </section>

        {/* ---------------- Quick Reference / Glossary ---------------- */}
        <section className="ac-section">
          <div className="ac-section-head">
            <span className="ac-section-eyebrow">REFERENCE / KEY TERMS</span>
            <h2 className="ac-section-title">Words you'll see everywhere</h2>
            <p className="ac-section-body">
              Short, exact definitions for the terms the curriculum uses without
              re-explaining every time.
            </p>
          </div>
          <div className="ac-glossary-grid">
            {GLOSSARY.map((g) => (
              <div className="ac-glossary-card" key={g.term}>
                <div className="ac-glossary-head">
                  <span className="ac-glossary-term">{g.term}</span>
                  <span className="ac-glossary-tag">{g.category}</span>
                </div>
                <p className="ac-glossary-def">{g.definition}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ---------------- Built in the open ---------------- */}
        <section className="ac-section">
          <div className="ac-section-head">
            <span className="ac-section-eyebrow">CURRICULUM / MAINTAINED IN THE OPEN</span>
            <h2 className="ac-section-title">Built in the open, not by a name-brand faculty</h2>
            <p className="ac-section-body">
              There's no hidden editorial team. Every module on this page went through
              the same three-step process, in public, and anyone can be part of it.
            </p>
          </div>

          <div className="ac-process-grid">
            {PROCESS_STEPS.map((p) => (
              <div className="ac-process-card" key={p.step}>
                <span className="ac-process-step">{String(p.step).padStart(2, "0")}</span>
                <h3 className="ac-process-title">{p.title}</h3>
                <p className="ac-process-body">{p.body}</p>
              </div>
            ))}
          </div>

          <a
            className="ac-btn ac-btn-ghost ac-process-cta"
            href="https://github.com"
            target="_blank"
            rel="noreferrer"
          >
            Contribute on GitHub
            <ChevronIcon />
          </a>
        </section>

        {/* ---------------- Who's Learning (real enrolled learners) ---------------- */}
        <section className="ac-section">
          <div className="ac-section-head">
            <span className="ac-section-eyebrow">COMMUNITY / LIVE</span>
            <h2 className="ac-section-title">Who's learning right now</h2>
            <p className="ac-section-body">
              The most recent people to join the Academy. Emails are partially hidden —
              this is a public page, not an admin panel.
            </p>
          </div>

          <div className="ac-learners-table-wrap">
            <table className="ac-learners-table">
              <thead>
                <tr>
                  <th>Learner</th>
                  <th>Track</th>
                  <th>Enrolled</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {learnersLoading && (
                  <tr>
                    <td colSpan={4} className="ac-learners-empty">
                      Loading learners…
                    </td>
                  </tr>
                )}

                {!learnersLoading && learnersError && (
                  <tr>
                    <td colSpan={4} className="ac-learners-empty">
                      Couldn't load learners.{" "}
                      <button className="ac-inline-retry" onClick={loadLearners}>
                        Retry
                      </button>
                    </td>
                  </tr>
                )}

                {!learnersLoading && !learnersError && learners.length === 0 && (
                  <tr>
                    <td colSpan={4} className="ac-learners-empty">
                      No one has enrolled yet — be the first to start a track.
                    </td>
                  </tr>
                )}

                {!learnersLoading &&
                  !learnersError &&
                  learners.map((l, i) => (
                    <tr key={`${l.name}-${l.email}-${i}`}>
                      <td>
                        <span className="ac-learner-name">{l.name}</span>
                        <span className="ac-learner-email">{l.email}</span>
                      </td>
                      <td>{l.trackLabel}</td>
                      <td>{formatDate(l.enrolledAt)}</td>
                      <td>
                        <span className={`ac-status-pill ${l.completed ? "ac-status-done" : ""}`}>
                          {l.completed ? "Certified" : "In progress"}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ---------------- FAQ ---------------- */}
        <section className="ac-section">
          <div className="ac-section-head">
            <span className="ac-section-eyebrow">QUESTIONS</span>
            <h2 className="ac-section-title">Before you start</h2>
          </div>
          <div className="ac-faq-list">
            {FAQS.map((f, i) => {
              const isOpen = openFaq === i;
              return (
                <div className={`ac-faq-item ${isOpen ? "ac-faq-open" : ""}`} key={f.q}>
                  <button
                    className="ac-faq-question"
                    onClick={() => setOpenFaq(isOpen ? null : i)}
                    aria-expanded={isOpen}
                  >
                    <span>{f.q}</span>
                    <span className={`ac-faq-toggle ${isOpen ? "ac-faq-toggle-open" : ""}`}>
                      <ChevronDownIcon />
                    </span>
                  </button>
                  {isOpen && <p className="ac-faq-answer">{f.a}</p>}
                </div>
              );
            })}
          </div>
        </section>

        {/* ---------------- Ask Nova banner ---------------- */}
        <section className="ac-nova-banner">
          <div className="ac-nova-text">
            <span className="ac-live-dot" />
            <div>
              <h3 className="ac-nova-title">Still have a question about Injective Pakistan?</h3>
              <p className="ac-nova-sub">
                Nova, the sitewide AI assistant, can answer anything else — tokenomics,
                the ecosystem map, or how a specific module works.
              </p>
            </div>
          </div>
          <a className="ac-btn ac-btn-primary" href="/ai-assistant">
            Ask Nova
            <ChevronIcon />
          </a>
        </section>

        {/* ---------------- Enroll CTA ---------------- */}
        <section className="ac-section ac-enroll-section" id="enroll">
          <div className="ac-enroll-copy">
            <span className="ac-section-eyebrow">GET STARTED</span>
            <h2 className="ac-section-title">Pick a track, start today</h2>
            <p className="ac-section-body">
              Drop your name and email and we'll send you straight into your chosen
              track, plus a nudge when the next module unlocks.
            </p>
          </div>

          <form className="ac-enroll-form" onSubmit={handleEnroll}>
            <label className="ac-field">
              <span className="ac-field-label">Name</span>
              <input
                className="ac-input"
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Your name"
                required
              />
            </label>
            <label className="ac-field">
              <span className="ac-field-label">Email</span>
              <input
                className="ac-input"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="you@example.com"
                required
              />
            </label>
            <label className="ac-field">
              <span className="ac-field-label">Starting track</span>
              <select
                className="ac-input ac-select"
                value={form.trackSlug}
                onChange={(e) => setForm((f) => ({ ...f, trackSlug: e.target.value }))}
              >
                {activeTracks.map((t) => (
                  <option key={t.slug} value={t.slug}>
                    {t.level} — {t.title}
                  </option>
                ))}
              </select>
            </label>

            <button className="ac-btn ac-btn-primary ac-submit" type="submit" disabled={submitState === "submitting"}>
              {submitState === "submitting" ? "Enrolling…" : "Enroll for free"}
              <ChevronIcon />
            </button>

            {submitState === "success" && (
              <p className="ac-form-status ac-form-success">{submitMessage}</p>
            )}
            {submitState === "error" && (
              <p className="ac-form-status ac-form-error">{submitMessage}</p>
            )}
          </form>
        </section>

        {/* ---------------- Footer ---------------- */}
        <footer className="ac-footer">
          <div className="ac-footer-top">
            <div className="ac-footer-brand">
              <span className="ac-footer-mark">N</span>
              <span className="ac-footer-title">INJECTIVE PK ACADEMY</span>
            </div>
            <p className="ac-footer-tagline">
              Community-built. Not affiliated with Injective Labs. Free, forever.
            </p>
          </div>
          <div className="ac-footer-bottom">
            <span>© {new Date().getFullYear()} Injective Pakistan Academy</span>
            <span>Part of the Injective Pakistan Hub.</span>
          </div>
        </footer>
      </div>
    </>
  );
}

// ---------------- Icons ----------------
function ChevronIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 6L15 12L9 18" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function ChevronDownIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 9L12 15L18 9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function UsersIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="10" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" strokeLinecap="round" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" />
    </svg>
  );
}
function CertificateIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="12" cy="8" r="6" />
      <path d="M9 13.5 7 22l5-3 5 3-2-8.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function LayersIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M12 2 2 7l10 5 10-5-10-5Z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2 17l10 5 10-5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ---------------- Self-contained styles ----------------
// Reuses the --nv-* token set from Home.jsx for site-wide consistency, and
// adds one new accent (--nv-violet) scoped to the certificate section.
const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap');

.ac-page {
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
  --nv-violet: #9b8cff;
  --nv-violet-dim: rgba(155, 140, 255, 0.1);
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
.ac-page.ac-mounted { opacity: 1; transform: translateY(0); }
.ac-page * { box-sizing: border-box; }
.ac-page :focus-visible { outline: 2px solid var(--nv-signal); outline-offset: 2px; }

.ac-live-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--nv-signal);
  animation: ac-live 1.8s infinite;
  flex-shrink: 0;
  display: inline-block;
}
@keyframes ac-live { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }

/* ---------------- Hero ---------------- */
.ac-hero {
  position: relative;
  padding: clamp(56px, 9vw, 96px) clamp(14px, 6vw, 96px) clamp(40px, 6vw, 60px);
  overflow: hidden;
}
/* Ledger-line backdrop (thin horizontal rules, like rows waiting to be
   filled) instead of the Home page's dot-grid — a small but deliberate
   difference that also nods to "credentials as records". */
.ac-hero-ledger {
  position: absolute;
  inset: 0;
  background-image: repeating-linear-gradient(
    to bottom,
    rgba(71, 214, 196, 0.09) 0px,
    rgba(71, 214, 196, 0.09) 1px,
    transparent 1px,
    transparent 34px
  );
  -webkit-mask-image: radial-gradient(ellipse 65% 75% at 15% 10%, #000 0%, transparent 78%);
  mask-image: radial-gradient(ellipse 65% 75% at 15% 10%, #000 0%, transparent 78%);
  pointer-events: none;
}
.ac-hero-inner {
  position: relative;
  display: grid;
  grid-template-columns: 1.25fr 0.9fr;
  gap: clamp(28px, 5vw, 56px);
  align-items: center;
  max-width: 1080px;
}
.ac-hero-copy { max-width: 560px; }
.ac-eyebrow {
  display: inline-flex; align-items: center; gap: 8px;
  font-family: var(--nv-font-mono); font-size: 11px; letter-spacing: 0.1em;
  color: var(--nv-signal);
  border: 1px solid var(--nv-hairline);
  background: var(--nv-signal-dim);
  padding: 7px 12px;
  border-radius: 999px;
  margin-bottom: 22px;
}
.ac-eyebrow-violet { color: var(--nv-violet); background: var(--nv-violet-dim); }
.ac-hero-title {
  font-family: var(--nv-font-display);
  font-weight: 700;
  font-size: clamp(28px, 4.4vw, 48px);
  line-height: 1.14;
  letter-spacing: -0.015em;
  margin: 0 0 20px;
  color: var(--nv-text);
}
.ac-hero-sub {
  font-size: clamp(14px, 1.8vw, 16px);
  line-height: 1.7;
  color: var(--nv-text-dim);
  margin: 0 0 32px;
}
.ac-hero-actions { display: flex; gap: 12px; flex-wrap: wrap; }
.ac-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  font-family: var(--nv-font-body); font-weight: 600; font-size: 14px;
  text-decoration: none;
  padding: 13px 20px;
  border-radius: 8px;
  border: 1px solid transparent;
  cursor: pointer;
  transition: transform 0.15s ease, opacity 0.15s ease, border-color 0.15s ease, background 0.15s ease;
}
.ac-btn svg { transition: transform 0.15s ease; }
.ac-btn:hover svg { transform: translateX(2px); }
.ac-btn-primary { background: var(--nv-signal); color: #061412; }
.ac-btn-primary:hover { opacity: 0.88; }
.ac-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.ac-btn-ghost { border-color: var(--nv-hairline); color: var(--nv-text); background: transparent; }
.ac-btn-ghost:hover { border-color: var(--nv-signal); background: var(--nv-signal-dim); }

/* Hero signature element: a live "what's first" snapshot card */
.ac-hero-snapshot {
  background: var(--nv-panel);
  border: 1px solid var(--nv-hairline);
  border-radius: 14px;
  padding: clamp(18px, 2.4vw, 24px);
  display: flex; flex-direction: column; gap: 16px;
  min-width: 0;
}
.ac-snapshot-label {
  font-family: var(--nv-font-mono); font-size: 10.5px; letter-spacing: 0.08em;
  color: var(--nv-amber);
}
.ac-snapshot-title { font-family: var(--nv-font-display); font-weight: 700; font-size: 18px; }
.ac-snapshot-modules { display: flex; flex-direction: column; gap: 10px; }
.ac-snapshot-row {
  display: flex; align-items: center; gap: 10px;
  font-size: 13px; color: var(--nv-text-dim);
}
.ac-snapshot-check { color: var(--nv-signal); font-size: 10px; flex-shrink: 0; }
.ac-snapshot-mtitle { flex: 1; min-width: 0; }
.ac-snapshot-mmin { font-family: var(--nv-font-mono); font-size: 11.5px; color: var(--nv-text-faint); flex-shrink: 0; }
.ac-snapshot-foot {
  display: flex; justify-content: space-between; gap: 10px;
  padding-top: 14px; border-top: 1px solid var(--nv-hairline-soft);
  font-family: var(--nv-font-mono); font-size: 11px; color: var(--nv-text-faint);
}

/* ---------------- Stats strip (3, evenly balanced, properly padded) ---------------- */
.ac-stats-wrap {
  padding: 0 clamp(14px, 6vw, 96px);
  margin-bottom: clamp(12px, 2vw, 20px);
}
.ac-stats-strip {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  position: relative;
  border: 1px solid var(--nv-hairline);
  border-radius: 12px;
  overflow: hidden;
  max-width: 1080px;
  margin: 0 auto;
}
.ac-stat-item {
  display: flex; align-items: center; gap: 14px;
  background: var(--nv-panel);
  padding: clamp(20px, 2.6vw, 26px) clamp(20px, 3vw, 30px);
  border-right: 1px solid var(--nv-hairline-soft);
  min-width: 0;
}
.ac-stat-item:last-child { border-right: none; }
.ac-stat-icon {
  width: 40px; height: 40px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  border-radius: 9px;
  background: var(--nv-signal-dim);
  color: var(--nv-signal);
  border: 1px solid var(--nv-hairline);
}
.ac-stat-text { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.ac-stat-value { font-family: var(--nv-font-display); font-weight: 700; font-size: clamp(20px, 2.6vw, 26px); color: var(--nv-text); line-height: 1; }
.ac-stat-label { font-family: var(--nv-font-mono); font-size: 10.5px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--nv-text-faint); }
.ac-retry {
  position: absolute; top: 10px; right: 14px;
  font-family: var(--nv-font-mono); font-size: 11px;
  background: var(--nv-danger-dim); color: var(--nv-danger);
  border: 1px solid rgba(229, 100, 95, 0.3);
  padding: 6px 10px; border-radius: 6px; cursor: pointer;
}

/* ---------------- Sections ---------------- */
.ac-section { padding: clamp(44px, 7vw, 88px) clamp(14px, 6vw, 96px); border-bottom: 1px solid var(--nv-hairline-soft); }
.ac-section-head { margin-bottom: 32px; max-width: 640px; }
.ac-section-eyebrow {
  display: inline-block;
  font-family: var(--nv-font-mono); font-size: 11px; letter-spacing: 0.1em;
  color: var(--nv-text-faint);
  margin-bottom: 10px;
}
.ac-section-title {
  font-family: var(--nv-font-display); font-weight: 700;
  font-size: clamp(22px, 2.8vw, 32px);
  letter-spacing: -0.01em;
  margin: 0 0 12px;
  color: var(--nv-text);
}
.ac-section-body { font-size: 14.5px; line-height: 1.75; color: var(--nv-text-dim); margin: 0; }

/* ---------------- Timeline (signature element) ---------------- */
.ac-timeline { display: flex; flex-direction: column; max-width: 780px; }
.ac-tl-row { display: flex; gap: clamp(14px, 3vw, 22px); }
.ac-tl-rail { display: flex; flex-direction: column; align-items: center; flex-shrink: 0; }
.ac-tl-node {
  width: 34px; height: 34px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-family: var(--nv-font-display); font-weight: 700; font-size: 13px;
  border: 1px solid var(--nv-hairline);
  background: var(--nv-panel);
  color: var(--nv-text-dim);
  flex-shrink: 0;
  transition: border-color 0.2s ease, color 0.2s ease, background 0.2s ease;
}
.ac-tl-open .ac-tl-node { border-color: var(--nv-signal); color: var(--nv-signal); background: var(--nv-signal-dim); }
.ac-tl-line { width: 1px; flex: 1; background: var(--nv-hairline); min-height: 20px; }
.ac-tl-card { flex: 1; padding-bottom: clamp(20px, 3vw, 30px); min-width: 0; }
.ac-tl-header {
  width: 100%;
  display: flex; align-items: flex-start; gap: 14px;
  text-align: left;
  background: var(--nv-panel);
  border: 1px solid var(--nv-hairline);
  border-radius: 10px;
  padding: 18px clamp(16px, 3vw, 22px);
  cursor: pointer;
  color: inherit;
  font: inherit;
  transition: border-color 0.15s ease;
}
.ac-tl-open .ac-tl-header { border-color: var(--nv-signal); }
.ac-tl-header:hover { border-color: var(--nv-signal); }
.ac-tl-header-text { flex: 1; min-width: 0; }
.ac-tl-level { font-family: var(--nv-font-mono); font-size: 10.5px; letter-spacing: 0.08em; color: var(--nv-amber); text-transform: uppercase; }
.ac-tl-title { font-family: var(--nv-font-display); font-weight: 700; font-size: clamp(16px, 2vw, 19px); margin: 6px 0 8px; }
.ac-tl-desc { font-size: 13px; line-height: 1.65; color: var(--nv-text-dim); margin: 0 0 10px; }
.ac-tl-meta { display: flex; align-items: center; gap: 8px; font-family: var(--nv-font-mono); font-size: 11.5px; color: var(--nv-text-faint); }
.ac-tl-dot { opacity: 0.6; }
.ac-tl-toggle { flex-shrink: 0; color: var(--nv-text-faint); transition: transform 0.2s ease, color 0.2s ease; margin-top: 2px; }
.ac-tl-toggle-open { transform: rotate(180deg); color: var(--nv-signal); }

.ac-tl-modules {
  margin-top: 10px;
  background: var(--nv-panel);
  border: 1px solid var(--nv-hairline-soft);
  border-radius: 10px;
  padding: 8px clamp(14px, 3vw, 20px);
}
.ac-module-row {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid var(--nv-hairline-soft);
}
.ac-module-row:last-of-type { border-bottom: none; }
.ac-module-index { font-family: var(--nv-font-mono); font-size: 11px; color: var(--nv-text-faint); flex-shrink: 0; }
.ac-module-title { font-size: 13.5px; color: var(--nv-text); flex: 1; min-width: 0; }
.ac-module-minutes { font-family: var(--nv-font-mono); font-size: 11.5px; color: var(--nv-text-faint); flex-shrink: 0; }
.ac-tl-footer {
  display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;
  padding: 14px 0 10px;
}
.ac-tl-footer-total { font-family: var(--nv-font-mono); font-size: 11.5px; color: var(--nv-text-faint); }
.ac-tl-cta {
  display: inline-flex; align-items: center; gap: 6px;
  font-family: var(--nv-font-mono); font-size: 12px; letter-spacing: 0.03em;
  color: var(--nv-signal); text-decoration: none;
}
.ac-tl-cta:hover { text-decoration: underline; }

/* ---------------- Certificate section ---------------- */
.ac-cert-section { display: grid; grid-template-columns: 1.1fr 0.9fr; gap: clamp(28px, 5vw, 48px); align-items: center; }
.ac-cert-points { list-style: none; margin: 18px 0 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.ac-cert-points li {
  position: relative; padding-left: 20px;
  font-size: 13.5px; line-height: 1.6; color: var(--nv-text-dim);
}
.ac-cert-points li::before {
  content: ""; position: absolute; left: 0; top: 7px;
  width: 6px; height: 6px; border-radius: 50%; background: var(--nv-violet);
}
.ac-cert-card {
  background: linear-gradient(160deg, var(--nv-panel) 0%, #12101c 100%);
  border: 1px solid rgba(155, 140, 255, 0.28);
  border-radius: 14px;
  padding: clamp(20px, 3vw, 26px);
  display: flex; flex-direction: column; gap: 22px;
  min-width: 0;
  box-shadow: 0 0 0 1px rgba(155, 140, 255, 0.04), 0 20px 50px -20px rgba(155, 140, 255, 0.25);
}
.ac-cert-card-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.ac-cert-badge {
  font-family: var(--nv-font-mono); font-size: 10px; letter-spacing: 0.08em;
  color: var(--nv-violet); background: var(--nv-violet-dim);
  border: 1px solid rgba(155, 140, 255, 0.3);
  padding: 5px 10px; border-radius: 999px;
}
.ac-cert-chain { font-family: var(--nv-font-mono); font-size: 11px; color: var(--nv-text-faint); }
.ac-cert-body { display: flex; flex-direction: column; gap: 8px; }
.ac-cert-label { font-family: var(--nv-font-mono); font-size: 10.5px; letter-spacing: 0.06em; color: var(--nv-text-faint); text-transform: uppercase; }
.ac-cert-track { font-family: var(--nv-font-display); font-weight: 700; font-size: clamp(16px, 2vw, 19px); color: var(--nv-text); }
.ac-cert-recipient { font-family: var(--nv-font-mono); font-size: 12px; color: var(--nv-text-dim); }
.ac-cert-card-bottom {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  padding-top: 16px; border-top: 1px solid rgba(155, 140, 255, 0.16);
  font-family: var(--nv-font-mono); font-size: 11px; color: var(--nv-text-faint);
}

/* ---------------- Glossary ---------------- */
.ac-glossary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 1px; background: var(--nv-hairline); border: 1px solid var(--nv-hairline); border-radius: 10px; overflow: hidden; }
.ac-glossary-card { background: var(--nv-panel); padding: 18px 20px; display: flex; flex-direction: column; gap: 8px; }
.ac-glossary-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.ac-glossary-term { font-family: var(--nv-font-mono); font-size: 12.5px; font-weight: 600; letter-spacing: 0.04em; color: var(--nv-signal); }
.ac-glossary-tag {
  font-family: var(--nv-font-mono); font-size: 9.5px; letter-spacing: 0.06em; text-transform: uppercase;
  color: var(--nv-text-faint);
  border: 1px solid var(--nv-hairline-soft);
  padding: 3px 7px; border-radius: 999px;
  flex-shrink: 0;
}
.ac-glossary-def { font-size: 13px; line-height: 1.6; color: var(--nv-text-dim); margin: 0; }

/* ---------------- Process ("Built in the open") ---------------- */
.ac-process-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 14px; margin-bottom: 22px; }
.ac-process-card {
  background: var(--nv-panel);
  border: 1px solid var(--nv-hairline);
  border-radius: 10px;
  padding: 22px;
  display: flex; flex-direction: column; gap: 8px;
}
.ac-process-step { font-family: var(--nv-font-mono); font-size: 11px; color: var(--nv-signal); letter-spacing: 0.06em; }
.ac-process-title { font-family: var(--nv-font-display); font-weight: 700; font-size: 16.5px; margin: 0; }
.ac-process-body { font-size: 13px; line-height: 1.65; color: var(--nv-text-dim); margin: 0; }
.ac-process-cta { display: inline-flex; }

/* ---------------- Who's Learning (real table) ---------------- */
.ac-learners-table-wrap {
  border: 1px solid var(--nv-hairline);
  border-radius: 12px;
  overflow: hidden;
  overflow-x: auto;
}
.ac-learners-table { width: 100%; border-collapse: collapse; min-width: 520px; }
.ac-learners-table thead th {
  text-align: left;
  font-family: var(--nv-font-mono); font-size: 10.5px; letter-spacing: 0.07em; text-transform: uppercase;
  color: var(--nv-text-faint);
  background: var(--nv-panel);
  padding: 14px 18px;
  border-bottom: 1px solid var(--nv-hairline);
}
.ac-learners-table tbody td {
  padding: 14px 18px;
  font-size: 13.5px;
  color: var(--nv-text);
  border-bottom: 1px solid var(--nv-hairline-soft);
  vertical-align: middle;
}
.ac-learners-table tbody tr:last-child td { border-bottom: none; }
.ac-learners-table tbody tr:hover td { background: rgba(71, 214, 196, 0.03); }
.ac-learner-name { display: block; font-weight: 600; }
.ac-learner-email { display: block; font-family: var(--nv-font-mono); font-size: 11.5px; color: var(--nv-text-faint); margin-top: 2px; }
.ac-status-pill {
  display: inline-flex; align-items: center;
  font-family: var(--nv-font-mono); font-size: 11px; letter-spacing: 0.04em;
  color: var(--nv-amber); background: var(--nv-amber-dim);
  border: 1px solid rgba(232, 163, 61, 0.3);
  padding: 4px 10px; border-radius: 999px;
}
.ac-status-done { color: var(--nv-signal); background: var(--nv-signal-dim); border-color: rgba(71, 214, 196, 0.3); }
.ac-learners-empty {
  text-align: center;
  color: var(--nv-text-faint);
  font-size: 13.5px;
  padding: 28px 18px !important;
}
.ac-inline-retry {
  font-family: var(--nv-font-mono); font-size: 12px;
  color: var(--nv-signal); background: none; border: none; text-decoration: underline; cursor: pointer;
  padding: 0; margin-left: 4px;
}

/* ---------------- FAQ ---------------- */
.ac-faq-list { display: flex; flex-direction: column; max-width: 680px; border-top: 1px solid var(--nv-hairline-soft); }
.ac-faq-item { border-bottom: 1px solid var(--nv-hairline-soft); }
.ac-faq-question {
  width: 100%;
  display: flex; align-items: center; justify-content: space-between; gap: 14px;
  background: transparent; border: none; cursor: pointer;
  padding: 18px 4px;
  text-align: left;
  font-family: var(--nv-font-body); font-size: 14.5px; font-weight: 600;
  color: var(--nv-text);
}
.ac-faq-toggle { flex-shrink: 0; color: var(--nv-text-faint); transition: transform 0.2s ease, color 0.2s ease; }
.ac-faq-toggle-open { transform: rotate(180deg); color: var(--nv-signal); }
.ac-faq-answer { margin: 0 4px 18px; font-size: 13.5px; line-height: 1.7; color: var(--nv-text-dim); max-width: 560px; }

/* ---------------- Ask Nova banner ---------------- */
.ac-nova-banner {
  display: flex; align-items: center; justify-content: space-between; gap: 20px; flex-wrap: wrap;
  padding: clamp(28px, 4vw, 36px) clamp(14px, 6vw, 96px);
  background: var(--nv-signal-dim);
  border-bottom: 1px solid var(--nv-hairline-soft);
}
.ac-nova-text { display: flex; align-items: flex-start; gap: 12px; max-width: 560px; }
.ac-nova-text .ac-live-dot { margin-top: 7px; }
.ac-nova-title { font-family: var(--nv-font-display); font-weight: 700; font-size: 17px; margin: 0 0 6px; color: var(--nv-text); }
.ac-nova-sub { font-size: 13px; line-height: 1.6; color: var(--nv-text-dim); margin: 0; }

/* ---------------- Enroll form ---------------- */
.ac-enroll-section { display: grid; grid-template-columns: 1fr 1fr; gap: clamp(28px, 5vw, 48px); align-items: start; }
.ac-enroll-form {
  background: var(--nv-panel);
  border: 1px solid var(--nv-hairline);
  border-radius: 12px;
  padding: clamp(20px, 3vw, 26px);
  display: flex; flex-direction: column; gap: 16px;
}
.ac-field { display: flex; flex-direction: column; gap: 7px; }
.ac-field-label { font-family: var(--nv-font-mono); font-size: 11px; letter-spacing: 0.05em; color: var(--nv-text-faint); }
.ac-input {
  font-family: var(--nv-font-body); font-size: 14px; color: var(--nv-text);
  background: var(--nv-bg);
  border: 1px solid var(--nv-hairline);
  border-radius: 8px;
  padding: 11px 13px;
  outline: none;
  transition: border-color 0.15s ease;
}
.ac-input:focus { border-color: var(--nv-signal); }
.ac-select { appearance: none; cursor: pointer; }
.ac-submit { margin-top: 4px; width: 100%; }
.ac-form-status { font-size: 13px; margin: 0; }
.ac-form-success { color: var(--nv-signal); }
.ac-form-error { color: var(--nv-danger); }

/* ---------------- Footer ---------------- */
.ac-footer { padding: clamp(30px, 5vw, 40px) clamp(14px, 6vw, 96px) 28px; }
.ac-footer-top { margin-bottom: 20px; }
.ac-footer-brand { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.ac-footer-mark {
  width: 26px; height: 26px; flex-shrink: 0;
  border: 1px solid var(--nv-hairline);
  border-radius: 6px;
  background: var(--nv-signal-dim);
  color: var(--nv-signal);
  display: flex; align-items: center; justify-content: center;
  font-family: var(--nv-font-display); font-weight: 700; font-size: 12px;
}
.ac-footer-title { font-family: var(--nv-font-display); font-weight: 700; font-size: 12.5px; letter-spacing: 0.07em; color: var(--nv-text); }
.ac-footer-tagline { font-size: 12.5px; color: var(--nv-text-faint); max-width: 420px; line-height: 1.6; }
.ac-footer-bottom {
  display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px;
  padding-top: 16px; border-top: 1px solid var(--nv-hairline-soft);
  font-family: var(--nv-font-mono); font-size: 10.5px; color: var(--nv-text-faint);
}

@media (prefers-reduced-motion: reduce) {
  .ac-live-dot { animation: none !important; }
}

/* Tablet */
@media (max-width: 860px) {
  .ac-hero-inner { grid-template-columns: 1fr; }
  .ac-hero-snapshot { max-width: 460px; }
  .ac-cert-section { grid-template-columns: 1fr; }
  .ac-enroll-section { grid-template-columns: 1fr; }
}

/* Large phones */
@media (max-width: 680px) {
  .ac-hero-actions { flex-direction: column; align-items: stretch; }
  .ac-hero-actions .ac-btn { justify-content: center; }
  .ac-tl-header { flex-direction: column; }
  .ac-tl-toggle { align-self: flex-end; margin-top: -22px; }
  .ac-nova-banner { flex-direction: column; align-items: stretch; }
  .ac-nova-banner .ac-btn { justify-content: center; }
  .ac-footer-bottom { flex-direction: column; }
}

/* Small phones */
@media (max-width: 620px) {
  .ac-stats-strip { grid-template-columns: 1fr; }
  .ac-stat-item { border-right: none; border-bottom: 1px solid var(--nv-hairline-soft); }
  .ac-stat-item:last-child { border-bottom: none; }
}

@media (max-width: 520px) {
  .ac-tl-row { gap: 12px; }
  .ac-tl-node { width: 28px; height: 28px; font-size: 11.5px; }
}

/* Smallest phones */
@media (max-width: 380px) {
  .ac-tl-header, .ac-module-row { padding-left: 14px; padding-right: 14px; }
  .ac-cert-card, .ac-process-card, .ac-glossary-card { padding: 16px; }
  .ac-stats-wrap { padding-left: 10px; padding-right: 10px; }
}
`;