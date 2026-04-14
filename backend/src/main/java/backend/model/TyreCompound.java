package backend.model;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import backend.model.enums.TyreType;
import jakarta.persistence.*;
import lombok.*;

@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
@Data @Entity @Builder
@NoArgsConstructor @AllArgsConstructor
@Table(name = "tyre_compounds")
public class TyreCompound {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;

    @Enumerated(EnumType.STRING)
    private TyreType type;

    private float optimalTempMin;
    private float optimalTempMax;
    private float degradationRate;
    private int maxLaps;
}
