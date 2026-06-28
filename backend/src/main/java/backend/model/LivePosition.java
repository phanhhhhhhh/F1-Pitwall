package backend.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
@Data @Entity @Builder
@NoArgsConstructor @AllArgsConstructor
@Table(name = "live_positions")
public class LivePosition {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private int sessionKey;

    private int driverNumber;

    private int position;

    private Instant timestamp;
}
