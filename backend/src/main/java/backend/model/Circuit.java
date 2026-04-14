package backend.model;

import backend.model.enums.CircuitType;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.*;

import java.util.List;

@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
@Data @Entity @Builder
@NoArgsConstructor @AllArgsConstructor
@Table(name = "circuits")
public class Circuit {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;
    private String country;
    private String city;

    @Enumerated(EnumType.STRING)
    private CircuitType type;

    private int totalLaps;
    private float lengthKm;
    private float lapRecordSec;
    private String lapRecordHolder;
    private int turnCount;

    @JsonIgnore
    @OneToMany(mappedBy = "circuit", cascade = CascadeType.ALL)
    @ToString.Exclude @EqualsAndHashCode.Exclude
    private List<Race> races;
}
