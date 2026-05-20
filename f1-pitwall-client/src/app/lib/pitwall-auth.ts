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
}

let accessToken: string | null = null;
let refreshToken: string | null = null;
let refreshPromise: Promise<boolean> | null = null;

const isBrowser = () => typeof window !== "undefined";

export function setTokens(access: string, refresh: string) {
    accessToken = access;
    refreshToken = refresh;
    if (isBrowser()) {
        sessionStorage.setItem("pitwall_access", access);
        sessionStorage.setItem("pitwall_refresh", refresh);
        document.cookie = "pitwall_session=1; path=/; SameSite=Strict";
    }
}

export function getAccessToken(): string | null {
    if (!accessToken && isBrowser()) {
        accessToken = sessionStorage.getItem("pitwall_access");
    }
    return accessToken;
}

export function clearTokens() {
    accessToken = null;
    refreshToken = null;
    if (isBrowser()) {
        sessionStorage.removeItem("pitwall_access");
        sessionStorage.removeItem("pitwall_refresh");
        sessionStorage.removeItem("pitwall_username");
        sessionStorage.removeItem("pitwall_role");
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
        sessionStorage.setItem("pitwall_username", data.username);
        sessionStorage.setItem("pitwall_role", data.role);
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
        sessionStorage.setItem("pitwall_username", data.username);
        sessionStorage.setItem("pitwall_role", data.role);
    }
    return data;
}

export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const token = getAccessToken();

    const res = await fetch(url, {
        ...options,
        headers: {
            ...options.headers,
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
    });

    const currentRefresh = refreshToken || (isBrowser() ? sessionStorage.getItem("pitwall_refresh") : null);

    if (res.status === 401 && currentRefresh) {
        const refreshed = await tryRefreshToken();
        if (refreshed) {
            return fetch(url, {
                ...options,
                headers: {
                    ...options.headers,
                    Authorization: `Bearer ${getAccessToken()}`,
                },
            });
        } else {
            clearTokens();
            if (isBrowser()) window.location.href = "/login";
        }
    }

    return res;
}

async function doRefresh(): Promise<boolean> {
    try {
        const stored = refreshToken || (isBrowser() ? sessionStorage.getItem("pitwall_refresh") : null);
        if (!stored) return false;

        const res = await fetch(`${API_URL}/api/auth/refresh`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refreshToken: stored }),
        });

        if (res.ok) {
            const data = await res.json();
            accessToken = data.accessToken;
            if (isBrowser()) sessionStorage.setItem("pitwall_access", data.accessToken);
            return true;
        }
    } catch (e) {
        console.warn("Token refresh failed:", e);
    }
    return false;
}

async function tryRefreshToken(): Promise<boolean> {
    if (refreshPromise) return refreshPromise;
    refreshPromise = doRefresh().finally(() => { refreshPromise = null; });
    return refreshPromise;
}