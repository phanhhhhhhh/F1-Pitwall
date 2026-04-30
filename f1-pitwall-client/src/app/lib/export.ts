// src/app/lib/export.ts
// Helper functions để download files từ backend

import { getAccessToken } from "./pitwall-auth";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

async function downloadFile(url: string, filename: string, mimeType: string) {
  const token = getAccessToken();
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) throw new Error("Export failed");

  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(new Blob([blob], { type: mimeType }));
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(blobUrl);
}

// ─── CSV Downloads ──────────────────────────────────────────────────────

export async function downloadDriverStandingsCsv(season: number) {
  await downloadFile(
    `${API}/api/export/csv/drivers/standings/${season}`,
    `driver-standings-${season}.csv`,
    "text/csv"
  );
}

export async function downloadConstructorStandingsCsv(season: number) {
  await downloadFile(
    `${API}/api/export/csv/constructors/standings/${season}`,
    `constructor-standings-${season}.csv`,
    "text/csv"
  );
}

export async function downloadRaceResultsCsv(raceId: number, raceName: string) {
  const filename = raceName.toLowerCase().replace(/ /g, "-") + "-results.csv";
  await downloadFile(
    `${API}/api/export/csv/race/${raceId}/results`,
    filename,
    "text/csv"
  );
}

// ─── PDF/HTML Downloads ─────────────────────────────────────────────────

export async function downloadRaceReportPdf(raceId: number, raceName: string) {
  const filename = raceName.toLowerCase().replace(/ /g, "-") + "-report.html";
  await downloadFile(
    `${API}/api/export/pdf/race/${raceId}/report`,
    filename,
    "text/html"
  );
}

export async function downloadStandingsPdf(season: number) {
  await downloadFile(
    `${API}/api/export/pdf/standings/${season}`,
    `f1-standings-${season}.html`,
    "text/html"
  );
}
