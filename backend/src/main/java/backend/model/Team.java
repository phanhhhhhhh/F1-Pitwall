package backend.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import lombok.*;

import java.util.List;

@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
@Data @Entity @Builder
@NoArgsConstructor @AllArgsConstructor
@Table(name = "teams")
public class Team {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank
    @Column(unique = true, nullable = false)
    private String name;

    private String country;
    private String colorHex;

    /** Secondary livery colour, used for accents on the 3D car and team badges. */
    private String accentHex;

    /** Power unit manufacturer — not always the same as the team. */
    private String engineSupplier;

    /** Chassis designation for the current season, e.g. {@code SF-26}. */
    private String carName;

    private String teamPrincipal;

    private int championships;
    private float annualBudgetM;
    private String base;
    private int foundedYear;

    @JsonIgnore
    @OneToMany(mappedBy = "team", cascade = CascadeType.ALL)
    @ToString.Exclude @EqualsAndHashCode.Exclude
    private List<Driver> drivers;
}
