/**
 * AuthContext.jsx
 * ------------------------------------------------------------------
 * Global auth state: current user, JWT token (persisted in
 * localStorage so a refresh doesn't log the user out), and the
 * register/login/loginWithGoogle/loginWithX/logout actions.
 *
 * Wrap your app once:
 *   <AuthProvider>
 *     <App />
 *   </AuthProvider>
 * ------------------------------------------------------------------
 */

import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";

const AuthContext = createContext(null);
const TOKEN_KEY = "nova_auth_token";
const DEFAULT_API_BASE_URL = "https://injective-pakistan-backend-2gbb.vercel.app";

export function AuthProvider({ children, apiBaseUrl = DEFAULT_API_BASE_URL }) {
  const [token, setToken] = useState(() => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  });
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const xPopupRef = useRef(null);

  function persistToken(tok) {
    setToken(tok);
    try {
      if (tok) localStorage.setItem(TOKEN_KEY, tok);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      // localStorage unavailable (e.g. private browsing) — auth still works for this tab.
    }
  }

  const authFetch = useCallback(
    (path, options = {}) => {
      const headers = { ...(options.headers || {}) };
      if (token) headers.Authorization = `Bearer ${token}`;
      return fetch(`${apiBaseUrl}${path}`, { ...options, headers });
    },
    [apiBaseUrl, token]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadMe() {
      if (!token) {
        setUser(null);
        setIsLoading(false);
        return;
      }
      try {
        const res = await fetch(`${apiBaseUrl}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (cancelled) return;
        if (res.ok && data.success) {
          setUser(data.user);
        } else {
          setUser(null);
          persistToken(null);
        }
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadMe();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, apiBaseUrl]);

  async function register({ name, email, password }) {
    const res = await fetch(`${apiBaseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || "Could not create account.");
    persistToken(data.token);
    setUser(data.user);
    return data.user;
  }

  async function login({ email, password }) {
    const res = await fetch(`${apiBaseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || "Invalid email or password.");
    persistToken(data.token);
    setUser(data.user);
    return data.user;
  }

  async function loginWithGoogle(idToken) {
    const res = await fetch(`${apiBaseUrl}/api/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || "Google sign-in failed.");
    persistToken(data.token);
    setUser(data.user);
    return data.user;
  }

  // Opens the X OAuth popup and resolves/rejects once the popup
  // posts back a result (see auth.routes.js popupResponseHtml).
  function loginWithX() {
    return new Promise((resolve, reject) => {
      const width = 500;
      const height = 650;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      const popup = window.open(
        `${apiBaseUrl}/api/auth/x/login`,
        "x-oauth-popup",
        `width=${width},height=${height},left=${left},top=${top}`
      );
      xPopupRef.current = popup;

      if (!popup) {
        reject(new Error("Popup was blocked. Please allow popups and try again."));
        return;
      }

      function handleMessage(event) {
        if (event.origin !== window.location.origin && event.origin !== apiBaseUrl) {
          // Still allow same-site frontend origin; ignore anything else.
          if (event.origin !== window.location.origin) return;
        }
        const { data } = event;
        if (!data || (data.type !== "x-oauth-success" && data.type !== "x-oauth-error")) return;

        window.removeEventListener("message", handleMessage);
        clearInterval(pollClosed);

        if (data.type === "x-oauth-success") {
          persistToken(data.token);
          resolve();
        } else {
          reject(new Error(data.message || "X sign-in failed."));
        }
      }

      window.addEventListener("message", handleMessage);

      // If the user closes the popup manually without completing login.
      const pollClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(pollClosed);
          window.removeEventListener("message", handleMessage);
          reject(new Error("Sign-in was cancelled."));
        }
      }, 500);
    });
  }

  function logout() {
    persistToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        authFetch,
        register,
        login,
        loginWithGoogle,
        loginWithX,
        logout,
        apiBaseUrl,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}