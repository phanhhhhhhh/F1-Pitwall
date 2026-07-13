package backend.service;

import backend.dto.ConstructorStandingResponse;
import backend.dto.DriverStandingResponse;
import backend.dto.RaceResultResponse;
import backend.model.Race;
import backend.model.enums.RaceStatus;
import backend.repository.RaceRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.PrintWriter;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class ExportService {

    private final RaceResultService raceResultService;
    private final RaceRepository raceRepository;

    // ─── CSV: Driver Standings ───────────────────────────────────────────

    public byte[] exportDriverStandingsCsv(int season) {
        List<DriverStandingResponse> standings = raceResultService.getDriverStandings(season);

        StringBuilder sb = new StringBuilder();
        sb.append("Position,Driver,Nationality,Team,Points,Wins,Podiums,Fastest Laps,Gap to Leader\n");

        for (DriverStandingResponse d : standings) {
            sb.append(String.format("%d,%s,%s,%s,%.0f,%d,%d,%d,%.0f\n",
                    d.getPosition(),
                    escapeCsv(d.getDriverName()),
                    escapeCsv(d.getNationality()),
                    escapeCsv(d.getTeamName()),
                    d.getTotalPoints(),
                    d.getWins(),
                    d.getPodiums(),
                    d.getFastestLaps(),
                    d.getGapToLeader()
            ));
        }

        return sb.toString().getBytes();
    }

    // ─── CSV: Constructor Standings ──────────────────────────────────────

    public byte[] exportConstructorStandingsCsv(int season) {
        List<ConstructorStandingResponse> standings = raceResultService.getConstructorStandings(season);

        StringBuilder sb = new StringBuilder();
        sb.append("Position,Team,Country,Points,Wins,Podiums,Driver 1,D1 Points,Driver 2,D2 Points,Gap to Leader\n");

        for (ConstructorStandingResponse c : standings) {
            sb.append(String.format("%d,%s,%s,%.0f,%d,%d,%s,%.0f,%s,%.0f,%.0f\n",
                    c.getPosition(),
                    escapeCsv(c.getTeamName()),
                    escapeCsv(c.getCountry()),
                    c.getTotalPoints(),
                    c.getWins(),
                    c.getPodiums(),
                    escapeCsv(c.getDriver1Name()),
                    c.getDriver1Points(),
                    escapeCsv(c.getDriver2Name()),
                    c.getDriver2Points(),
                    c.getGapToLeader()
            ));
        }

        return sb.toString().getBytes();
    }

    // ─── CSV: Race Results ───────────────────────────────────────────────

    public byte[] exportRaceResultsCsv(Long raceId) {
        List<RaceResultResponse> results = raceResultService.getResultsByRace(raceId);
        Race race = raceRepository.findById(raceId).orElseThrow();

        StringBuilder sb = new StringBuilder();
        sb.append(String.format("# %s - Race Results\n", race.getName()));
        sb.append(String.format("# Date: %s | Round: %d | Season: %d\n",
                race.getDate(), race.getRoundNumber(), race.getSeason()));
        sb.append("#\n");
        sb.append("Position,Driver,Team,Car Number,Points,Fastest Lap,DNF Reason\n");

        for (RaceResultResponse r : results) {
            sb.append(String.format("%s,%s,%s,%d,%.0f,%s,%s\n",
                    r.getDnfReason() != null ? "DNF" : String.valueOf(r.getFinishPosition()),
                    escapeCsv(r.getDriverName()),
                    escapeCsv(r.getTeamName()),
                    r.getCarNumber(),
                    r.getPoints(),
                    r.isHasFastestLap() ? "YES" : "",
                    r.getDnfReason() != null ? escapeCsv(r.getDnfReason()) : ""
            ));
        }

        return sb.toString().getBytes();
    }

    // ─── PDF: Race Report ────────────────────────────────────────────────

    public byte[] exportRaceReportPdf(Long raceId) {
        List<RaceResultResponse> results = raceResultService.getResultsByRace(raceId);
        Race race = raceRepository.findById(raceId).orElseThrow();

        // Generate HTML-based PDF using simple text PDF
        String html = buildRaceReportHtml(race, results);
        return generateSimplePdf(html, race.getName() + " - Race Report");
    }

    // ─── PDF: Season Standings ───────────────────────────────────────────

    public byte[] exportStandingsPdf(int season) {
        List<DriverStandingResponse> driverStandings = raceResultService.getDriverStandings(season);
        List<ConstructorStandingResponse> constructorStandings = raceResultService.getConstructorStandings(season);

        String html = buildStandingsHtml(season, driverStandings, constructorStandings);
        return generateSimplePdf(html, "F1 " + season + " Championship Standings");
    }

    // ─── HTML Templates ──────────────────────────────────────────────────

    private String buildRaceReportHtml(Race race, List<RaceResultResponse> results) {
        StringBuilder html = new StringBuilder();
        String generated = LocalDateTime.now().format(DateTimeFormatter.ofPattern("dd MMM yyyy HH:mm"));

        html.append("<!DOCTYPE html><html><head>")
            .append("<meta charset='UTF-8'>")
            .append("<style>")
            .append("body{font-family:Arial,sans-serif;background:#0a0a0a;color:#fff;margin:0;padding:30px;}")
            .append("h1{color:#ef4444;font-size:28px;margin:0 0 4px 0;letter-spacing:2px;}")
            .append("h2{color:#fff;font-size:18px;margin:0 0 20px 0;font-weight:normal;}")
            .append(".meta{color:#666;font-size:12px;margin-bottom:30px;}")
            .append(".header-bar{background:#ef4444;height:3px;margin-bottom:20px;}")
            .append("table{width:100%;border-collapse:collapse;margin-bottom:30px;}")
            .append("th{background:#1a1a1a;color:#ef4444;text-align:left;padding:10px 12px;font-size:11px;letter-spacing:1px;text-transform:uppercase;border-bottom:1px solid #333;}")
            .append("td{padding:9px 12px;font-size:13px;border-bottom:1px solid #1a1a1a;}")
            .append("tr:hover td{background:#111;}")
            .append(".pos-1{color:#fbbf24;font-weight:bold;font-size:16px;}")
            .append(".pos-2{color:#e2e8f0;font-weight:bold;}")
            .append(".pos-3{color:#d97706;font-weight:bold;}")
            .append(".dnf{color:#666;}")
            .append(".fl{background:#7c3aed;color:#fff;padding:2px 6px;border-radius:3px;font-size:10px;font-weight:bold;}")
            .append(".pts{font-weight:bold;color:#ef4444;}")
            .append(".footer{color:#333;font-size:11px;margin-top:20px;border-top:1px solid #1a1a1a;padding-top:12px;}")
            .append(".winner-box{background:#1a0000;border:1px solid #ef4444;border-radius:8px;padding:16px 20px;margin-bottom:24px;display:flex;justify-content:space-between;align-items:center;}")
            .append(".winner-label{color:#ef4444;font-size:10px;letter-spacing:2px;text-transform:uppercase;}")
            .append(".winner-name{color:#fff;font-size:22px;font-weight:bold;margin:4px 0;}")
            .append(".winner-team{color:#999;font-size:13px;}")
            .append(".stat-box{text-align:right;}")
            .append(".stat-val{color:#fff;font-size:20px;font-weight:bold;}")
            .append(".stat-label{color:#666;font-size:10px;letter-spacing:1px;}")
            .append("</style></head><body>");

        // Header
        html.append("<div class='header-bar'></div>")
            .append("<h1>🏎️ F1 PITWALL</h1>")
            .append("<h2>").append(race.getName()).append("</h2>")
            .append("<div class='meta'>")
            .append("Round ").append(race.getRoundNumber())
            .append(" · Season ").append(race.getSeason())
            .append(" · ").append(race.getDate())
            .append(" · Generated ").append(generated)
            .append("</div>");

        // Winner box
        if (!results.isEmpty()) {
            RaceResultResponse winner = results.stream()
                    .filter(r -> r.getFinishPosition() == 1)
                    .findFirst()
                    .orElse(results.get(0));

            RaceResultResponse fastestLap = results.stream()
                    .filter(RaceResultResponse::isHasFastestLap)
                    .findFirst()
                    .orElse(null);

            html.append("<div class='winner-box'>")
                .append("<div>")
                .append("<div class='winner-label'>🏆 Race Winner</div>")
                .append("<div class='winner-name'>").append(winner.getDriverName()).append("</div>")
                .append("<div class='winner-team'>").append(winner.getTeamName()).append("</div>")
                .append("</div>")
                .append("<div class='stat-box'>")
                .append("<div class='stat-val'>").append((int) winner.getPoints()).append(" pts</div>")
                .append("<div class='stat-label'>POINTS SCORED</div>")
                .append("</div>")
                .append("</div>");

            if (fastestLap != null) {
                html.append("<div style='margin-bottom:20px;font-size:13px;color:#999;'>")
                    .append("⚡ Fastest Lap: <span style='color:#a855f7;font-weight:bold;'>")
                    .append(fastestLap.getDriverName()).append("</span>")
                    .append(" (").append(fastestLap.getTeamName()).append(")")
                    .append("</div>");
            }
        }

        // Results table
        html.append("<table>")
            .append("<tr>")
            .append("<th>Pos</th><th>Driver</th><th>Team</th><th>Points</th><th>Notes</th>")
            .append("</tr>");

        for (RaceResultResponse r : results) {
            boolean isDnf = r.getDnfReason() != null;
            String posClass = r.getFinishPosition() == 1 ? "pos-1" :
                              r.getFinishPosition() == 2 ? "pos-2" :
                              r.getFinishPosition() == 3 ? "pos-3" : isDnf ? "dnf" : "";

            html.append("<tr>")
                .append("<td class='").append(posClass).append("'>")
                .append(isDnf ? "DNF" : r.getFinishPosition()).append("</td>")
                .append("<td>").append(r.getDriverName()).append("</td>")
                .append("<td style='color:#999;'>").append(r.getTeamName()).append("</td>")
                .append("<td class='pts'>").append(isDnf ? "-" : (int) r.getPoints()).append("</td>")
                .append("<td>")
                .append(r.isHasFastestLap() ? "<span class='fl'>FL</span> " : "")
                .append(isDnf ? "<span style='color:#666;'>".concat(r.getDnfReason()).concat("</span>") : "")
                .append("</td>")
                .append("</tr>");
        }

        html.append("</table>")
            .append("<div class='footer'>F1 Pitwall SaaS · f1-pitwall-tau.vercel.app · Data for entertainment purposes</div>")
            .append("</body></html>");

        return html.toString();
    }

    private String buildStandingsHtml(int season,
            List<DriverStandingResponse> drivers,
            List<ConstructorStandingResponse> constructors) {

        StringBuilder html = new StringBuilder();
        String generated = LocalDateTime.now().format(DateTimeFormatter.ofPattern("dd MMM yyyy HH:mm"));

        html.append("<!DOCTYPE html><html><head><meta charset='UTF-8'>")
            .append("<style>")
            .append("body{font-family:Arial,sans-serif;background:#0a0a0a;color:#fff;margin:0;padding:30px;}")
            .append("h1{color:#ef4444;font-size:28px;margin:0 0 4px 0;letter-spacing:2px;}")
            .append("h2{color:#fff;font-size:16px;margin:24px 0 12px 0;letter-spacing:1px;text-transform:uppercase;}")
            .append(".meta{color:#666;font-size:12px;margin-bottom:24px;}")
            .append(".header-bar{background:#ef4444;height:3px;margin-bottom:20px;}")
            .append("table{width:100%;border-collapse:collapse;margin-bottom:30px;}")
            .append("th{background:#1a1a1a;color:#ef4444;text-align:left;padding:10px 12px;font-size:11px;letter-spacing:1px;text-transform:uppercase;border-bottom:1px solid #333;}")
            .append("td{padding:8px 12px;font-size:13px;border-bottom:1px solid #1a1a1a;}")
            .append(".pos{font-weight:bold;color:#666;}")
            .append(".pos-1{color:#fbbf24;font-weight:bold;}")
            .append(".pts{font-weight:bold;color:#ef4444;}")
            .append(".gap{color:#666;font-size:12px;}")
            .append(".footer{color:#333;font-size:11px;margin-top:20px;border-top:1px solid #1a1a1a;padding-top:12px;}")
            .append("</style></head><body>")
            .append("<div class='header-bar'></div>")
            .append("<h1>🏎️ F1 PITWALL</h1>")
            .append("<div style='color:#fff;font-size:20px;margin-bottom:4px;'>")
            .append(season).append(" Championship Standings</div>")
            .append("<div class='meta'>Generated ").append(generated).append("</div>");

        // Driver standings
        html.append("<h2>🏆 Driver Championship</h2>")
            .append("<table><tr>")
            .append("<th>Pos</th><th>Driver</th><th>Team</th><th>Pts</th><th>W</th><th>POD</th><th>FL</th><th>Gap</th>")
            .append("</tr>");

        for (DriverStandingResponse d : drivers) {
            html.append("<tr>")
                .append("<td class='").append(d.getPosition() == 1 ? "pos-1" : "pos").append("'>")
                .append(d.getPosition()).append("</td>")
                .append("<td>").append(d.getDriverName()).append("</td>")
                .append("<td style='color:#999;'>").append(d.getTeamName()).append("</td>")
                .append("<td class='pts'>").append((int) d.getTotalPoints()).append("</td>")
                .append("<td>").append(d.getWins()).append("</td>")
                .append("<td>").append(d.getPodiums()).append("</td>")
                .append("<td>").append(d.getFastestLaps()).append("</td>")
                .append("<td class='gap'>")
                .append(d.getGapToLeader() > 0 ? "-" + (int) d.getGapToLeader() : "—")
                .append("</td></tr>");
        }
        html.append("</table>");

        // Constructor standings
        html.append("<h2>🏗️ Constructor Championship</h2>")
            .append("<table><tr>")
            .append("<th>Pos</th><th>Team</th><th>Pts</th><th>W</th><th>POD</th><th>Drivers</th><th>Gap</th>")
            .append("</tr>");

        for (ConstructorStandingResponse c : constructors) {
            html.append("<tr>")
                .append("<td class='").append(c.getPosition() == 1 ? "pos-1" : "pos").append("'>")
                .append(c.getPosition()).append("</td>")
                .append("<td>").append(c.getTeamName()).append("</td>")
                .append("<td class='pts'>").append((int) c.getTotalPoints()).append("</td>")
                .append("<td>").append(c.getWins()).append("</td>")
                .append("<td>").append(c.getPodiums()).append("</td>")
                .append("<td style='color:#999;font-size:12px;'>")
                .append(c.getDriver1Name()).append(" (").append((int)c.getDriver1Points()).append(") / ")
                .append(c.getDriver2Name()).append(" (").append((int)c.getDriver2Points()).append(")")
                .append("</td>")
                .append("<td class='gap'>")
                .append(c.getGapToLeader() > 0 ? "-" + (int) c.getGapToLeader() : "—")
                .append("</td></tr>");
        }
        html.append("</table>")
            .append("<div class='footer'>F1 Pitwall SaaS · f1-pitwall-tau.vercel.app</div>")
            .append("</body></html>");

        return html.toString();
    }

    // ─── PDF Generator (HTML → real PDF via OpenPDF) ───────────────────

    private byte[] generateSimplePdf(String html, String title) {
        try (ByteArrayOutputStream baos = new ByteArrayOutputStream()) {
            com.lowagie.text.Document document = new com.lowagie.text.Document(com.lowagie.text.PageSize.A4.rotate());
            com.lowagie.text.pdf.PdfWriter.getInstance(document, baos);
            document.open();

            // Title — red bold
            com.lowagie.text.Font titleFont = com.lowagie.text.FontFactory.getFont(
                    com.lowagie.text.FontFactory.HELVETICA_BOLD, 18);
            titleFont.setColor(200, 0, 0);
            com.lowagie.text.Paragraph titlePara = new com.lowagie.text.Paragraph(title, titleFont);
            titlePara.setAlignment(com.lowagie.text.Element.ALIGN_CENTER);
            titlePara.setSpacingAfter(20);
            document.add(titlePara);

            // Parse HTML table rows and convert to PDF table
            String[] rows = html.split("<tr>");
            boolean isFirstTable = true;
            for (String row : rows) {
                if (!row.contains("<td") && !row.contains("<th")) continue;
                String[] cells = row.contains("<th") ? row.split("<th[^>]*>") : row.split("<td[^>]*>");
                java.util.List<String> cellTexts = new java.util.ArrayList<>();
                for (String cell : cells) {
                    if (cell.contains("</th>") || cell.contains("</td>")) {
                        cellTexts.add(cell.replaceAll("<[^>]+>", "").replace("&gt;", ">").replace("&lt;", "<").trim());
                    }
                }
                if (cellTexts.isEmpty()) continue;

                int cols = cellTexts.size();
                com.lowagie.text.pdf.PdfPTable table = new com.lowagie.text.pdf.PdfPTable(cols);
                table.setWidthPercentage(100);
                table.setSpacingBefore(6);
                table.setSpacingAfter(4);

                com.lowagie.text.Font cellFont = com.lowagie.text.FontFactory.getFont(
                        isFirstTable ? com.lowagie.text.FontFactory.HELVETICA_BOLD
                                : com.lowagie.text.FontFactory.HELVETICA, 9);
                if (isFirstTable) {
                    cellFont.setColor(255, 255, 255);
                } else {
                    cellFont.setColor(0, 0, 0);
                }

                for (String cell : cellTexts) {
                    com.lowagie.text.pdf.PdfPCell pdfCell = new com.lowagie.text.pdf.PdfPCell(
                            new com.lowagie.text.Phrase(cell, cellFont));
                    pdfCell.setPadding(isFirstTable ? 5 : 3);
                    pdfCell.setBorderWidth(0.5f);
                    table.addCell(pdfCell);
                }
                document.add(table);
                isFirstTable = false;
            }

            // Footer
            com.lowagie.text.Font footerFont = com.lowagie.text.FontFactory.getFont(
                    com.lowagie.text.FontFactory.HELVETICA, 7);
            footerFont.setColor(128, 128, 128);
            com.lowagie.text.Paragraph footer = new com.lowagie.text.Paragraph(
                    "F1 Pitwall · Generated " + LocalDateTime.now().format(DateTimeFormatter.ofPattern("dd MMM yyyy HH:mm")),
                    footerFont);
            footer.setAlignment(com.lowagie.text.Element.ALIGN_CENTER);
            footer.setSpacingBefore(30);
            document.add(footer);

            document.close();
            return baos.toByteArray();
        } catch (Exception e) {
            log.error("PDF generation failed: {}", e.getMessage(), e);
            return ("<html><body><h1>PDF Error</h1><p>" + e.getMessage() + "</p></body></html>")
                    .getBytes(java.nio.charset.StandardCharsets.UTF_8);
        }
    }

    private String escapeCsv(String value) {
        if (value == null) return "";
        if (value.contains(",") || value.contains("\"") || value.contains("\n")) {
            return "\"" + value.replace("\"", "\"\"") + "\"";
        }
        return value;
    }
}
