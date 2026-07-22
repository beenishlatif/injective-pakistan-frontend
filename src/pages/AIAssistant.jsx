/**
 * AIAssistant.jsx (pages/)
 * ------------------------------------------------------------------
 * Full-page AI assistant for the Injective website.
 * Answers any Injective-related (or general) question by calling the
 * backend at POST /api/ai/chat (or /api/ai/chat/stream for a live
 * typing effect).
 *
 * Auth:
 *   - Guests can chat freely, but nothing is saved — closing/refreshing
 *     loses the conversation, and the History sidebar shows a
 *     "sign in to save your chats" prompt instead of trying to load
 *     history (which requires auth on the backend).
 *   - Signed-in users (email/password or Google) get every chat
 *     persisted on the backend, scoped to their own account.
 *   - Requires <AuthProvider> to be wrapping the app (see App.jsx).
 *
 * Responsive:
 *   - Desktop: fixed sidebar + main panel side by side.
 *   - Tablet/mobile (<= 860px): sidebar becomes an off-canvas drawer,
 *     opened via a hamburger button in the top bar, with a tap-outside
 *     overlay to close it.
 * ------------------------------------------------------------------
 */

import { useState, useRef, useEffect } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import AuthModal from "../components/AuthModal.jsx";

const SUGGESTED_PROMPTS = [
  "What is Injective in simple terms?",
  "What is INJ used for?",
  "How does Injective's on-chain order book work?",
  "How do I start staking INJ?",
];

// ---- Tiny markdown-lite renderer (bold + bullet lists + line breaks) ----
function renderInline(text) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i}>{part.slice(2, -2)}</strong>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

function MessageContent({ text }) {
  const lines = text.split("\n");
  return (
    <>
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (trimmed.startsWith("- ") || trimmed.startsWith("• ")) {
          return (
            <div className="nv-bullet" key={i}>
              <span className="nv-bullet-dot" />
              <span>{renderInline(trimmed.replace(/^[-•]\s/, ""))}</span>
            </div>
          );
        }
        if (!trimmed) return <div key={i} style={{ height: 6 }} />;
        return <p key={i}>{renderInline(line)}</p>;
      })}
    </>
  );
}

function TypingIndicator() {
  return (
    <span className="nv-typing">
      <span className="nv-typing-label">processing</span>
      <span className="nv-cursor" />
    </span>
  );
}

function formatSessionTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  return sameDay
    ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function initials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || name[0].toUpperCase();
}

// ---- Safe response parsing ----------------------------------------------
async function safeParseJson(res, context) {
  const contentType = res.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    const bodyPreview = (await res.text()).slice(0, 200);
    throw new Error(
      `${context}: expected JSON but got "${contentType || "unknown content-type"}" ` +
        `(status ${res.status}). This usually means the request hit the wrong URL, ` +
        `the backend is down, or a CORS/redirect issue is returning an HTML error page. ` +
        `Response preview: ${bodyPreview}`
    );
  }

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.error || `${context} failed with status ${res.status}`);
  }

  return data;
}

export default function AIAssistant({ useStreaming = true }) {
  const { user, isAuthenticated, isLoading: authLoading, authFetch, logout } = useAuth();

  const [messages, setMessages] = useState([]); // {role, content, id}
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [isSessionOpening, setIsSessionOpening] = useState(false);

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false); // mobile drawer
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

  const scrollRef = useRef(null);
  const textareaRef = useRef(null);
  const idCounter = useRef(0);

  const nextId = () => (idCounter.current += 1);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  useEffect(() => {
    if (textareaRef.current) textareaRef.current.focus();
  }, []);

  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = "auto";
    textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + "px";
  }, [input]);

  // Load saved chats only once signed in. Signing out clears everything local.
  useEffect(() => {
    if (isAuthenticated) {
      fetchSessions();
    } else {
      setSessions([]);
      setActiveSessionId(null);
      setMessages([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  async function fetchSessions() {
    setIsHistoryLoading(true);
    try {
      const res = await authFetch("/api/ai/sessions");
      const data = await safeParseJson(res, "Loading chat history");
      if (data.success) setSessions(data.sessions);
    } catch (err) {
      console.error("Failed to load chat history:", err.message);
    } finally {
      setIsHistoryLoading(false);
    }
  }

  function handleNewChat() {
    setMessages([]);
    setInput("");
    setErrorMsg("");
    setActiveSessionId(null);
    setSidebarOpen(false);
    if (textareaRef.current) textareaRef.current.focus();
  }

  async function handleOpenSession(session) {
    if (session.sessionId === activeSessionId || isSessionOpening) return;
    setIsSessionOpening(true);
    setErrorMsg("");
    setSidebarOpen(false);
    try {
      const res = await authFetch(`/api/ai/sessions/${session.sessionId}`);
      const data = await safeParseJson(res, "Loading chat");
      setMessages(data.messages.map((m) => ({ ...m, id: nextId() })));
      setActiveSessionId(data.sessionId);
    } catch (err) {
      console.error(err.message);
      setErrorMsg("Couldn't load that chat. Please try again.");
    } finally {
      setIsSessionOpening(false);
    }
  }

  async function handleDeleteSession(e, sessionId) {
    e.stopPropagation();
    try {
      const res = await authFetch(`/api/ai/sessions/${sessionId}`, { method: "DELETE" });
      await safeParseJson(res, "Deleting chat");
      setSessions((prev) => prev.filter((s) => s.sessionId !== sessionId));
      if (sessionId === activeSessionId) {
        setMessages([]);
        setActiveSessionId(null);
      }
    } catch (err) {
      console.error(err.message);
      setErrorMsg("Couldn't delete that chat. Please try again.");
    }
  }

  async function sendMessage(rawText) {
    const text = (rawText ?? input).trim();
    if (!text || isLoading) return;

    setErrorMsg("");
    const userMsg = { role: "user", content: text, id: nextId() };
    const cleanHistory = messages.filter((m) => m.content && m.content.trim());
    const history = [...cleanHistory, userMsg];
    setMessages(history);
    setInput("");
    setIsLoading(true);

    const apiHistory = history.map(({ role, content }) => ({ role, content }));

    try {
      if (useStreaming) {
        await streamReply(apiHistory);
      } else {
        await fetchReply(apiHistory);
      }
    } catch (err) {
      console.error(err.message);
      setErrorMsg("Couldn't reach the assistant. Please try again.");
      setMessages((prev) => prev.filter((m) => m.content && m.content.trim()));
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchReply(apiHistory) {
    const res = await authFetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: apiHistory, sessionId: activeSessionId }),
    });
    const data = await safeParseJson(res, "Sending message");
    setMessages((prev) => [...prev, { role: "assistant", content: data.reply, id: nextId() }]);
    if (data.sessionId) {
      setActiveSessionId(data.sessionId);
      if (isAuthenticated) fetchSessions();
    }
  }

  async function streamReply(apiHistory) {
    const res = await authFetch("/api/ai/chat/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: apiHistory, sessionId: activeSessionId }),
    });

    if (!res.ok || !res.body) {
      return fetchReply(apiHistory);
    }

    const assistantId = nextId();
    setMessages((prev) => [...prev, { role: "assistant", content: "", id: assistantId }]);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let accumulated = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const events = buffer.split("\n\n");
      buffer = events.pop();

      for (const chunk of events) {
        const lines = chunk.split("\n");
        const eventLine = lines.find((l) => l.startsWith("event: "));
        const dataLine = lines.find((l) => l.startsWith("data: "));
        if (!eventLine || !dataLine) continue;

        const eventName = eventLine.replace("event: ", "").trim();
        const data = JSON.parse(dataLine.replace("data: ", ""));

        if (eventName === "delta") {
          accumulated += data.text;
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: accumulated } : m))
          );
        } else if (eventName === "done") {
          if (data.sessionId) {
            setActiveSessionId(data.sessionId);
            if (isAuthenticated) fetchSessions();
          }
        } else if (eventName === "error") {
          throw new Error(data.message || "Stream error");
        }
      }
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function handleLogout() {
    setLogoutConfirmOpen(true);
  }

  function confirmLogout() {
    setLogoutConfirmOpen(false);
    logout();
    setSidebarOpen(false);
  }

  const currentTitle = activeSessionId
    ? sessions.find((s) => s.sessionId === activeSessionId)?.title || "Conversation"
    : "New conversation";

  return (
    <>
      <style>{STYLES}</style>
      <AuthModal open={authModalOpen} onClose={() => setAuthModalOpen(false)} />

      {logoutConfirmOpen && (
        <div className="nv-logout-overlay" onClick={() => setLogoutConfirmOpen(false)}>
          <div className="nv-logout-box" onClick={(e) => e.stopPropagation()}>
            <div className="nv-logout-title">Sign out?</div>
            <div className="nv-logout-text">
              Are you sure you want to sign out{user?.name ? `, ${user.name}` : ""}?
            </div>
            <div className="nv-logout-actions">
              <button className="nv-logout-cancel" onClick={() => setLogoutConfirmOpen(false)}>
                Cancel
              </button>
              <button className="nv-logout-confirm" onClick={confirmLogout}>
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="nv-page">
        {sidebarOpen && <div className="nv-backdrop" onClick={() => setSidebarOpen(false)} />}

        {/* ---------------- Left sidebar ---------------- */}
        <aside className={`nv-sidebar ${sidebarOpen ? "nv-sidebar-open" : ""}`}>
          <div className="nv-sidebar-top">
            <div className="nv-brand">
              <div className="nv-brand-mark">N</div>
              <div className="nv-brand-text">
                <div className="nv-brand-title">NOVA</div>
                <div className="nv-brand-sub">Injective Research Assistant</div>
              </div>
            </div>
            <button
              className="nv-sidebar-close"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close menu"
            >
              <CloseIcon />
            </button>
          </div>

          <div className="nv-status-row">
            <span className="nv-live-dot" />
            <span className="nv-status-label">Live</span>
            <span className="nv-signal-bars" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
          </div>

          <button className="nv-new-chat-btn" onClick={handleNewChat}>
            <NewChatIcon />
            <span>New chat</span>
          </button>

          <div className="nv-history-section">
            <div className="nv-history-label">History</div>
            <div className="nv-history-list">
              {!isAuthenticated ? (
                <div className="nv-history-guest">
                  <p>Sign in to save your chats and pick them up on any device.</p>
                  <button className="nv-history-guest-btn" onClick={() => setAuthModalOpen(true)}>
                    Sign in / Sign up
                  </button>
                </div>
              ) : isHistoryLoading ? (
                <p className="nv-history-empty">Loading…</p>
              ) : sessions.length === 0 ? (
                <p className="nv-history-empty">No previous chats yet.</p>
              ) : (
                sessions.map((s) => (
                  <button
                    key={s.sessionId}
                    className={`nv-history-item ${
                      s.sessionId === activeSessionId ? "nv-history-item-active" : ""
                    }`}
                    onClick={() => handleOpenSession(s)}
                  >
                    <span className="nv-history-item-main">
                      <span className="nv-history-item-title">{s.title}</span>
                      <span className="nv-history-item-time">{formatSessionTime(s.updatedAt)}</span>
                    </span>
                    <span
                      className="nv-history-item-delete"
                      onClick={(e) => handleDeleteSession(e, s.sessionId)}
                      role="button"
                      aria-label="Delete chat"
                    >
                      <CloseIcon />
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* ---------------- Account block ---------------- */}
          <div className="nv-account">
            {authLoading ? (
              <div className="nv-account-loading">Loading…</div>
            ) : isAuthenticated ? (
              <div className="nv-account-row">
                <div className="nv-account-avatar">{initials(user?.name)}</div>
                <div className="nv-account-info">
                  <div className="nv-account-name">{user?.name}</div>
                  <div className="nv-account-email">{user?.email}</div>
                </div>
                <button className="nv-account-logout" onClick={handleLogout} aria-label="Sign out">
                  <LogoutIcon />
                </button>
              </div>
            ) : (
              <button className="nv-account-signin-btn" onClick={() => setAuthModalOpen(true)}>
                <UserIcon />
                <span>Sign in</span>
              </button>
            )}
          </div>
        </aside>

        {/* ---------------- Main chat panel ---------------- */}
        <main className="nv-main">
          <div className="nv-topbar">
            <button
              className="nv-hamburger"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
            >
              <HamburgerIcon />
            </button>
            <span className="nv-topbar-crumb">Injective / Assistant</span>
            <span className="nv-topbar-title">{currentTitle}</span>
            {!isAuthenticated && !authLoading && (
              <button className="nv-topbar-signin" onClick={() => setAuthModalOpen(true)}>
                Sign in
              </button>
            )}
          </div>

          <div className="nv-body" ref={scrollRef}>
            {!isAuthenticated && !authLoading && messages.length === 0 && (
              <div className="nv-guest-banner">
                You're chatting as a guest — this conversation won't be saved.{" "}
                <button onClick={() => setAuthModalOpen(true)}>Sign in to save it</button>
              </div>
            )}

            {messages.length === 0 && !isSessionOpening && (
              <div className="nv-empty">
                <p className="nv-empty-title">Ask me anything about Injective</p>
                <p className="nv-empty-sub">
                  INJ token, staking, the on-chain order book, building dApps — I've got it.
                </p>
                <div className="nv-chips">
                  {SUGGESTED_PROMPTS.map((p) => (
                    <button key={p} className="nv-chip" onClick={() => sendMessage(p)}>
                      <ChevronIcon />
                      <span>{p}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) => (
              <div key={m.id} className={`nv-row nv-row-${m.role}`}>
                {m.role === "assistant" && <div className="nv-row-label">Nova</div>}
                <div className={`nv-bubble nv-bubble-${m.role}`}>
                  {m.role === "assistant" && m.content === "" && isLoading ? (
                    <TypingIndicator />
                  ) : (
                    <MessageContent text={m.content} />
                  )}
                </div>
              </div>
            ))}

            {isLoading && messages[messages.length - 1]?.role === "user" && (
              <div className="nv-row nv-row-assistant">
                <div className="nv-row-label">Nova</div>
                <div className="nv-bubble nv-bubble-assistant">
                  <TypingIndicator />
                </div>
              </div>
            )}

            {errorMsg && <div className="nv-error">{errorMsg}</div>}
          </div>

          <div className="nv-input-bar">
            <textarea
              ref={textareaRef}
              className="nv-textarea"
              placeholder="Ask about INJ, staking, trading, dApps..."
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button
              className="nv-send-btn"
              onClick={() => sendMessage()}
              disabled={!input.trim() || isLoading}
              aria-label="Send message"
            >
              <SendIcon />
            </button>
          </div>
        </main>
      </div>
    </>
  );
}

// ---------------- Icons (inline SVG, no external deps) ----------------
function CloseIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M6 6L18 18M18 6L6 18" strokeLinecap="round" />
    </svg>
  );
}
function SendIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M4 12L20 4L13 20L11 13L4 12Z" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
function NewChatIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M12 5V19M5 12H19" strokeLinecap="round" />
    </svg>
  );
}
function ChevronIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 6L15 12L9 18" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function HamburgerIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M4 6H20M4 12H20M4 18H20" strokeLinecap="round" />
    </svg>
  );
}
function UserIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20C5.8 16.5 8.6 14.5 12 14.5C15.4 14.5 18.2 16.5 19.5 20" strokeLinecap="round" />
    </svg>
  );
}
function LogoutIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 17L21 12L16 7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21 12H9" strokeLinecap="round" />
    </svg>
  );
}

// ---------------- Self-contained styles ----------------
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

* { box-sizing: border-box; }

.nv-page {
  display: flex;
  width: 100%;
  height: 100dvh;
  background: var(--nv-bg);
  font-family: var(--nv-font-body);
  overflow: hidden;
  position: relative;
}

.nv-backdrop {
  display: none;
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  z-index: 30;
}

/* ---------------- Logout confirmation ---------------- */
.nv-logout-overlay {
  position: fixed; inset: 0; background: rgba(0, 0, 0, 0.55);
  display: flex; align-items: center; justify-content: center;
  z-index: 100; padding: 16px;
}
.nv-logout-box {
  width: 100%; max-width: 320px; background: var(--nv-sidebar);
  border: 1px solid var(--nv-hairline); border-radius: 10px;
  padding: 20px; color: var(--nv-text);
}
.nv-logout-title {
  font-family: var(--nv-font-display); font-weight: 700; font-size: 16px; margin-bottom: 8px;
}
.nv-logout-text {
  font-size: 13px; line-height: 1.55; color: var(--nv-text-dim); margin-bottom: 18px;
}
.nv-logout-actions { display: flex; justify-content: flex-end; gap: 8px; }
.nv-logout-cancel {
  padding: 8px 14px; border-radius: 6px; border: 1px solid var(--nv-hairline);
  background: transparent; color: var(--nv-text); font-size: 12.5px; cursor: pointer;
  transition: background 0.15s ease;
}
.nv-logout-cancel:hover { background: rgba(255, 255, 255, 0.05); }
.nv-logout-confirm {
  padding: 8px 14px; border-radius: 6px; border: 1px solid var(--nv-danger);
  background: var(--nv-danger-dim); color: var(--nv-danger); font-size: 12.5px; font-weight: 600; cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}
.nv-logout-confirm:hover { background: var(--nv-danger); color: #1a0d0d; }

/* ---------------- Sidebar ---------------- */
.nv-sidebar {
  width: 272px;
  flex-shrink: 0;
  background: var(--nv-sidebar);
  border-right: 1px solid var(--nv-hairline);
  display: flex;
  flex-direction: column;
  padding: 20px 14px;
  gap: 18px;
}

.nv-sidebar-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.nv-sidebar-close { display: none; background: transparent; border: none; color: var(--nv-text-faint); cursor: pointer; padding: 4px; }

.nv-brand { display: flex; align-items: center; gap: 10px; padding: 0 2px; min-width: 0; }
.nv-brand-mark {
  width: 30px; height: 30px; flex-shrink: 0;
  border: 1px solid var(--nv-hairline);
  border-radius: 6px;
  background: var(--nv-signal-dim);
  color: var(--nv-signal);
  display: flex; align-items: center; justify-content: center;
  font-family: var(--nv-font-display);
  font-weight: 700; font-size: 14px;
}
.nv-brand-title {
  font-family: var(--nv-font-display);
  font-weight: 700; font-size: 14px; letter-spacing: 0.1em;
  color: var(--nv-text);
}
.nv-brand-sub {
  font-family: var(--nv-font-mono);
  font-size: 10.5px; color: var(--nv-text-faint); margin-top: 2px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

.nv-status-row { display: flex; align-items: center; gap: 6px; padding: 0 3px; }
.nv-live-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--nv-signal); animation: nv-live 1.8s infinite; flex-shrink: 0; }
@keyframes nv-live { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
.nv-status-label { font-family: var(--nv-font-mono); font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--nv-text-faint); }
.nv-signal-bars { display: flex; align-items: flex-end; gap: 2px; height: 10px; margin-left: auto; }
.nv-signal-bars i { width: 2px; display: block; background: var(--nv-signal); opacity: 0.6; animation: nv-bars 1.2s ease-in-out infinite; }
.nv-signal-bars i:nth-child(1) { height: 40%; animation-delay: 0s; }
.nv-signal-bars i:nth-child(2) { height: 100%; animation-delay: 0.2s; }
.nv-signal-bars i:nth-child(3) { height: 65%; animation-delay: 0.4s; }
@keyframes nv-bars { 0%, 100% { transform: scaleY(0.4); } 50% { transform: scaleY(1); } }

.nv-new-chat-btn {
  display: flex; align-items: center; gap: 8px;
  background: transparent; border: 1px solid var(--nv-hairline); color: var(--nv-text);
  font-family: var(--nv-font-mono); font-size: 11.5px; font-weight: 500;
  letter-spacing: 0.08em; text-transform: uppercase;
  padding: 10px 12px; border-radius: 6px; cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
}
.nv-new-chat-btn:hover { border-color: var(--nv-signal); background: var(--nv-signal-dim); }
.nv-new-chat-btn:focus-visible { outline: 2px solid var(--nv-signal); outline-offset: 2px; }

.nv-history-section { flex: 1; display: flex; flex-direction: column; min-height: 0; gap: 8px; }
.nv-history-label {
  font-family: var(--nv-font-mono); font-size: 10.5px; font-weight: 500;
  letter-spacing: 0.1em; text-transform: uppercase; color: var(--nv-text-faint);
  padding: 0 6px 8px; border-bottom: 1px solid var(--nv-hairline-soft);
}
.nv-history-list { flex: 1; overflow-y: auto; display: flex; flex-direction: column; padding-right: 2px; }
.nv-history-empty { font-family: var(--nv-font-mono); font-size: 11.5px; color: var(--nv-text-faint); padding: 6px; margin: 0; }

.nv-history-guest { padding: 10px 8px; display: flex; flex-direction: column; gap: 10px; }
.nv-history-guest p { margin: 0; font-size: 12px; line-height: 1.6; color: var(--nv-text-dim); }
.nv-history-guest-btn {
  align-self: flex-start;
  background: var(--nv-signal-dim); border: 1px solid var(--nv-signal); color: var(--nv-signal);
  font-family: var(--nv-font-mono); font-size: 11px; font-weight: 500; letter-spacing: 0.05em;
  padding: 8px 12px; border-radius: 6px; cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}
.nv-history-guest-btn:hover { background: var(--nv-signal); color: #061412; }

.nv-history-item {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  text-align: left; background: transparent; border: none;
  border-left: 2px solid transparent; border-bottom: 1px solid var(--nv-hairline-soft);
  color: var(--nv-text); padding: 10px 8px 10px 10px; font-size: 12.5px; cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
}
.nv-history-item:hover { background: rgba(255, 255, 255, 0.025); }
.nv-history-item-active { border-left-color: var(--nv-signal); background: var(--nv-signal-dim); }
.nv-history-item-main { display: flex; flex-direction: column; gap: 3px; overflow: hidden; min-width: 0; }
.nv-history-item-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.nv-history-item-time { font-family: var(--nv-font-mono); font-size: 10px; color: var(--nv-text-faint); }
.nv-history-item-delete {
  flex-shrink: 0; color: var(--nv-text-faint); display: flex; padding: 3px; border-radius: 4px;
  opacity: 0; transition: opacity 0.15s ease, color 0.15s ease, background 0.15s ease;
}
.nv-history-item:hover .nv-history-item-delete { opacity: 1; }
.nv-history-item-delete:hover { color: var(--nv-danger); background: var(--nv-danger-dim); }

/* ---------------- Account block (bottom of sidebar) ---------------- */
.nv-account { border-top: 1px solid var(--nv-hairline-soft); padding-top: 12px; flex-shrink: 0; }
.nv-account-loading { font-family: var(--nv-font-mono); font-size: 11px; color: var(--nv-text-faint); padding: 6px; }
.nv-account-row { display: flex; align-items: center; gap: 10px; padding: 4px 2px; }
.nv-account-avatar {
  width: 32px; height: 32px; border-radius: 50%; flex-shrink: 0;
  background: var(--nv-signal-dim); color: var(--nv-signal); border: 1px solid var(--nv-hairline);
  display: flex; align-items: center; justify-content: center;
  font-family: var(--nv-font-mono); font-size: 12px; font-weight: 600;
}
.nv-account-info { flex: 1; min-width: 0; }
.nv-account-name { font-size: 12.5px; color: var(--nv-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.nv-account-email { font-family: var(--nv-font-mono); font-size: 10px; color: var(--nv-text-faint); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.nv-account-logout {
  flex-shrink: 0; background: transparent; border: 1px solid var(--nv-hairline); color: var(--nv-text-faint);
  padding: 7px; border-radius: 6px; cursor: pointer; display: flex;
  transition: color 0.15s ease, border-color 0.15s ease, background 0.15s ease;
}
.nv-account-logout:hover { color: var(--nv-danger); border-color: var(--nv-danger); background: var(--nv-danger-dim); }
.nv-account-signin-btn {
  width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px;
  background: var(--nv-signal-dim); border: 1px solid var(--nv-signal); color: var(--nv-signal);
  font-family: var(--nv-font-mono); font-size: 11.5px; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase;
  padding: 10px 12px; border-radius: 6px; cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}
.nv-account-signin-btn:hover { background: var(--nv-signal); color: #061412; }

/* ---------------- Main chat area ---------------- */
.nv-main { flex: 1; display: flex; flex-direction: column; min-width: 0; background: var(--nv-panel); }

.nv-topbar {
  display: flex; align-items: center; gap: 10px;
  padding: 15px clamp(16px, 8vw, 160px) 13px;
  border-bottom: 1px solid var(--nv-hairline); flex-shrink: 0;
}
.nv-hamburger { display: none; background: transparent; border: 1px solid var(--nv-hairline); color: var(--nv-text); padding: 7px; border-radius: 6px; cursor: pointer; flex-shrink: 0; }
.nv-topbar-crumb { font-family: var(--nv-font-mono); font-size: 10.5px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--nv-text-faint); flex-shrink: 0; }
.nv-topbar-title { font-family: var(--nv-font-body); font-size: 13px; font-weight: 600; color: var(--nv-text-dim); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
.nv-topbar-signin {
  flex-shrink: 0; background: var(--nv-signal-dim); border: 1px solid var(--nv-signal); color: var(--nv-signal);
  font-family: var(--nv-font-mono); font-size: 11px; font-weight: 500; letter-spacing: 0.05em;
  padding: 7px 11px; border-radius: 6px; cursor: pointer; transition: background 0.15s ease, color 0.15s ease;
}
.nv-topbar-signin:hover { background: var(--nv-signal); color: #061412; }

.nv-body { flex: 1; overflow-y: auto; padding: 26px clamp(16px, 8vw, 160px); display: flex; flex-direction: column; gap: 18px; }

.nv-guest-banner {
  max-width: 740px; width: 100%; margin: 0 auto;
  font-size: 12.5px; line-height: 1.6; color: var(--nv-text-dim);
  background: var(--nv-amber-dim); border: 1px solid rgba(232, 163, 61, 0.25);
  padding: 10px 13px; border-radius: 8px;
}
.nv-guest-banner button {
  background: none; border: none; color: var(--nv-amber); text-decoration: underline;
  cursor: pointer; font-size: 12.5px; padding: 0; font-family: inherit;
}

.nv-empty { max-width: 560px; margin: 7vh auto 0; text-align: left; }
.nv-empty-title { font-family: var(--nv-font-display); font-weight: 700; font-size: 22px; letter-spacing: -0.01em; color: var(--nv-text); margin: 0 0 8px; }
.nv-empty-sub { font-family: var(--nv-font-body); color: var(--nv-text-dim); font-size: 14px; margin: 0 0 22px; line-height: 1.65; }
.nv-chips { display: flex; flex-direction: column; gap: 8px; }
.nv-chip {
  display: flex; align-items: center; gap: 9px; text-align: left;
  background: transparent; border: 1px solid var(--nv-hairline); color: var(--nv-text);
  padding: 12px 14px; border-radius: 8px; font-family: var(--nv-font-body); font-size: 13.5px; cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
}
.nv-chip svg { flex-shrink: 0; color: var(--nv-text-faint); transition: transform 0.15s ease, color 0.15s ease; }
.nv-chip:hover { border-color: var(--nv-signal); background: var(--nv-signal-dim); }
.nv-chip:hover svg { transform: translateX(2px); color: var(--nv-signal); }
.nv-chip:focus-visible { outline: 2px solid var(--nv-signal); outline-offset: 2px; }

.nv-row { display: flex; flex-direction: column; max-width: 740px; width: 100%; margin: 0 auto; }
.nv-row-user { align-items: flex-end; }
.nv-row-assistant { align-items: flex-start; }
.nv-row-label { font-family: var(--nv-font-mono); font-size: 10px; font-weight: 500; letter-spacing: 0.1em; text-transform: uppercase; color: var(--nv-text-faint); margin: 0 0 7px 13px; }

.nv-bubble { font-size: 14px; line-height: 1.7; color: var(--nv-text); word-wrap: break-word; }
.nv-bubble p { margin: 0 0 5px; }
.nv-bubble p:last-child { margin-bottom: 0; }
.nv-bubble-user { max-width: 78%; background: var(--nv-amber-dim); border: 1px solid var(--nv-hairline); border-right: 2px solid var(--nv-amber); border-radius: 8px 3px 8px 8px; padding: 11px 14px; }
.nv-bubble-assistant { max-width: 100%; padding-left: 13px; border-left: 2px solid var(--nv-signal); }
.nv-bullet { display: flex; gap: 8px; margin: 3px 0; }
.nv-bullet-dot { width: 4px; height: 4px; border-radius: 50%; background: var(--nv-signal); margin-top: 8px; flex-shrink: 0; }

.nv-typing { display: flex; align-items: center; gap: 8px; padding: 2px 0; }
.nv-typing-label { font-family: var(--nv-font-mono); font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--nv-text-faint); }
.nv-cursor { width: 6px; height: 14px; background: var(--nv-signal); display: inline-block; animation: nv-blink 1s steps(1, end) infinite; }
@keyframes nv-blink { 0%, 49% { opacity: 1; } 50%, 100% { opacity: 0; } }

.nv-error {
  max-width: 740px; width: 100%; margin: 0 auto; font-family: var(--nv-font-mono); font-size: 12px;
  color: var(--nv-danger); background: var(--nv-danger-dim); border: 1px solid rgba(229, 100, 95, 0.25);
  padding: 9px 11px; border-radius: 6px;
}

.nv-input-bar {
  display: flex; align-items: flex-end; gap: 10px;
  padding: 14px clamp(16px, 8vw, 160px) max(22px, env(safe-area-inset-bottom));
  border-top: 1px solid var(--nv-hairline); background: rgba(255, 255, 255, 0.012); flex-shrink: 0;
}
.nv-textarea {
  flex: 1; resize: none; background: var(--nv-bg); border: 1px solid var(--nv-hairline); border-radius: 8px;
  color: var(--nv-text); padding: 12px 14px; font-family: var(--nv-font-body); font-size: 14px;
  outline: none; max-height: 120px; transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.nv-textarea::placeholder { color: var(--nv-text-faint); }
.nv-textarea:focus { border-color: var(--nv-signal); box-shadow: 0 0 0 3px var(--nv-signal-dim); }
.nv-send-btn {
  width: 42px; height: 42px; border-radius: 8px; border: 1px solid var(--nv-signal);
  background: var(--nv-signal-dim); color: var(--nv-signal);
  display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0;
  transition: background 0.15s ease, color 0.15s ease, opacity 0.15s ease;
}
.nv-send-btn:hover:not(:disabled) { background: var(--nv-signal); color: #061412; }
.nv-send-btn:disabled { opacity: 0.35; cursor: not-allowed; }
.nv-send-btn:focus-visible { outline: 2px solid var(--nv-signal); outline-offset: 2px; }

/* Themed scrollbars */
.nv-history-list::-webkit-scrollbar, .nv-body::-webkit-scrollbar { width: 8px; }
.nv-history-list::-webkit-scrollbar-thumb, .nv-body::-webkit-scrollbar-thumb { background: var(--nv-hairline); border-radius: 4px; }

@media (prefers-reduced-motion: reduce) {
  .nv-live-dot, .nv-signal-bars i, .nv-cursor { animation: none !important; opacity: 1 !important; transform: none !important; }
}

/* ---------------- Responsive breakpoints ---------------- */

@media (max-width: 960px) {
  .nv-body, .nv-input-bar, .nv-topbar { padding-left: 24px; padding-right: 24px; }
  .nv-sidebar { width: 240px; }
}

@media (max-width: 860px) {
  .nv-sidebar {
    position: fixed; top: 0; left: 0; bottom: 0; z-index: 40;
    width: min(82vw, 300px);
    transform: translateX(-100%);
    transition: transform 0.22s ease;
    box-shadow: 8px 0 24px rgba(0,0,0,0.4);
    padding-top: max(20px, env(safe-area-inset-top));
  }
  .nv-sidebar-open { transform: translateX(0); }
  .nv-sidebar-close { display: block; }
  .nv-backdrop { display: block; }
  .nv-hamburger { display: flex; align-items: center; justify-content: center; }
  .nv-topbar-crumb { display: none; }
}

@media (max-width: 640px) {
  .nv-body, .nv-input-bar, .nv-topbar { padding-left: 14px; padding-right: 14px; }
  .nv-topbar { padding-top: max(12px, env(safe-area-inset-top)); }
  .nv-empty { margin-top: 4vh; }
  .nv-empty-title { font-size: 19px; }
  .nv-empty-sub { font-size: 13px; }
  .nv-bubble-user { max-width: 88%; }
  .nv-bubble, .nv-chip { font-size: 13.5px; }
  .nv-topbar-signin { padding: 6px 9px; font-size: 10px; }
}

@media (max-width: 400px) {
  .nv-send-btn { width: 38px; height: 38px; }
  .nv-textarea { font-size: 13.5px; padding: 10px 12px; }
}
`;