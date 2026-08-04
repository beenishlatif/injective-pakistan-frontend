/**
 * AuthButton.jsx
 * ------------------------------------------------------------------
 * Floating bottom-right widget:
 *   - Logged out -> pill button "Sign in" that opens AuthModal.
 *   - Logged in  -> circular avatar. Click opens a small dropdown
 *     with the user's name/email, "Switch account" (logs out then
 *     reopens the modal so a different account/method can be used),
 *     and "Log out" (asks for confirmation before actually logging out).
 *
 * Usage: drop <AuthButton /> once near the root of your app, inside
 * <AuthProvider>. It's self-contained (own modal + own state).
 *
 * This revision only refreshes the visual theme to match the teal
 * "nova" branding used across AuthModal.jsx and the rest of the
 * site (Space Grotesk headings, IBM Plex Mono labels, teal accent,
 * consistent radii/shadows). No logic/behavior was changed.
 * ------------------------------------------------------------------
 */

import { useState, useRef, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import AuthModal from "./AuthModal";

export default function AuthButton() {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  if (isLoading) return null;

  const initials = (user?.name || user?.email || "?").trim().charAt(0).toUpperCase();

  return (
    <>
      <div className="nv-authbtn-wrap" ref={menuRef}>
        {isAuthenticated ? (
          <>
            <button
              className="nv-authbtn-avatar"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Account menu"
            >
              {user?.avatar ? (
                <img src={user.avatar} alt="" />
              ) : (
                <span>{initials}</span>
              )}
              <span className="nv-authbtn-online-dot" />
            </button>

            {menuOpen && (
              <div className="nv-authbtn-menu">
                <div className="nv-authbtn-menu-header">
                  <div className="nv-authbtn-menu-avatar-sm">
                    {user?.avatar ? <img src={user.avatar} alt="" /> : <span>{initials}</span>}
                  </div>
                  <div className="nv-authbtn-menu-header-text">
                    <div className="nv-authbtn-menu-name">{user?.name || "Signed in"}</div>
                    {user?.email && <div className="nv-authbtn-menu-email">{user.email}</div>}
                  </div>
                </div>
                <div className="nv-authbtn-menu-divider" />
                <button
                  className="nv-authbtn-menu-item"
                  onClick={() => {
                    setMenuOpen(false);
                    logout();
                    setModalOpen(true);
                  }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M17 3l4 4-4 4M21 7H9M7 21l-4-4 4-4M3 17h12" />
                  </svg>
                  Switch account
                </button>
                <button
                  className="nv-authbtn-menu-item nv-authbtn-menu-danger"
                  onClick={() => {
                    setMenuOpen(false);
                    setConfirmOpen(true);
                  }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
                  </svg>
                  Log out
                </button>
              </div>
            )}
          </>
        ) : (
          <button className="nv-authbtn-pill" onClick={() => setModalOpen(true)}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3" />
            </svg>
            Sign in
          </button>
        )}
      </div>

      {confirmOpen && (
        <div
          className="nv-authbtn-confirm-overlay"
          onClick={() => setConfirmOpen(false)}
        >
          <div
            className="nv-authbtn-confirm-box"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="nv-authbtn-confirm-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
              </svg>
            </div>
            <div className="nv-authbtn-confirm-title">Log out?</div>
            <div className="nv-authbtn-confirm-text">
              Are you sure you want to log out{user?.name ? `, ${user.name}` : ""}? You'll need to sign in again to access your saved chats.
            </div>
            <div className="nv-authbtn-confirm-actions">
              <button
                className="nv-authbtn-confirm-cancel"
                onClick={() => setConfirmOpen(false)}
              >
                Cancel
              </button>
              <button
                className="nv-authbtn-confirm-logout"
                onClick={() => {
                  setConfirmOpen(false);
                  logout();
                }}
              >
                Log out
              </button>
            </div>
          </div>
        </div>
      )}

      <AuthModal open={modalOpen} onClose={() => setModalOpen(false)} />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@500&display=swap');

        .nv-authbtn-wrap {
          position: fixed; bottom: 20px; right: 20px; z-index: 900;
          font-family: 'Inter', sans-serif;
        }
        .nv-authbtn-pill {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 11px 20px; border-radius: 999px; border: 1px solid #1d232b;
          background: #0d0f13; color: #e7eaee; font-size: 14px; font-weight: 600;
          cursor: pointer; box-shadow: 0 8px 24px rgba(0,0,0,0.45), 0 0 0 1px rgba(71,214,196,0.05);
          transition: border-color 0.15s, filter 0.15s;
        }
        .nv-authbtn-pill:hover { border-color: #47d6c455; filter: brightness(1.05); }
        .nv-authbtn-pill svg { color: #47d6c4; }

        .nv-authbtn-avatar {
          position: relative;
          width: 46px; height: 46px; border-radius: 50%; border: 1.5px solid #1d232b;
          background: linear-gradient(135deg, #47d6c4, #2fa393);
          color: #0b0d10; font-size: 17px; font-weight: 700;
          font-family: 'Space Grotesk', sans-serif;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; overflow: hidden; padding: 0;
          box-shadow: 0 8px 24px rgba(0,0,0,0.45);
          transition: border-color 0.15s, transform 0.15s;
        }
        .nv-authbtn-avatar:hover { border-color: #47d6c4; transform: translateY(-1px); }
        .nv-authbtn-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .nv-authbtn-online-dot {
          position: absolute; bottom: 1px; right: 1px; width: 11px; height: 11px;
          border-radius: 50%; background: #47d6c4; border: 2px solid #0b0d10;
        }

        .nv-authbtn-menu {
          position: absolute; bottom: 56px; right: 0; width: 240px;
          background: #0d0f13; border: 1px solid #1d232b; border-radius: 14px;
          padding: 8px; box-shadow: 0 16px 40px rgba(0,0,0,0.5);
          animation: nv-authbtn-menu-in 0.15s ease-out;
        }
        @keyframes nv-authbtn-menu-in {
          from { opacity: 0; transform: translateY(4px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .nv-authbtn-menu-header { display: flex; align-items: center; gap: 10px; padding: 8px 8px 10px; }
        .nv-authbtn-menu-avatar-sm {
          width: 34px; height: 34px; border-radius: 50%; overflow: hidden; flex-shrink: 0;
          background: linear-gradient(135deg, #47d6c4, #2fa393); color: #0b0d10;
          display: flex; align-items: center; justify-content: center;
          font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 13px;
        }
        .nv-authbtn-menu-avatar-sm img { width: 100%; height: 100%; object-fit: cover; }
        .nv-authbtn-menu-header-text { min-width: 0; }
        .nv-authbtn-menu-name { color: #e7eaee; font-size: 14px; font-weight: 600; font-family: 'Space Grotesk', sans-serif; }
        .nv-authbtn-menu-email { color: #8992a1; font-size: 12px; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .nv-authbtn-menu-divider { height: 1px; background: #1d232b; margin: 4px 4px 6px; }
        .nv-authbtn-menu-item {
          width: 100%; display: flex; align-items: center; gap: 9px;
          text-align: left; padding: 9px 10px; border-radius: 9px;
          background: none; border: none; color: #c3c9d1; font-size: 13px; cursor: pointer;
          transition: background 0.12s;
        }
        .nv-authbtn-menu-item svg { color: #545c67; flex-shrink: 0; }
        .nv-authbtn-menu-item:hover { background: #16191e; }
        .nv-authbtn-menu-danger { color: #f0a5a1; }
        .nv-authbtn-menu-danger svg { color: #e5645f; }
        .nv-authbtn-menu-danger:hover { background: rgba(229,100,95,0.08); }

        .nv-authbtn-confirm-overlay {
          position: fixed; inset: 0; background: rgba(5,6,8,0.72);
          backdrop-filter: blur(3px);
          display: flex; align-items: center; justify-content: center;
          z-index: 1000; padding: 16px;
        }
        .nv-authbtn-confirm-box {
          width: 320px; background: #0d0f13; border: 1px solid #1d232b;
          border-radius: 16px; padding: 22px; box-shadow: 0 20px 50px rgba(0,0,0,0.55);
          font-family: 'Inter', sans-serif;
          animation: nv-auth-pop 0.18s ease-out;
        }
        @keyframes nv-auth-pop {
          from { opacity: 0; transform: translateY(6px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .nv-authbtn-confirm-icon {
          width: 38px; height: 38px; border-radius: 10px;
          background: rgba(229,100,95,0.1); border: 1px solid rgba(229,100,95,0.3);
          color: #e5645f; display: flex; align-items: center; justify-content: center;
          margin-bottom: 12px;
        }
        .nv-authbtn-confirm-title {
          color: #e7eaee; font-size: 17px; font-weight: 700; margin-bottom: 8px;
          font-family: 'Space Grotesk', sans-serif;
        }
        .nv-authbtn-confirm-text {
          color: #8992a1; font-size: 13px; line-height: 1.55; margin-bottom: 20px;
        }
        .nv-authbtn-confirm-actions {
          display: flex; justify-content: flex-end; gap: 8px;
        }
        .nv-authbtn-confirm-cancel {
          padding: 9px 16px; border-radius: 9px; border: 1px solid #1d232b;
          background: none; color: #e7eaee; font-size: 13px; font-weight: 600; cursor: pointer;
          transition: background 0.12s;
        }
        .nv-authbtn-confirm-cancel:hover { background: #16191e; }
        .nv-authbtn-confirm-logout {
          padding: 9px 16px; border-radius: 9px; border: none;
          background: #e5645f; color: #0b0d10; font-size: 13px; font-weight: 700; cursor: pointer;
          transition: filter 0.12s;
        }
        .nv-authbtn-confirm-logout:hover { filter: brightness(1.08); }
      `}</style>
    </>
  );
}