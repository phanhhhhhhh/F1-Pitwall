package backend.model;

import backend.model.enums.RaceStatus;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.util.List;

@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
@Data @Entity @Builder
@NoArgsConstructor @AllArgsConstructor
@Table(name = "races")
public class Race {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;
    private LocalDate date;
    private int season;
    private int roundNumber;

    @Enumerated(EnumType.STRING)
    private RaceStatus status;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "circuit_id")
    @ToString.Exclude @EqualsAndHashCode.Exclude
    private Circuit circuit;

    @JsonIgnore
    @OneToMany(mappedBy = "race", cascade = CascadeType.ALL)
    @ToString.Exclude @EqualsAndHashCode.Exclude
    private List<RaceResult> results;

    @JsonIgnore
    @OneToMany(mappedBy = "race", cascade = CascadeType.ALL)
    @ToString.Exclude @EqualsAndHashCode.Exclude
    private List<WeatherCondition> weatherConditions;

    @JsonIgnore
    @OneToMany(mappedBy = "race", cascade = CascadeType.ALL)
    @ToString.Exclude @EqualsAndHashCode.Exclude
    private List<Incident> incidents;

    @JsonIgnore
    @OneToMany(mappedBy = "race", cascade = CascadeType.ALL)
    @ToString.Exclude @EqualsAndHashCode.Exclude
    private List<StrategyPlan> strategyPlans;

    @JsonIgnore
    @OneToMany(mappedBy = "race", cascade = CascadeType.ALL)
    @ToString.Exclude @EqualsAndHashCode.Exclude
    private List<CarSetup> carSetups;
}
