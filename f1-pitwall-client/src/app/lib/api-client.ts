import { authFetch } from "./pitwall-auth";

export const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export { authFetch };

export const api = {
  drivers: {
    getAll: () => authFetch(`${BASE_URL}/api/drivers`),
  },
  teams: {
    getAll: () => authFetch(`${BASE_URL}/api/teams`),
  },
  races: {
    getBySeason: (year: number) => authFetch(`${BASE_URL}/api/races/season/${year}`),
    getById: (id: string | number) => authFetch(`${BASE_URL}/api/races/${id}`),
    getWinners: (year: number) => authFetch(`${BASE_URL}/api/race-results/winners/${year}`),
  },
  circuits: {
    getAll: () => authFetch(`${BASE_URL}/api/circuits`),
  },
  standings: {
    drivers: (year: number) => authFetch(`${BASE_URL}/api/race-results/standings/drivers/${year}`),
    constructors: (year: number) => authFetch(`${BASE_URL}/api/race-results/standings/constructors/${year}`),
  },
  raceResults: {
    getByRace: (raceId: string | number) => authFetch(`${BASE_URL}/api/race-results/race/${raceId}`),
    getQualifying: (raceId: string | number) => authFetch(`${BASE_URL}/api/race-results/qualifying/${raceId}`),
  },
  auth: {
    me: () => authFetch(`${BASE_URL}/api/auth/me`),
    updateProfile: (data: Record<string, unknown>) =>
      authFetch(`${BASE_URL}/api/auth/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
  },
  admin: {
    users: () => authFetch(`${BASE_URL}/api/admin/users`),
  },
  strategy: {
    getByRace: (raceId: string | number) => authFetch(`${BASE_URL}/api/strategy/${raceId}`),
  },
  telemetry: {
    getByRace: (raceId: string | number) => authFetch(`${BASE_URL}/api/telemetry/${raceId}`),
  },
  notifications: {
    getAll: () => authFetch(`${BASE_URL}/api/notifications`),
    markRead: (id: number) =>
      authFetch(`${BASE_URL}/api/notifications/${id}/read`, { method: "POST" }),
    markAllRead: () =>
      authFetch(`${BASE_URL}/api/notifications/read-all`, { method: "POST" }),
  },
};
