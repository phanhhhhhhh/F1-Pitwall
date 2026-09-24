import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { authFetch, getAccessToken, clearTokens, serverLogout, hardNavigate } = vi.hoisted(() => ({
  authFetch: vi.fn(),
  getAccessToken: vi.fn(),
  clearTokens: vi.fn(),
  serverLogout: vi.fn(),
  hardNavigate: vi.fn(),
}));

vi.mock("../lib/pitwall-auth", () => ({ authFetch, getAccessToken, clearTokens, serverLogout }));
vi.mock("../lib/navigation", () => ({ hardNavigate }));

import { AuthProvider, useAuth } from "./AuthContext";

function Probe() {
  const { user, isLoading, isAuthenticated, logout } = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(isLoading)}</span>
      <span data-testid="auth">{String(isAuthenticated)}</span>
      <span data-testid="name">{user?.username ?? "-"}</span>
      <button onClick={logout}>logout</button>
    </div>
  );
}

const renderProvider = () => render(<AuthProvider><Probe /></AuthProvider>);

const meResponse = (status: number, body: object = {}) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  window.history.pushState({}, "", "/");
});

describe("AuthProvider", () => {
  it("stays logged out without touching the network when there is no token", async () => {
    getAccessToken.mockReturnValue(null);
    renderProvider();

    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));
    expect(screen.getByTestId("auth")).toHaveTextContent("false");
    expect(authFetch).not.toHaveBeenCalled();
  });

  it("loads the current user from /me and caches avatar and display name", async () => {
    getAccessToken.mockReturnValue("tok");
    authFetch.mockReturnValue(meResponse(200, { id: 7, username: "sam", role: "ENGINEER", avatarUrl: "https://x/a.png", displayName: "Sam" }));
    renderProvider();

    await waitFor(() => expect(screen.getByTestId("name")).toHaveTextContent("sam"));
    expect(screen.getByTestId("auth")).toHaveTextContent("true");
    expect(localStorage.getItem("pitwall_avatar")).toBe("https://x/a.png");
    expect(localStorage.getItem("pitwall_displayname")).toBe("Sam");
  });

  it("shows the cached user immediately, before /me answers", async () => {
    getAccessToken.mockReturnValue("tok");
    localStorage.setItem("pitwall_username", "cached-user");
    authFetch.mockReturnValue(new Promise(() => {})); // never resolves
    renderProvider();

    await waitFor(() => expect(screen.getByTestId("name")).toHaveTextContent("cached-user"));
    expect(screen.getByTestId("loading")).toHaveTextContent("true");
  });

  it("clears the session and goes to /login when the token is rejected on a protected page", async () => {
    getAccessToken.mockReturnValue("stale");
    authFetch.mockReturnValue(meResponse(401));
    renderProvider();

    await waitFor(() => expect(hardNavigate).toHaveBeenCalledWith("/login"));
    expect(clearTokens).toHaveBeenCalled();
  });

  it("clears a rejected token but does not redirect when already on a public page", async () => {
    window.history.pushState({}, "", "/login");
    getAccessToken.mockReturnValue("stale");
    authFetch.mockReturnValue(meResponse(401));
    renderProvider();

    await waitFor(() => expect(clearTokens).toHaveBeenCalled());
    expect(hardNavigate).not.toHaveBeenCalled();
  });

  it("logout revokes server-side, drops the user and navigates to /login", async () => {
    getAccessToken.mockReturnValue("tok");
    authFetch.mockReturnValue(meResponse(200, { id: 1, username: "sam", role: "VIEWER" }));
    const user = userEvent.setup();
    renderProvider();
    await waitFor(() => expect(screen.getByTestId("name")).toHaveTextContent("sam"));

    await user.click(screen.getByRole("button", { name: "logout" }));

    expect(serverLogout).toHaveBeenCalled();
    expect(screen.getByTestId("auth")).toHaveTextContent("false");
    expect(hardNavigate).toHaveBeenCalledWith("/login");
  });

  it("useAuth throws outside a provider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(/within an AuthProvider/);
    spy.mockRestore();
  });
});
