/**
 * AuthButton.jsx
 * ------------------------------------------------------------------
 * Floating bottom-right widget:
 *   - Logged out -> pill button "Sign in" that opens AuthModal.
 *   - Logged in  -> circular avatar. Click opens a small dropdown
 *     with the user's name/email and "Log out" (with an inline
 *     confirmation step before actually logging out).
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
  const [confirmingLogout, setConfirmingLogout] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
        setConfirmingLogout(false);
      }
    }
    if (menuOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  // Reset the confirmation step whenever the menu closes/reopens.
  useEffect(() => {
    if (!menuOpen) setConfirmingLogout(false);
  }, [menuOpen]);

  if (isLoading) return null;

  const initials = (user?.name || user?.email || "?").trim().charAt(0).toUpperCase();

  function handleConfirmLogout() {
    logout();
    setConfirmingLogout(false);
    setMenuOpen(false);
  }

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
                {!confirmingLogout ? (
                  <>
                    <div className="nv-authbtn-menu-header">
                      <div className="nv-authbtn-menu-name">{user?.name || "Signed in"}</div>
                      {user?.email && <div className="nv-authbtn-menu-email">{user.email}</div>}
                    </div>
                    <button
                      className="nv-authbtn-menu-item nv-authbtn-menu-danger"
                      onClick={() => setConfirmingLogout(true)}
                    >
                      Log out
                    </button>
                  </>
                ) : (
                  <div className="nv-authbtn-confirm">
                    <div className="nv-authbtn-confirm-text">Log out of your account?</div>
                    <div className="nv-authbtn-confirm-actions">
                      <button
                        className="nv-authbtn-confirm-cancel"
                        onClick={() => setConfirmingLogout(false)}
                      >
                        Cancel
                      </button>
                      <button
                        className="nv-authbtn-confirm-yes"
                        onClick={handleConfirmLogout}
                      >
                        Log out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <button className="nv-authbtn-pill" onClick={() => setModalOpen(true)}>
            Sign in
          </button>
        )}
      </div>

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
          position: absolute; bottom: 54px; right: 0; width: 230px;
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

        .nv-authbtn-confirm { padding: 10px 8px 4px; display: flex; flex-direction: column; gap: 10px; }
        .nv-authbtn-confirm-text { font-size: 13px; color: #e8e9ec; padding: 0 2px; }
        .nv-authbtn-confirm-actions { display: flex; gap: 8px; }
        .nv-authbtn-confirm-cancel {
          flex: 1; padding: 8px 10px; border-radius: 7px; border: 1px solid #2a2d34;
          background: transparent; color: #e8e9ec; font-size: 12.5px; font-weight: 500; cursor: pointer;
        }
        .nv-authbtn-confirm-cancel:hover { background: #22252b; }
        .nv-authbtn-confirm-yes {
          flex: 1; padding: 8px 10px; border-radius: 7px; border: none;
          background: #e5645f; color: #fff; font-size: 12.5px; font-weight: 600; cursor: pointer;
        }
        .nv-authbtn-confirm-yes:hover { background: #d1544f; }
      `}</style>
    </>
  );
}