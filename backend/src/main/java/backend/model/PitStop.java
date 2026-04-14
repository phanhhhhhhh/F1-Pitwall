package backend.model;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import backend.model.enums.TyreType;
import jakarta.persistence.*;
import lombok.*;

@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
@Data @Entity @Builder
@NoArgsConstructor @AllArgsConstructor
@Table(name = "pit_stops")
public class PitStop {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private int lapNumber;
    private float durationSec;

    @Enumerated(EnumType.STRING)
    private TyreType tyreIn;

    @Enumerated(EnumType.STRING)
    private TyreType tyreOut;

    private int crewSize;
    private boolean underSafetyCar;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "race_result_id")
    @ToString.Exclude @EqualsAndHashCode.Exclude
    private RaceResult raceResult;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "tyre_compound_id")
    @ToString.Exclude @EqualsAndHashCode.Exclude
    private TyreCompound tyreCompound;
}
