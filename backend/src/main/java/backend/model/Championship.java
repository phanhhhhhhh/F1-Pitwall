package backend.model;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import backend.model.enums.ChampionshipType;
import jakarta.persistence.*;
import lombok.*;

@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
@Data @Entity @Builder
@NoArgsConstructor @AllArgsConstructor
@Table(name = "championships")
public class Championship {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private int season;

    @Enumerated(EnumType.STRING)
    private ChampionshipType type;

    private String leaderName;
    private float leaderPoints;
    private float p2Gap;
    private float p3Gap;
}
