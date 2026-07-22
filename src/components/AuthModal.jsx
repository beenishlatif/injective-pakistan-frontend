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
 * ------------------------------------------------------------------
 */

import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

export default function AuthModal({ open, onClose }) {
  const { login, register, loginWithGoogle, loginWithX } = useAuth();
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isXLoading, setIsXLoading] = useState(false);
  const googleBtnRef = useRef(null);

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

  async function handleXClick() {
    setError("");
    setIsXLoading(true);
    try {
      await loginWithX();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsXLoading(false);
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

  if (!open) return null;

  return (
    <div className="nv-auth-overlay" onClick={onClose}>
      <div className="nv-auth-modal" onClick={(e) => e.stopPropagation()}>
        <button className="nv-auth-close" onClick={onClose} aria-label="Close">
          ×
        </button>

        <div className="nv-auth-header">
          <div className="nv-auth-title">
            {mode === "login" ? "Welcome back" : "Create your account"}
          </div>
          <div className="nv-auth-sub">
            {mode === "login"
              ? "Sign in to save and revisit your chat history."
              : "Save your chats and pick up where you left off, on any device."}
          </div>
        </div>

        <div className="nv-auth-social">
          {GOOGLE_CLIENT_ID && <div className="nv-google-btn" ref={googleBtnRef} />}
          <button
            type="button"
            className="nv-x-btn"
            onClick={handleXClick}
            disabled={isXLoading}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            {isXLoading ? "Connecting…" : "Continue with X"}
          </button>
        </div>

        <div className="nv-auth-divider">
          <span>or</span>
        </div>

        <form className="nv-auth-form" onSubmit={handleSubmit}>
          {mode === "register" && (
            <input
              className="nv-auth-input"
              type="text"
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
          )}
          <input
            className="nv-auth-input"
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
          <input
            className="nv-auth-input"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            minLength={6}
            required
          />

          {error && <div className="nv-auth-error">{error}</div>}

          <button className="nv-auth-submit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>

        <div className="nv-auth-switch">
          {mode === "login" ? (
            <>
              Don't have an account?{" "}
              <button type="button" onClick={() => { setMode("register"); setError(""); }}>
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button type="button" onClick={() => { setMode("login"); setError(""); }}>
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
          width: 100%; max-width: 380px; padding: 28px; position: relative;
          color: #e8e9ec;
        }
        .nv-auth-close {
          position: absolute; top: 14px; right: 14px; background: none;
          border: none; color: #8a8f98; font-size: 22px; cursor: pointer;
          line-height: 1; padding: 4px;
        }
        .nv-auth-close:hover { color: #e8e9ec; }
        .nv-auth-header { margin-bottom: 18px; }
        .nv-auth-title { font-size: 20px; font-weight: 600; margin-bottom: 6px; }
        .nv-auth-sub { font-size: 13px; color: #9199a3; line-height: 1.4; }
        .nv-auth-social { display: flex; flex-direction: column; gap: 10px; align-items: stretch; }
        .nv-google-btn { display: flex; justify-content: center; }
        .nv-x-btn {
          display: flex; align-items: center; justify-content: center; gap: 8px;
          width: 100%; padding: 10px 16px; border-radius: 8px;
          background: #000; color: #fff; border: 1px solid #2a2d34;
          font-size: 14px; font-weight: 500; cursor: pointer;
        }
        .nv-x-btn:hover { background: #1a1a1a; }
        .nv-x-btn:disabled { opacity: 0.6; cursor: default; }
        .nv-auth-divider {
          display: flex; align-items: center; gap: 10px; margin: 18px 0;
          color: #6b7078; font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em;
        }
        .nv-auth-divider::before, .nv-auth-divider::after {
          content: ""; flex: 1; height: 1px; background: #2a2d34;
        }
        .nv-auth-form { display: flex; flex-direction: column; gap: 10px; }
        .nv-auth-input {
          background: #0f1114; border: 1px solid #2a2d34; border-radius: 8px;
          padding: 10px 12px; color: #e8e9ec; font-size: 14px; outline: none;
        }
        .nv-auth-input:focus { border-color: #5b8def; }
        .nv-auth-error { color: #f26b6b; font-size: 13px; }
        .nv-auth-submit {
          margin-top: 4px; padding: 10px 16px; border-radius: 8px; border: none;
          background: #5b8def; color: #fff; font-size: 14px; font-weight: 600;
          cursor: pointer;
        }
        .nv-auth-submit:hover { background: #4a7bdc; }
        .nv-auth-submit:disabled { opacity: 0.6; cursor: default; }
        .nv-auth-switch { margin-top: 16px; text-align: center; font-size: 13px; color: #9199a3; }
        .nv-auth-switch button {
          background: none; border: none; color: #5b8def; cursor: pointer; font-size: 13px; padding: 0;
        }
      `}</style>
    </div>
  );
}