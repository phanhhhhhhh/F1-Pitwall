import { getAccessToken } from "./pitwall-auth";
import { BASE_URL as API } from "./api-client";

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

export async function downloadRaceReportPdf(raceId: number, raceName: string) {
  const filename = raceName.toLowerCase().replace(/ /g, "-") + "-report.pdf";
  await downloadFile(
    `${API}/api/export/pdf/race/${raceId}/report`,
    filename,
    "application/pdf"
  );
}

export async function downloadStandingsPdf(season: number) {
  await downloadFile(
    `${API}/api/export/pdf/standings/${season}`,
    `f1-standings-${season}.pdf`,
    "application/pdf"
  );
}
