package backend.service;

import backend.model.AdminAuditEntry;
import backend.repository.AdminAuditRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

/** Append-only record of admin actions. Never carries secrets — passwords are not logged. */
@Slf4j
@Service
@RequiredArgsConstructor
public class AdminAuditService {

    private final AdminAuditRepository repository;

    /** Records the action for the current caller. A failure to write is logged, not thrown: it must not undo the action itself. */
    public void record(String action, String target, String detail) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String actor = auth != null ? auth.getName() : "system";
        try {
            repository.save(AdminAuditEntry.builder()
                    .actor(actor).action(action)
                    .target(truncate(target, 255)).detail(truncate(detail, 500))
                    .createdAt(Instant.now()).build());
        } catch (RuntimeException e) {
            log.error("[Audit] Could not record {} by {} on {}: {}", action, actor, target, e.getMessage());
        }
    }

    public List<AdminAuditEntry> recent() {
        return repository.findTop100ByOrderByIdDesc();
    }

    private static String truncate(String value, int max) {
        return value == null || value.length() <= max ? value : value.substring(0, max);
    }
}
