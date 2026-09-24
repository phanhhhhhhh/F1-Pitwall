/**
 * Full-page navigation, for the few places where a client-side router transition is wrong:
 * logout / expired session must drop every in-memory token and React state, the OAuth
 * callbacks need a fresh load so the proxy sees the just-set session cookie, and authFetch
 * runs outside React so it has no router.
 */
export function hardNavigate(path: string): void {
  window.location.href = path;
}
