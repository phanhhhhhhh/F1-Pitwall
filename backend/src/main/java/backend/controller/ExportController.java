package backend.controller;

import backend.service.ExportService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/export")
@RequiredArgsConstructor
public class ExportController {

    private final ExportService exportService;

    // ─── CSV Exports ────────────────────────────────────────────────────

    @GetMapping("/csv/drivers/standings/{season}")
    public ResponseEntity<byte[]> exportDriverStandingsCsv(@PathVariable int season) {
        byte[] csv = exportService.exportDriverStandingsCsv(season);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"driver-standings-" + season + ".csv\"")
                .contentType(MediaType.parseMediaType("text/csv"))
                .body(csv);
    }

    @GetMapping("/csv/constructors/standings/{season}")
    public ResponseEntity<byte[]> exportConstructorStandingsCsv(@PathVariable int season) {
        byte[] csv = exportService.exportConstructorStandingsCsv(season);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"constructor-standings-" + season + ".csv\"")
                .contentType(MediaType.parseMediaType("text/csv"))
                .body(csv);
    }

    @GetMapping("/csv/race/{raceId}/results")
    public ResponseEntity<byte[]> exportRaceResultsCsv(@PathVariable Long raceId) {
        byte[] csv = exportService.exportRaceResultsCsv(raceId);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"race-" + raceId + "-results.csv\"")
                .contentType(MediaType.parseMediaType("text/csv"))
                .body(csv);
    }

    // ─── PDF Exports ────────────────────────────────────────────────────

    @GetMapping("/pdf/race/{raceId}/report")
    public ResponseEntity<byte[]> exportRaceReportPdf(@PathVariable Long raceId) {
        byte[] pdf = exportService.exportRaceReportPdf(raceId);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"race-" + raceId + "-report.pdf\"")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdf);
    }

    @GetMapping("/pdf/standings/{season}")
    public ResponseEntity<byte[]> exportStandingsPdf(@PathVariable int season) {
        byte[] pdf = exportService.exportStandingsPdf(season);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"standings-" + season + ".pdf\"")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdf);
    }
}
