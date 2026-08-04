/**
 * AuthModal.jsx
 * ------------------------------------------------------------------
 * Sign in / create account modal. Offers email+password, "Continue
 * with Google", and "Continue with X".
 *
 * Requires VITE_GOOGLE_CLIENT_ID to be set for the Google button to
 * render — if it's missing, the modal still works with email/password
 * and X. Styles live in <style> block at the bottom of this file;
 * merge into your shared stylesheet if you prefer.
 *
 * ------------------------------------------------------------------
 * FIX / IMPROVEMENT NOTES (this revision):
 * ------------------------------------------------------------------
 * 1. "Sign in with an account that doesn't exist" UX:
 *    The actual decision of whether a login is allowed for a
 *    non-existent account is made server-side (in AuthContext.login()
 *    -> your backend /login route). This modal already refuses to
 *    close on a failed login (onClose() is only called on success),
 *    so a failed attempt correctly keeps the user on the form with
 *    an error shown — it can never "let them in" on its own.
 *
 *    What THIS file adds on top of that: if the error message coming
 *    back looks like "no account / user not found / doesn't exist",
 *    the modal now shows a dedicated banner with a one-click
 *    "Create account instead" action that switches to sign-up mode
 *    and carries the typed email over — instead of just showing a
 *    plain red error string. Same in reverse for sign-up when the
 *    email is already registered ("Sign in instead").
 *
 *    NOTE: this detection matches on the error message text your
 *    backend returns. If your backend currently returns a generic
 *    "Invalid credentials" for both "wrong password" and "no such
 *    user" (a common security practice), this modal cannot tell the
 *    two apart — that distinction has to be made in the backend
 *    response itself for the banner to trigger correctly.
 *
 * 2. General polish: field-level validation, show/hide password,
 *    disabled/loading states on every action, confirm-password check
 *    on sign-up (client-side only, not sent to the API), clearer
 *    empty/invalid states, consistent dark/teal theme.
 *
 * 3. NEW — Google / X now respect sign-in vs sign-up intent, with a
 *    success confirmation:
 *    Previously, "Continue with Google" (and X) would silently sign
 *    a user in OR create a new account for them regardless of
 *    whether they were on the "Sign in" or "Sign up" screen — because
 *    OAuth "find or create" is the default backend behavior.
 *
 *    This modal now sends the current `mode` ("login" | "register")
 *    along with the Google/X credential, as a second argument:
 *        loginWithGoogle(credential, mode)
 *        loginWithX(mode)
 *    so your AuthContext / backend route can honor it — e.g. the
 *    backend's /auth/google handler should:
 *      - if mode === "login": look the account up by email; if it
 *        doesn't exist, reject with a "no account found" style
 *        message (same wording your email/password login already
 *        uses) INSTEAD of auto-creating one.
 *      - if mode === "register": if an account with that email
 *        already exists, reject with an "already exists" style
 *        message INSTEAD of just logging them in.
 *    This file already knows how to render both of those as a
 *    friendly banner with a one-click "Create account instead" /
 *    "Sign in instead" action (see looksLikeAccountNotFound /
 *    looksLikeAccountAlreadyExists below) — that part now applies to
 *    Google and X, not just email/password.
 *
 *    IMPORTANT: this frontend change alone cannot enforce the
 *    behavior — AuthContext.jsx's loginWithGoogle/loginWithX and the
 *    backend's Google/X OAuth routes must also be updated to check
 *    "does this email already have an account?" and respond
 *    accordingly for the correct mode. Happy to wire that up too if
 *    you share AuthContext.jsx and the backend auth routes.
 *
 *    On success, a green confirmation banner ("Signed in
 *    successfully!" / "Account created successfully!") is shown
 *    briefly before the modal closes, so the user gets clear
 *    feedback either way.
 * ------------------------------------------------------------------
 */

import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// How long the green "Signed in!" / "Account created!" confirmation
// stays visible before the modal auto-closes.
const SUCCESS_DISPLAY_MS = 900;

function looksLikeAccountNotFound(message) {
  if (!message) return false;
  const s = message.toLowerCase();
  return (
    s.includes("no account") ||
    s.includes("not found") ||
    s.includes("doesn't exist") ||
    s.includes("does not exist") ||
    s.includes("no user") ||
    s.includes("user not found") ||
    s.includes("account not found")
  );
}

function looksLikeAccountAlreadyExists(message) {
  if (!message) return false;
  const s = message.toLowerCase();
  return s.includes("already") && (s.includes("exist") || s.includes("registered") || s.includes("in use") || s.includes("taken"));
}

export default function AuthModal({ open, onClose }) {
  const { login, register, loginWithGoogle, loginWithX } = useAuth();
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState("");
  const [errorKind, setErrorKind] = useState(null); // null | "not-found" | "already-exists" | "generic"
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isXLoading, setIsXLoading] = useState(false);
  const googleBtnRef = useRef(null);
  const firstInputRef = useRef(null);
  const closeTimerRef = useRef(null);

  // Reset transient state whenever the modal opens or the mode switches,
  // so stale errors/fields from a previous attempt never linger.
  useEffect(() => {
    if (open) {
      setError("");
      setErrorKind(null);
      setSuccessMessage("");
      setFieldErrors({});
      setPassword("");
      setConfirmPassword("");
      setShowPassword(false);
      setTimeout(() => firstInputRef.current?.focus(), 50);
    }
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, [open, mode]);

  useEffect(() => {
    if (!open || !GOOGLE_CLIENT_ID) return;

    function renderGoogleButton() {
      if (!window.google?.accounts?.id || !googleBtnRef.current) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleCredential,
      });
      googleBtnRef.current.innerHTML = "";
      window.google.accounts.id.renderButton(googleBtnRef.current, {
        theme: "filled_black",
        size: "large",
        width: 300,
        text: "continue_with",
        shape: "rectangular",
      });
    }

    if (window.google?.accounts?.id) {
      renderGoogleButton();
    } else {
      const existing = document.getElementById("nv-google-gsi-script");
      if (existing) {
        existing.addEventListener("load", renderGoogleButton, { once: true });
      } else {
        const script = document.createElement("script");
        script.id = "nv-google-gsi-script";
        script.src = "https://accounts.google.com/gsi/client";
        script.async = true;
        script.defer = true;
        script.onload = renderGoogleButton;
        document.body.appendChild(script);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode]);

  function clearError() {
    setError("");
    setErrorKind(null);
  }

  function applyServerError(message) {
    const msg = message || "Something went wrong. Please try again.";
    setError(msg);
    if (mode === "login" && looksLikeAccountNotFound(msg)) {
      setErrorKind("not-found");
    } else if (mode === "register" && looksLikeAccountAlreadyExists(msg)) {
      setErrorKind("already-exists");
    } else {
      setErrorKind("generic");
    }
  }

  // Shows the green confirmation banner, then closes the modal shortly
  // after — used for every successful auth path (email, Google, X) so
  // the user always gets explicit "signed in" vs "signed up" feedback.
  function celebrateSuccessAndClose() {
    setSuccessMessage(mode === "login" ? "Signed in successfully!" : "Account created successfully!");
    closeTimerRef.current = setTimeout(() => {
      onClose();
    }, SUCCESS_DISPLAY_MS);
  }

  async function handleGoogleCredential(response) {
    clearError();
    setSuccessMessage("");
    setIsGoogleLoading(true);
    try {
      // Pass the current mode so the backend can enforce sign-in-only
      // (must already have an account) vs sign-up-only (must not
      // already have an account) instead of always finding-or-creating.
      await loginWithGoogle(response.credential, mode);
      celebrateSuccessAndClose();
    } catch (err) {
      applyServerError(err.message);
    } finally {
      setIsGoogleLoading(false);
    }
  }

  async function handleXClick() {
    clearError();
    setSuccessMessage("");
    setIsXLoading(true);
    try {
      // Same intent-passing as Google — see note above.
      await loginWithX(mode);
      celebrateSuccessAndClose();
    } catch (err) {
      applyServerError(err.message);
    } finally {
      setIsXLoading(false);
    }
  }

  function validate() {
    const errs = {};
    if (mode === "register" && !name.trim()) {
      errs.name = "Please enter your name.";
    }
    if (!email.trim()) {
      errs.email = "Email is required.";
    } else if (!EMAIL_RE.test(email.trim())) {
      errs.email = "Enter a valid email address.";
    }
    if (!password) {
      errs.password = "Password is required.";
    } else if (password.length < 6) {
      errs.password = "Password must be at least 6 characters.";
    }
    if (mode === "register" && confirmPassword !== password) {
      errs.confirmPassword = "Passwords don't match.";
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    clearError();
    setSuccessMessage("");
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      if (mode === "login") {
        await login({ email: email.trim(), password });
      } else {
        await register({ name: name.trim(), email: email.trim(), password });
      }
      celebrateSuccessAndClose();
    } catch (err) {
      applyServerError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  function switchMode(nextMode) {
    setMode(nextMode);
    clearError();
    setSuccessMessage("");
    setFieldErrors({});
    setPassword("");
    setConfirmPassword("");
  }

  const anyLoading = isSubmitting || isGoogleLoading || isXLoading;
  const showingSuccess = Boolean(successMessage);

  if (!open) return null;

  return (
    <div className="nv-auth-overlay" onClick={anyLoading || showingSuccess ? undefined : onClose}>
      <div className="nv-auth-modal" onClick={(e) => e.stopPropagation()}>
        <button
          className="nv-auth-close"
          onClick={onClose}
          aria-label="Close"
          disabled={anyLoading}
        >
          ×
        </button>

        <div className="nv-auth-header">
          <span className="nv-auth-eyebrow">
            <span className="nv-auth-dot" />
            {mode === "login" ? "Welcome back" : "Join the arena"}
          </span>
          <div className="nv-auth-title">
            {mode === "login" ? "Sign in to your account" : "Create your account"}
          </div>
          <div className="nv-auth-sub">
            {mode === "login"
              ? "Sign in to save and revisit your chat history."
              : "Save your chats and pick up where you left off, on any device."}
          </div>
        </div>

        {successMessage && (
          <div className="nv-auth-banner nv-auth-banner-success">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
              <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="nv-auth-banner-text">{successMessage}</span>
          </div>
        )}

        <div className="nv-auth-social">
          {GOOGLE_CLIENT_ID && (
            <div className="nv-google-wrap">
              <div className="nv-google-btn" ref={googleBtnRef} />
              {isGoogleLoading && <div className="nv-google-loading">Connecting…</div>}
            </div>
          )}
          <button
            type="button"
            className="nv-x-btn"
            onClick={handleXClick}
            disabled={anyLoading || showingSuccess}
          >
            {isXLoading ? (
              <span className="nv-spinner" />
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            )}
            {isXLoading ? "Connecting…" : "Continue with X"}
          </button>
        </div>

        <div className="nv-auth-divider">
          <span>or continue with email</span>
        </div>

        <form className="nv-auth-form" onSubmit={handleSubmit} noValidate>
          {mode === "register" && (
            <div className="nv-auth-field">
              <input
                ref={firstInputRef}
                className={`nv-auth-input ${fieldErrors.name ? "nv-auth-input-error" : ""}`}
                type="text"
                placeholder="Full name"
                value={name}
                onChange={(e) => { setName(e.target.value); if (fieldErrors.name) setFieldErrors((f) => ({ ...f, name: undefined })); }}
                autoComplete="name"
                disabled={anyLoading}
              />
              {fieldErrors.name && <span className="nv-auth-field-error">{fieldErrors.name}</span>}
            </div>
          )}

          <div className="nv-auth-field">
            <input
              ref={mode === "login" ? firstInputRef : undefined}
              className={`nv-auth-input ${fieldErrors.email ? "nv-auth-input-error" : ""}`}
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => { setEmail(e.target.value); if (fieldErrors.email) setFieldErrors((f) => ({ ...f, email: undefined })); }}
              autoComplete="email"
              disabled={anyLoading}
            />
            {fieldErrors.email && <span className="nv-auth-field-error">{fieldErrors.email}</span>}
          </div>

          <div className="nv-auth-field">
            <div className="nv-auth-password-wrap">
              <input
                className={`nv-auth-input ${fieldErrors.password ? "nv-auth-input-error" : ""}`}
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); if (fieldErrors.password) setFieldErrors((f) => ({ ...f, password: undefined })); }}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                minLength={6}
                disabled={anyLoading}
              />
              <button
                type="button"
                className="nv-auth-eye"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M3 3l18 18M10.6 10.6a3 3 0 004.24 4.24M9.88 5.09A10.6 10.6 0 0112 5c5 0 9 4.5 10 7-.36 1.02-1.03 2.13-2 3.18M6.1 6.1C4.2 7.4 2.8 9.2 2 12c1 2.5 5 7 10 7 1.15 0 2.24-.2 3.25-.56" />
                  </svg>
                ) : (
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
            {fieldErrors.password && <span className="nv-auth-field-error">{fieldErrors.password}</span>}
          </div>

          {mode === "register" && (
            <div className="nv-auth-field">
              <input
                className={`nv-auth-input ${fieldErrors.confirmPassword ? "nv-auth-input-error" : ""}`}
                type={showPassword ? "text" : "password"}
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); if (fieldErrors.confirmPassword) setFieldErrors((f) => ({ ...f, confirmPassword: undefined })); }}
                autoComplete="new-password"
                disabled={anyLoading}
              />
              {fieldErrors.confirmPassword && <span className="nv-auth-field-error">{fieldErrors.confirmPassword}</span>}
            </div>
          )}

          {error && (
            <div className={`nv-auth-banner ${errorKind === "generic" || !errorKind ? "nv-auth-banner-error" : "nv-auth-banner-info"}`}>
              <span className="nv-auth-banner-text">{error}</span>

              {errorKind === "not-found" && (
                <button
                  type="button"
                  className="nv-auth-banner-action"
                  onClick={() => switchMode("register")}
                >
                  Create account instead
                </button>
              )}
              {errorKind === "already-exists" && (
                <button
                  type="button"
                  className="nv-auth-banner-action"
                  onClick={() => switchMode("login")}
                >
                  Sign in instead
                </button>
              )}
            </div>
          )}

          <button className="nv-auth-submit" type="submit" disabled={anyLoading || showingSuccess}>
            {isSubmitting ? (
              <>
                <span className="nv-spinner nv-spinner-dark" /> Please wait…
              </>
            ) : mode === "login" ? (
              "Sign in"
            ) : (
              "Create account"
            )}
          </button>
        </form>

        <div className="nv-auth-switch">
          {mode === "login" ? (
            <>
              Don&apos;t have an account?{" "}
              <button type="button" onClick={() => switchMode("register")} disabled={anyLoading}>
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button type="button" onClick={() => switchMode("login")} disabled={anyLoading}>
                Sign in
              </button>
            </>
          )}
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700&family=Inter:wght@400;500;600&display=swap');

        .nv-auth-overlay {
          position: fixed; inset: 0; background: rgba(5,6,8,0.72);
          backdrop-filter: blur(3px);
          display: flex; align-items: center; justify-content: center;
          z-index: 1000; padding: 16px;
        }
        .nv-auth-modal {
          background: #0d0f13; border: 1px solid #1d232b; border-radius: 18px;
          width: 100%; max-width: 400px; padding: 30px 28px 26px; position: relative;
          color: #e7eaee; font-family: 'Inter', sans-serif;
          box-shadow: 0 0 0 1px rgba(71,214,196,0.06), 0 30px 70px rgba(0,0,0,0.55);
          animation: nv-auth-pop 0.18s ease-out;
        }
        @keyframes nv-auth-pop {
          from { opacity: 0; transform: translateY(6px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .nv-auth-close {
          position: absolute; top: 14px; right: 14px; width: 30px; height: 30px;
          border-radius: 8px; background: none;
          border: 1px solid transparent; color: #8992a1; font-size: 20px; cursor: pointer;
          line-height: 1; display: flex; align-items: center; justify-content: center;
          transition: background 0.15s, color 0.15s;
        }
        .nv-auth-close:hover { background: #16191e; color: #e7eaee; }
        .nv-auth-close:disabled { opacity: 0.4; cursor: default; }

        .nv-auth-header { margin-bottom: 20px; }
        .nv-auth-eyebrow {
          display: inline-flex; align-items: center; gap: 6px;
          font-family: 'IBM Plex Mono', monospace; font-size: 10px; letter-spacing: 0.15em;
          text-transform: uppercase; color: #47d6c4; margin-bottom: 10px;
        }
        .nv-auth-dot { width: 5px; height: 5px; border-radius: 50%; background: #47d6c4; }
        .nv-auth-title {
          font-family: 'Space Grotesk', sans-serif; font-size: 21px; font-weight: 700;
          margin-bottom: 6px; color: #e7eaee;
        }
        .nv-auth-sub { font-size: 13px; color: #8992a1; line-height: 1.5; }

        .nv-auth-social { display: flex; flex-direction: column; gap: 10px; align-items: stretch; }
        .nv-google-wrap { position: relative; display: flex; justify-content: center; }
        .nv-google-btn { display: flex; justify-content: center; width: 100%; }
        .nv-google-loading {
          position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
          background: rgba(13,15,19,0.75); border-radius: 8px; font-size: 13px; color: #8992a1;
        }
        .nv-x-btn {
          display: flex; align-items: center; justify-content: center; gap: 8px;
          width: 100%; padding: 11px 16px; border-radius: 10px;
          background: #000; color: #fff; border: 1px solid #1d232b;
          font-size: 14px; font-weight: 500; cursor: pointer; transition: background 0.15s, border-color 0.15s;
        }
        .nv-x-btn:hover:not(:disabled) { background: #131313; border-color: #2a2d34; }
        .nv-x-btn:disabled { opacity: 0.6; cursor: default; }

        .nv-auth-divider {
          display: flex; align-items: center; gap: 10px; margin: 20px 0;
          color: #545c67; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em;
          font-family: 'IBM Plex Mono', monospace;
        }
        .nv-auth-divider::before, .nv-auth-divider::after {
          content: ""; flex: 1; height: 1px; background: #1d232b;
        }

        .nv-auth-form { display: flex; flex-direction: column; gap: 12px; }
        .nv-auth-field { display: flex; flex-direction: column; gap: 5px; }
        .nv-auth-input {
          background: #0b0d10; border: 1px solid #1d232b; border-radius: 10px;
          padding: 11px 13px; color: #e7eaee; font-size: 14px; outline: none;
          font-family: 'Inter', sans-serif; width: 100%;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .nv-auth-input::placeholder { color: #545c67; }
        .nv-auth-input:focus { border-color: #47d6c4; box-shadow: 0 0 0 3px rgba(71,214,196,0.12); }
        .nv-auth-input:disabled { opacity: 0.6; cursor: default; }
        .nv-auth-input-error { border-color: #e5645f; }
        .nv-auth-input-error:focus { box-shadow: 0 0 0 3px rgba(229,100,95,0.14); }
        .nv-auth-field-error { color: #f0a5a1; font-size: 12px; padding-left: 2px; }

        .nv-auth-password-wrap { position: relative; }
        .nv-auth-password-wrap .nv-auth-input { padding-right: 40px; }
        .nv-auth-eye {
          position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
          background: none; border: none; color: #545c67; cursor: pointer;
          display: flex; align-items: center; justify-content: center; padding: 4px;
          transition: color 0.15s;
        }
        .nv-auth-eye:hover { color: #8992a1; }

        .nv-auth-banner {
          display: flex; flex-direction: column; gap: 8px;
          padding: 11px 13px; border-radius: 10px; font-size: 13px; line-height: 1.4;
          margin-bottom: 14px;
        }
        .nv-auth-banner-error {
          background: rgba(229,100,95,0.08); border: 1px solid rgba(229,100,95,0.3); color: #f0a5a1;
        }
        .nv-auth-banner-info {
          background: rgba(71,214,196,0.08); border: 1px solid rgba(71,214,196,0.3); color: #9fe8de;
        }
        .nv-auth-banner-success {
          flex-direction: row; align-items: center; gap: 8px;
          background: rgba(71,214,196,0.12); border: 1px solid rgba(71,214,196,0.4); color: #7cf0de;
          animation: nv-auth-pop 0.18s ease-out;
        }
        .nv-auth-banner-text { display: block; }
        .nv-auth-banner-action {
          align-self: flex-start; background: none; border: none; padding: 0;
          font-size: 13px; font-weight: 700; cursor: pointer; text-decoration: underline;
          color: inherit;
        }

        .nv-auth-submit {
          margin-top: 4px; padding: 12px 16px; border-radius: 10px; border: none;
          background: #47d6c4; color: #0b0d10; font-size: 14px; font-weight: 700;
          font-family: 'Space Grotesk', sans-serif; letter-spacing: 0.01em;
          cursor: pointer; transition: filter 0.15s;
          display: flex; align-items: center; justify-content: center; gap: 8px;
        }
        .nv-auth-submit:hover:not(:disabled) { filter: brightness(1.08); }
        .nv-auth-submit:disabled { opacity: 0.65; cursor: default; }

        .nv-spinner {
          width: 14px; height: 14px; border-radius: 50%;
          border: 2px solid rgba(255,255,255,0.35); border-top-color: #fff;
          animation: nv-spin 0.7s linear infinite; display: inline-block;
        }
        .nv-spinner-dark {
          border: 2px solid rgba(11,13,16,0.35); border-top-color: #0b0d10;
        }
        @keyframes nv-spin { to { transform: rotate(360deg); } }

        .nv-auth-switch { margin-top: 18px; text-align: center; font-size: 13px; color: #8992a1; }
        .nv-auth-switch button {
          background: none; border: none; color: #47d6c4; cursor: pointer; font-size: 13px;
          font-weight: 600; padding: 0;
        }
        .nv-auth-switch button:hover:not(:disabled) { text-decoration: underline; }
        .nv-auth-switch button:disabled { opacity: 0.5; cursor: default; }
      `}</style>
    </div>
  );
}