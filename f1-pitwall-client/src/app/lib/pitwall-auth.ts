const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export interface AuthResponse {
    accessToken: string;
    refreshToken: string;
    username: string;
    role: string;
    expiresIn: number;
}

export interface User {
    id: number;
    username: string;
    email: string;
    role: string;
    createdAt: string;
    displayName?: string;
    avatarUrl?: string;
    phone?: string;
    bio?: string;
    location?: string;
    dateOfBirth?: string;
}

let accessToken: string | null = null;
let refreshToken: string | null = null;
let refreshPromise: Promise<boolean> | null = null;

const isBrowser = () => typeof window !== "undefined";

export function setTokens(access: string, refresh: string) {
    accessToken = access;
    refreshToken = refresh;
    if (isBrowser()) {
        localStorage.setItem("pitwall_access", access);
        localStorage.setItem("pitwall_refresh", refresh);
        document.cookie = "pitwall_session=1; path=/; SameSite=Strict";
    }
}

export function getAccessToken(): string | null {
    if (!accessToken && isBrowser()) {
        accessToken = localStorage.getItem("pitwall_access");
    }
    return accessToken;
}

export function clearTokens() {
    accessToken = null;
    refreshToken = null;
    if (isBrowser()) {
        localStorage.removeItem("pitwall_access");
        localStorage.removeItem("pitwall_refresh");
        localStorage.removeItem("pitwall_username");
        localStorage.removeItem("pitwall_role");
        localStorage.removeItem("pitwall_avatar");
        localStorage.removeItem("pitwall_displayname");
        document.cookie = "pitwall_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    }
}

export async function login(username: string, password: string): Promise<AuthResponse> {
    const res = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Login failed");
    }
    const data: AuthResponse = await res.json();
    setTokens(data.accessToken, data.refreshToken);
    if (isBrowser()) {
        localStorage.setItem("pitwall_username", data.username);
        localStorage.setItem("pitwall_role", data.role);
    }
    return data;
}

export async function register(username: string, password: string, email: string): Promise<AuthResponse> {
    const res = await fetch(`${API_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, email }),
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Registration failed");
    }
    const data: AuthResponse = await res.json();
    setTokens(data.accessToken, data.refreshToken);
    if (isBrowser()) {
        localStorage.setItem("pitwall_username", data.username);
        localStorage.setItem("pitwall_role", data.role);
    }
    return data;
}

const REQUEST_TIMEOUT_MS = 10_000;

export class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
        super(message);
        this.name = "ApiError";
        this.status = status;
    }
}

export function isApiError(err: unknown): err is ApiError {
    return err instanceof ApiError;
}

export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const token = getAccessToken();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let res: Response;
    try {
        res = await fetch(url, {
            ...options,
            signal: controller.signal,
            headers: {
                ...options.headers,
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
        });
    } catch (err: unknown) {
        clearTimeout(timeoutId);
        if (err instanceof Error && err.name === "AbortError") {
            throw new ApiError(408, `Request timed out after ${REQUEST_TIMEOUT_MS / 1000}s`);
        }
        throw err;
    }
    clearTimeout(timeoutId);

    const currentRefresh = refreshToken || (isBrowser() ? localStorage.getItem("pitwall_refresh") : null);
    if (res.status === 401 && currentRefresh) {
        const refreshed = await tryRefreshToken();
        if (refreshed) {
            return fetch(url, {
                ...options,
                headers: { ...options.headers, Authorization: `Bearer ${getAccessToken()}` },
            });
        } else {
            clearTokens();
            if (isBrowser()) window.location.href = "/login";
        }
    }

    if (!res.ok && res.status !== 401) {
        let message = `HTTP ${res.status}`;
        try {
            const body = await res.clone().json();
            if (body?.error) message = body.error;
            else if (body?.message) message = body.message;
        } catch {
            // ignore JSON parse failure; keep default message
        }
        throw new ApiError(res.status, message);
    }

    return res;
}

async function doRefresh(): Promise<boolean> {
    try {
        const stored = refreshToken || (isBrowser() ? localStorage.getItem("pitwall_refresh") : null);
        if (!stored) return false;
        const res = await fetch(`${API_URL}/api/auth/refresh`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refreshToken: stored }),
        });
        if (res.ok) {
            const data = await res.json();
            accessToken = data.accessToken;
            if (isBrowser()) localStorage.setItem("pitwall_access", data.accessToken);
            return true;
        }
    } catch (e) { console.warn("Token refresh failed:", e); }
    return false;
}

async function tryRefreshToken(): Promise<boolean> {
    if (refreshPromise) return refreshPromise;
    refreshPromise = doRefresh().finally(() => { refreshPromise = null; });
    return refreshPromise;
}

// ── Forgot password ────────────────────────────────────────────────────────

export async function sendForgotPasswordOtp(email: string): Promise<void> {
    const res = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to send reset code");
    }
}

export async function resetPassword(email: string, otp: string, newPassword: string): Promise<void> {
    const res = await fetch(`${API_URL}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp, newPassword }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Password reset failed");
    }
}

// ── OTP login (passwordless) ───────────────────────────────────────────────

export async function sendLoginOtp(email: string): Promise<void> {
    const res = await fetch(`${API_URL}/api/auth/otp/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to send OTP");
    }
}

export async function verifyLoginOtp(email: string, otp: string): Promise<AuthResponse> {
    const res = await fetch(`${API_URL}/api/auth/otp/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "OTP verification failed");
    }
    const data: AuthResponse = await res.json();
    setTokens(data.accessToken, data.refreshToken);
    if (isBrowser()) {
        localStorage.setItem("pitwall_username", data.username);
        localStorage.setItem("pitwall_role", data.role);
    }
    return data;
}

// ── OAuth2 2FA ─────────────────────────────────────────────────────────────

export async function verifyOauth2Otp(email: string, otp: string): Promise<AuthResponse> {
    const res = await fetch(`${API_URL}/api/auth/oauth2/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "OTP verification failed");
    }
    const data: AuthResponse = await res.json();
    setTokens(data.accessToken, data.refreshToken);
    if (isBrowser()) {
        localStorage.setItem("pitwall_username", data.username);
        localStorage.setItem("pitwall_role", data.role);
    }
    return data;
}

export async function sendOauth2Otp(email: string): Promise<void> {
    const res = await fetch(`${API_URL}/api/auth/oauth2/resend-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to resend OTP");
    }
}