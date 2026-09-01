import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  authFetch,
  clearTokens,
  getAccessToken,
  isApiError,
  setTokens,
} from "./pitwall-auth";

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

describe("token storage", () => {
  afterEach(() => {
    clearTokens();
  });

  it("round-trips an access token through setTokens/getAccessToken", () => {
    setTokens("access-123", "refresh-456");
    expect(getAccessToken()).toBe("access-123");
    expect(sessionStorage.getItem("pitwall_access")).toBe("access-123");
    expect(sessionStorage.getItem("pitwall_refresh")).toBe("refresh-456");
  });

  it("clearTokens removes both the in-memory and stored copies", () => {
    setTokens("access-123", "refresh-456");
    clearTokens();
    expect(getAccessToken()).toBeNull();
    expect(sessionStorage.getItem("pitwall_access")).toBeNull();
    expect(sessionStorage.getItem("pitwall_refresh")).toBeNull();
  });
});

describe("ApiError / isApiError", () => {
  it("identifies an ApiError instance and carries its status", () => {
    const err = new ApiError(404, "not found");
    expect(isApiError(err)).toBe(true);
    expect(err.status).toBe(404);
  });

  it("rejects a plain Error", () => {
    expect(isApiError(new Error("boom"))).toBe(false);
  });
});

describe("authFetch", () => {
  beforeEach(() => {
    clearTokens();
  });
  afterEach(() => {
    clearTokens();
    vi.unstubAllGlobals();
  });

  it("attaches the bearer token from storage to the request", async () => {
    setTokens("access-123", "refresh-456");
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await authFetch("http://api.test/thing");

    const [, options] = fetchMock.mock.calls[0];
    const headers = options.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer access-123");
  });

  it("omits the Authorization header when there is no token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await authFetch("http://api.test/thing");

    const [, options] = fetchMock.mock.calls[0];
    const headers = options.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });

  it("on a 401 with a refresh token, refreshes once and retries the original request", async () => {
    setTokens("stale-access", "refresh-456");
    const fetchMock = vi
      .fn()
      // 1) the original request comes back unauthorized
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      // 2) the refresh call succeeds with a new access token
      .mockResolvedValueOnce(jsonResponse({ accessToken: "fresh-access" }))
      // 3) the retried original request succeeds
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await authFetch("http://api.test/thing");

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(res.status).toBe(200);
    expect(getAccessToken()).toBe("fresh-access");

    const retryHeaders = fetchMock.mock.calls[2][1].headers as Record<string, string>;
    expect(retryHeaders.Authorization).toBe("Bearer fresh-access");
    // The retry must still carry Content-Type, or every retried POST/PATCH 415s.
    expect(retryHeaders["Content-Type"]).toBe("application/json");
  });

  it("clears tokens when the refresh call itself fails", async () => {
    setTokens("stale-access", "refresh-456");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 401 })); // refresh fails
    vi.stubGlobal("fetch", fetchMock);
    // authFetch navigates to /login on a failed refresh — stub it out so jsdom doesn't warn.
    // @ts-expect-error jsdom's location is not fully navigable in tests
    delete window.location;
    window.location = { href: "" } as Location;

    await authFetch("http://api.test/thing");

    expect(getAccessToken()).toBeNull();
    expect(window.location.href).toBe("/login");
  });

  it("throws ApiError with the server's error message on a non-401 failure", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ error: "circuit not found" }, { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(authFetch("http://api.test/thing")).rejects.toMatchObject({
      status: 404,
      message: "circuit not found",
    });
  });

  it("converts an aborted fetch into a 408 ApiError", async () => {
    // authFetch only checks `err instanceof Error && err.name === "AbortError"` — a plain
    // Error works and sidesteps whether the test/jsdom realm's DOMException extends Error.
    const abortError = Object.assign(new Error("The operation was aborted"), { name: "AbortError" });
    const fetchMock = vi.fn().mockRejectedValue(abortError);
    vi.stubGlobal("fetch", fetchMock);

    await expect(authFetch("http://api.test/thing")).rejects.toMatchObject({ status: 408 });
  });
});
