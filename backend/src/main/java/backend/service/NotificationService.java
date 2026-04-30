package backend.service;

import backend.model.Notification;
import backend.repository.NotificationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationRepository notificationRepo;
    private final SimpMessagingTemplate messagingTemplate;

    // ─── Create & broadcast ──────────────────────────────────────────────

    public Notification create(String type, String title, String message, String icon) {
        Notification n = Notification.builder()
                .type(type).title(title).message(message).icon(icon)
                .build();
        Notification saved = notificationRepo.save(n);

        // Broadcast via WebSocket
        messagingTemplate.convertAndSend("/topic/notifications", Map.of(
                "id", saved.getId(),
                "type", saved.getType(),
                "title", saved.getTitle(),
                "message", saved.getMessage(),
                "icon", saved.getIcon(),
                "createdAt", saved.getCreatedAt().toString()
        ));

        return saved;
    }

    // ─── Convenience methods ─────────────────────────────────────────────

    public void notifyRaceResult(String raceName, String winnerName, String teamName) {
        create("RACE_RESULT",
                "Race Result Submitted",
                String.format("%s — Winner: %s (%s)", raceName, winnerName, teamName),
                "🏆");
    }

    public void notifyDnf(String driverName, String raceName, String reason) {
        create("DNF",
                "Driver DNF",
                String.format("%s retired from %s — %s", driverName, raceName, reason),
                "🚩");
    }

    public void notifyRaceStatusChange(String raceName, String oldStatus, String newStatus) {
        String icon = newStatus.equals("COMPLETED") ? "✅" :
                      newStatus.equals("CANCELLED") ? "❌" :
                      newStatus.equals("ONGOING") ? "🔴" : "📅";
        create("STATUS_CHANGE",
                "Race Status Updated",
                String.format("%s: %s → %s", raceName, oldStatus, newStatus),
                icon);
    }

    public void notifySystem(String title, String message) {
        create("SYSTEM", title, message, "ℹ️");
    }

    // ─── Queries ─────────────────────────────────────────────────────────

    public List<Notification> getAll() {
        return notificationRepo.findAllByOrderByCreatedAtDesc();
    }

    public List<Notification> getUnread() {
        return notificationRepo.findByReadFalseOrderByCreatedAtDesc();
    }

    public long getUnreadCount() {
        return notificationRepo.countByReadFalse();
    }

    public void markAllRead() {
        notificationRepo.markAllRead();
    }

    public void deleteRead() {
        notificationRepo.deleteAllRead();
    }

    public void markRead(Long id) {
        notificationRepo.findById(id).ifPresent(n -> {
            n.setRead(true);
            notificationRepo.save(n);
        });
    }
}
