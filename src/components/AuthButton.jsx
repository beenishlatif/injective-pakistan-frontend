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
            </button>

            {menuOpen && (
              <div className="nv-authbtn-menu">
                <div className="nv-authbtn-menu-header">
                  <div className="nv-authbtn-menu-name">{user?.name || "Signed in"}</div>
                  {user?.email && <div className="nv-authbtn-menu-email">{user.email}</div>}
                </div>
                <button
                  className="nv-authbtn-menu-item"
                  onClick={() => {
                    setMenuOpen(false);
                    logout();
                    setModalOpen(true);
                  }}
                >
                  Switch account
                </button>
                <button
                  className="nv-authbtn-menu-item nv-authbtn-menu-danger"
                  onClick={() => {
                    setMenuOpen(false);
                    setConfirmOpen(true);
                  }}
                >
                  Log out
                </button>
              </div>
            )}
          </>
        ) : (
          <button className="nv-authbtn-pill" onClick={() => setModalOpen(true)}>
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
            <div className="nv-authbtn-confirm-title">Log out?</div>
            <div className="nv-authbtn-confirm-text">
              Are you sure you want to log out{user?.name ? `, ${user.name}` : ""}?
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
        .nv-authbtn-wrap {
          position: fixed; bottom: 20px; right: 20px; z-index: 900;
        }
        .nv-authbtn-pill {
          padding: 10px 18px; border-radius: 999px; border: 1px solid #2a2d34;
          background: #16181c; color: #e8e9ec; font-size: 14px; font-weight: 600;
          cursor: pointer; box-shadow: 0 4px 14px rgba(0,0,0,0.35);
        }
        .nv-authbtn-pill:hover { background: #1c1f25; }
        .nv-authbtn-avatar {
          width: 44px; height: 44px; border-radius: 50%; border: 1px solid #2a2d34;
          background: #5b8def; color: #fff; font-size: 16px; font-weight: 700;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; overflow: hidden; padding: 0;
          box-shadow: 0 4px 14px rgba(0,0,0,0.35);
        }
        .nv-authbtn-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .nv-authbtn-menu {
          position: absolute; bottom: 54px; right: 0; width: 220px;
          background: #16181c; border: 1px solid #2a2d34; border-radius: 12px;
          padding: 8px; box-shadow: 0 8px 24px rgba(0,0,0,0.45);
        }
        .nv-authbtn-menu-header { padding: 8px 10px 10px; border-bottom: 1px solid #2a2d34; margin-bottom: 6px; }
        .nv-authbtn-menu-name { color: #e8e9ec; font-size: 14px; font-weight: 600; }
        .nv-authbtn-menu-email { color: #9199a3; font-size: 12px; margin-top: 2px; }
        .nv-authbtn-menu-item {
          width: 100%; text-align: left; padding: 9px 10px; border-radius: 8px;
          background: none; border: none; color: #e8e9ec; font-size: 13px; cursor: pointer;
        }
        .nv-authbtn-menu-item:hover { background: #22252b; }
        .nv-authbtn-menu-danger { color: #f26b6b; }

        .nv-authbtn-confirm-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.5);
          display: flex; align-items: center; justify-content: center;
          z-index: 1000;
        }
        .nv-authbtn-confirm-box {
          width: 300px; background: #16181c; border: 1px solid #2a2d34;
          border-radius: 14px; padding: 20px; box-shadow: 0 12px 32px rgba(0,0,0,0.5);
        }
        .nv-authbtn-confirm-title {
          color: #e8e9ec; font-size: 16px; font-weight: 700; margin-bottom: 8px;
        }
        .nv-authbtn-confirm-text {
          color: #9199a3; font-size: 13px; line-height: 1.5; margin-bottom: 18px;
        }
        .nv-authbtn-confirm-actions {
          display: flex; justify-content: flex-end; gap: 8px;
        }
        .nv-authbtn-confirm-cancel {
          padding: 8px 14px; border-radius: 8px; border: 1px solid #2a2d34;
          background: none; color: #e8e9ec; font-size: 13px; cursor: pointer;
        }
        .nv-authbtn-confirm-cancel:hover { background: #22252b; }
        .nv-authbtn-confirm-logout {
          padding: 8px 14px; border-radius: 8px; border: none;
          background: #f26b6b; color: #16181c; font-size: 13px; font-weight: 600; cursor: pointer;
        }
        .nv-authbtn-confirm-logout:hover { background: #f58080; }
      `}</style>
    </>
  );
}