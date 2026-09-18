"use client";

import { BASE_URL as API } from "../../lib/api-client";
import { F1 } from "../../lib/f1-theme";

interface GoogleButtonProps {
  label?: string;
  className?: string;
}

export function GoogleButton({ label = "Continue with Google", className = "" }: GoogleButtonProps) {
  // Bind this browser to the OAuth round-trip so the callback can reject a
  // crafted /oauth2/callback?accessToken=... link that didn't originate from
  // a login this tab actually started (login CSRF / session fixation).
  //
  // The nonce goes in sessionStorage (read back by the callback page) AND in
  // a SameSite=Lax cookie — the cookie is what actually survives the redirect
  // through Google and back, since OAuth2SuccessHandler reads it server-side
  // and echoes it back as `state` on the final /oauth2/callback redirect.
  const handleClick = () => {
    try {
      const state = crypto.randomUUID();
      sessionStorage.setItem("oauth_state", state);
      const secure = window.location.protocol === "https:" ? "; Secure" : "";
      document.cookie = `oauth_state=${state}; path=/; max-age=300; samesite=lax${secure}`;
    } catch {
      // sessionStorage/cookies unavailable (private mode / disabled) — the
      // callback page fails closed in that case, so login is blocked rather
      // than silently skipping the check.
    }
  };

  return (
    <a
      href={`${API}/oauth2/authorize/google`}
      onClick={handleClick}
      className={`flex items-center justify-center gap-3 w-full py-3 rounded-lg border transition-all duration-200 f-mono text-xs font-bold uppercase tracking-wider text-white group ${className}`}
      style={{
        borderColor: F1.hairline,
        background: "rgba(255,255,255,0.03)",
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(255,255,255,0.15)";
        (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.06)";
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLAnchorElement).style.borderColor = F1.hairline;
        (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.03)";
      }}
    >
      <svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 002.38-5.88c0-.57-.05-.66-.15-1.18z" />
        <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 01-7.18-2.54H1.83v2.07A8 8 0 008.98 17z" />
        <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 010-3.04V5.41H1.83a8 8 0 000 7.18l2.67-2.07z" />
        <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 001.83 5.4L4.5 7.49a4.77 4.77 0 014.48-3.3z" />
      </svg>
      {label}
    </a>
  );
}
