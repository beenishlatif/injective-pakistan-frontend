/**
 * AuthModal.jsx
 * ------------------------------------------------------------------
 * Sign in / create account modal. Offers email+password and
 * "Continue with Google".
 *
 * Requires VITE_GOOGLE_CLIENT_ID to be set for the Google button to
 * render — if it's missing, the modal falls back to email/password
 * only (no divider shown, since there's nothing to divide from).
 * ------------------------------------------------------------------
 */

import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

export default function AuthModal({ open, onClose }) {
  const { login, register, loginWithGoogle } = useAuth();
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const googleBtnRef = useRef(null);

  // Reset form state whenever the modal is closed/reopened, so a
  // previous session's typed values/errors don't linger.
  useEffect(() => {
    if (!open) {
      setMode("login");
      setName("");
      setEmail("");
      setPassword("");
      setError("");
      setIsSubmitting(false);
    }
  }, [open]);

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
        width: 320,
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
  }, [open]);

  async function handleGoogleCredential(response) {
    setError("");
    try {
      await loginWithGoogle(response.credential);
      onClose();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      if (mode === "login") {
        await login({ email, password });
      } else {
        if (!name.trim()) throw new Error("Please enter your name.");
        await register({ name, email, password });
      }
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  function switchMode(nextMode) {
    setMode(nextMode);
    setError("");
  }

  if (!open) return null;

  return (
    <div className="nv-auth-overlay" onClick={onClose}>
      <div className="nv-auth-modal" onClick={(e) => e.stopPropagation()}>
        <button className="nv-auth-close" onClick={onClose} aria-label="Close">
          ×
        </button>

        {/* Mode switcher tabs — clearer than a text link for the primary choice */}
        <div className="nv-auth-tabs">
          <button
            type="button"
            className={`nv-auth-tab ${mode === "login" ? "nv-auth-tab-active" : ""}`}
            onClick={() => switchMode("login")}
          >
            Sign in
          </button>
          <button
            type="button"
            className={`nv-auth-tab ${mode === "register" ? "nv-auth-tab-active" : ""}`}
            onClick={() => switchMode("register")}
          >
            Create account
          </button>
        </div>

        <div className="nv-auth-header">
          <div className="nv-auth-title">
            {mode === "login" ? "Welcome back" : "Create your account"}
          </div>
          <div className="nv-auth-sub">
            {mode === "login"
              ? "Sign in to pick up your saved chats, on any device."
              : "Save your chats and pick up where you left off, on any device."}
          </div>
        </div>

        {GOOGLE_CLIENT_ID && (
          <>
            <div className="nv-auth-social">
              <div className="nv-google-btn" ref={googleBtnRef} />
            </div>
            <div className="nv-auth-divider">
              <span>or use email</span>
            </div>
          </>
        )}

        <form className="nv-auth-form" onSubmit={handleSubmit}>
          {mode === "register" && (
            <label className="nv-auth-field">
              <span className="nv-auth-label">Full name</span>
              <input
                className="nv-auth-input"
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
              />
            </label>
          )}

          <label className="nv-auth-field">
            <span className="nv-auth-label">Email</span>
            <input
              className="nv-auth-input"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </label>

          <label className="nv-auth-field">
            <span className="nv-auth-label">Password</span>
            <input
              className="nv-auth-input"
              type="password"
              placeholder={mode === "register" ? "At least 6 characters" : "Your password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              minLength={6}
              required
            />
          </label>

          {error && (
            <div className="nv-auth-error">
              <span className="nv-auth-error-dot" />
              {error}
            </div>
          )}

          <button className="nv-auth-submit" type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? mode === "login"
                ? "Signing in…"
                : "Creating account…"
              : mode === "login"
              ? "Sign in"
              : "Create account"}
          </button>
        </form>

        <div className="nv-auth-switch">
          {mode === "login" ? (
            <>
              Don't have an account?{" "}
              <button type="button" onClick={() => switchMode("register")}>
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button type="button" onClick={() => switchMode("login")}>
                Sign in
              </button>
            </>
          )}
        </div>
      </div>

      <style>{`
        .nv-auth-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.6);
          display: flex; align-items: center; justify-content: center;
          z-index: 1000; padding: 16px;
        }
        .nv-auth-modal {
          background: #16181c; border: 1px solid #2a2d34; border-radius: 14px;
          width: 100%; max-width: 400px; padding: 24px 28px 28px; position: relative;
          color: #e8e9ec;
        }
        .nv-auth-close {
          position: absolute; top: 14px; right: 14px; background: none;
          border: none; color: #8a8f98; font-size: 22px; cursor: pointer;
          line-height: 1; padding: 4px;
        }
        .nv-auth-close:hover { color: #e8e9ec; }

        .nv-auth-tabs {
          display: flex; gap: 4px; background: #0f1114; border: 1px solid #2a2d34;
          border-radius: 10px; padding: 4px; margin: 8px 0 20px;
        }
        .nv-auth-tab {
          flex: 1; padding: 8px 10px; border-radius: 7px; border: none;
          background: transparent; color: #9199a3; font-size: 13px; font-weight: 600;
          cursor: pointer; transition: background 0.15s ease, color 0.15s ease;
        }
        .nv-auth-tab-active { background: #5b8def; color: #fff; }

        .nv-auth-header { margin-bottom: 18px; }
        .nv-auth-title { font-size: 19px; font-weight: 600; margin-bottom: 6px; }
        .nv-auth-sub { font-size: 13px; color: #9199a3; line-height: 1.5; }

        .nv-auth-social { display: flex; justify-content: center; margin-bottom: 4px; }
        .nv-google-btn { display: flex; justify-content: center; width: 100%; }

        .nv-auth-divider {
          display: flex; align-items: center; gap: 10px; margin: 18px 0;
          color: #6b7078; font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.04em;
        }
        .nv-auth-divider::before, .nv-auth-divider::after {
          content: ""; flex: 1; height: 1px; background: #2a2d34;
        }

        .nv-auth-form { display: flex; flex-direction: column; gap: 14px; }
        .nv-auth-field { display: flex; flex-direction: column; gap: 6px; }
        .nv-auth-label { font-size: 12px; font-weight: 500; color: #9199a3; }
        .nv-auth-input {
          background: #0f1114; border: 1px solid #2a2d34; border-radius: 8px;
          padding: 10px 12px; color: #e8e9ec; font-size: 14px; outline: none;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }
        .nv-auth-input:focus { border-color: #5b8def; box-shadow: 0 0 0 3px rgba(91,141,239,0.15); }

        .nv-auth-error {
          display: flex; align-items: center; gap: 8px;
          background: rgba(229,100,95,0.1); border: 1px solid rgba(229,100,95,0.3);
          color: #f26b6b; font-size: 12.5px; padding: 9px 11px; border-radius: 7px;
        }
        .nv-auth-error-dot {
          width: 6px; height: 6px; border-radius: 50%; background: #f26b6b; flex-shrink: 0;
        }

        .nv-auth-submit {
          margin-top: 2px; padding: 11px 16px; border-radius: 8px; border: none;
          background: #5b8def; color: #fff; font-size: 14px; font-weight: 600;
          cursor: pointer; transition: background 0.15s ease, opacity 0.15s ease;
        }
        .nv-auth-submit:hover:not(:disabled) { background: #4a7bdc; }
        .nv-auth-submit:disabled { opacity: 0.6; cursor: default; }

        .nv-auth-switch { margin-top: 18px; text-align: center; font-size: 13px; color: #9199a3; }
        .nv-auth-switch button {
          background: none; border: none; color: #5b8def; cursor: pointer; font-size: 13px;
          padding: 0; font-weight: 600;
        }
        .nv-auth-switch button:hover { text-decoration: underline; }
      `}</style>
    </div>
  );
}