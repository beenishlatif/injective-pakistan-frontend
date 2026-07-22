/**
 * AuthModal.jsx
 * ------------------------------------------------------------------
 * Sign in / create account modal. Offers email+password as well as
 * "Continue with Google" via Google Identity Services.
 *
 * Requires VITE_GOOGLE_CLIENT_ID to be set for the Google button to
 * render — if it's missing, the modal still works with email/password.
 * Styles for this component live in AIAssistant.jsx's shared STYLES.
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

  // Load & render the Google button whenever the modal opens.
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

        {GOOGLE_CLIENT_ID && (
          <>
            <div className="nv-google-btn" ref={googleBtnRef} />
            <div className="nv-auth-divider">
              <span>or</span>
            </div>
          </>
        )}

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
    </div>
  );
}