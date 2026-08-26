package backend.service;

import backend.dto.RaceNewsRequest;
import backend.dto.RaceNewsResponse;
import backend.model.Race;
import backend.model.RaceNews;
import backend.model.RaceResult;
import backend.model.Team;
import backend.repository.RaceNewsRepository;
import backend.repository.RaceRepository;
import backend.repository.RaceResultRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class RaceNewsService {

    public static final String TAG_RACE_REPORT = "RACE_REPORT";
    public static final String TAG_DRIVER_NEWS = "DRIVER_NEWS";

    private final RaceNewsRepository newsRepo;
    private final RaceRepository raceRepo;
    private final RaceResultRepository raceResultRepo;

    @Transactional(readOnly = true)
    public List<RaceNewsResponse> listBySeason(int season) {
        return newsRepo.findByRaceSeasonOrderByRaceDateDescIdDesc(season)
                .stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public RaceNewsResponse getById(Long id) {
        return toResponse(newsRepo.findByIdWithRace(id)
                .orElseThrow(() -> new EntityNotFoundException("Race news not found: " + id)));
    }

    @Transactional
    public RaceNewsResponse create(RaceNewsRequest request) {
        Race race = raceRepo.findById(request.getRaceId())
                .orElseThrow(() -> new EntityNotFoundException("Race not found: " + request.getRaceId()));
        RaceNews news = RaceNews.builder()
                .race(race)
                .title(request.getTitle())
                .content(request.getContent())
                .tag(request.getTag())
                .build();
        return toResponse(newsRepo.save(news));
    }

    @Transactional
    public RaceNewsResponse update(Long id, RaceNewsRequest request) {
        RaceNews news = newsRepo.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Race news not found: " + id));
        if (request.getTitle() != null) news.setTitle(request.getTitle());
        if (request.getContent() != null) news.setContent(request.getContent());
        if (request.getTag() != null) news.setTag(request.getTag());
        if (request.getRaceId() != null) {
            news.setRace(raceRepo.findById(request.getRaceId())
                    .orElseThrow(() -> new EntityNotFoundException("Race not found: " + request.getRaceId())));
        }
        return toResponse(newsRepo.save(news));
    }

    @Transactional
    public void delete(Long id) {
        newsRepo.deleteById(id);
    }

    /**
     * Upserts the auto-generated race report for a synced race.
     * Keyed by (raceId, RACE_REPORT) so re-syncs update instead of duplicate.
     * Sprint rounds are skipped — reports cover Grands Prix only.
     * <p>
     * Never throws: it is called from inside the results-sync transaction and
     * a report failure must not roll back (or mark rollback-only) a sync that
     * already succeeded.
     */
    @Transactional
    public void generateRaceReport(Race race) {
        try {
            generateRaceReportInternal(race);
        } catch (Exception e) {
            log.warn("[News] Failed to generate race report for {}: {}", race.getName(), e.getMessage());
        }
    }

    private void generateRaceReportInternal(Race race) {
        if (race.getName() != null && race.getName().toLowerCase().contains("sprint")) return;

        List<RaceResult> results = raceResultRepo.findByRaceIdOrderByFinishPosition(race.getId());
        if (results.isEmpty()) return;

        List<RaceResult> classified = results.stream()
                .filter(r -> r.getFinishPosition() >= 1 && r.getDnfReason() == null)
                .sorted(Comparator.comparingInt(RaceResult::getFinishPosition))
                .toList();
        if (classified.isEmpty()) return;

        RaceResult winner = classified.get(0);
        String title = race.getName() + " " + race.getSeason() + " — Race Report";

        StringBuilder content = new StringBuilder();
        content.append("🏆 ").append(winner.getDriver().getName())
                .append(" wins the ").append(race.getName()).append(".\n");
        if (teamOf(winner) != null) {
            content.append("Victory for ").append(teamOf(winner).getName()).append(".\n");
        }

        if (classified.size() >= 3) {
            content.append("\nPODIUM\n");
            for (int i = 0; i < 3; i++) {
                RaceResult r = classified.get(i);
                content.append(i + 1).append(". ").append(r.getDriver().getName());
                if (teamOf(r) != null) {
                    content.append(" (").append(teamOf(r).getName()).append(")");
                }
                content.append("\n");
            }
        }

        results.stream()
                .filter(r -> r.isHasFastestLap() || r.getFastestLapTime() > 0)
                .min(Comparator.comparingDouble(RaceResult::getFastestLapTime))
                .ifPresent(fl -> content.append("\nFASTEST LAP\n")
                        .append(fl.getDriver().getName())
                        .append(" — ").append(String.format("%.3fs", fl.getFastestLapTime())).append("\n"));

        List<RaceResult> dnfs = results.stream()
                .filter(r -> r.getDnfReason() != null && !r.getDnfReason().isEmpty())
                .toList();
        if (!dnfs.isEmpty()) {
            content.append("\nDID NOT FINISH\n");
            dnfs.forEach(r -> content.append(r.getDriver().getName())
                    .append(" — ").append(r.getDnfReason()).append("\n"));
        }

        newsRepo.findByRaceIdAndTag(race.getId(), TAG_RACE_REPORT)
                .ifPresentOrElse(existing -> {
                    existing.setTitle(title);
                    existing.setContent(content.toString());
                    newsRepo.save(existing);
                }, () -> newsRepo.save(RaceNews.builder()
                        .race(race)
                        .title(title)
                        .tag(TAG_RACE_REPORT)
                        .content(content.toString())
                        .build()));
    }

    /** Per-result team snapshot wins over the driver's current team. */
    private static Team teamOf(RaceResult r) {
        return r.getTeam() != null ? r.getTeam() : r.getDriver().getTeam();
    }

    private RaceNewsResponse toResponse(RaceNews n) {
        Race race = n.getRace();
        return RaceNewsResponse.builder()
                .id(n.getId())
                .title(n.getTitle())
                .content(n.getContent())
                .tag(n.getTag())
                .createdAt(n.getCreatedAt())
                .raceId(race.getId())
                .raceName(race.getName())
                .roundNumber(race.getRoundNumber())
                .season(race.getSeason())
                .raceDate(race.getDate())
                .build();
    }
}
