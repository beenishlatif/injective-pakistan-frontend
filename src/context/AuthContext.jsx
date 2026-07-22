/**
 * AuthContext.jsx
 * ------------------------------------------------------------------
 * Global auth state: current user, JWT token (persisted in
 * localStorage so a refresh doesn't log the user out), and the
 * register/login/loginWithGoogle/logout actions.
 *
 * Wrap your app once:
 *   <AuthProvider>
 *     <AIAssistant />
 *   </AuthProvider>
 * ------------------------------------------------------------------
 */

import { createContext, useContext, useState, useEffect, useCallback } from "react";

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

  function persistToken(tok) {
    setToken(tok);
    try {
      if (tok) localStorage.setItem(TOKEN_KEY, tok);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      // localStorage unavailable (e.g. private browsing) — auth still works for this tab.
    }
  }

  // Wraps fetch and automatically attaches the Authorization header when signed in.
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