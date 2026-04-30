package backend.repository;

import backend.model.Notification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

public interface NotificationRepository extends JpaRepository<Notification, Long> {

    List<Notification> findAllByOrderByCreatedAtDesc();

    List<Notification> findByReadFalseOrderByCreatedAtDesc();

    long countByReadFalse();

    @Modifying
    @Transactional
    @Query("UPDATE Notification n SET n.read = true")
    void markAllRead();

    @Modifying
    @Transactional
    @Query("DELETE FROM Notification n WHERE n.read = true")
    void deleteAllRead();
}
