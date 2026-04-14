package backend.model;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import backend.model.enums.WeatherType;
import jakarta.persistence.*;
import lombok.*;

@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
@Data @Entity @Builder
@NoArgsConstructor @AllArgsConstructor
@Table(name = "weather_conditions")
public class WeatherCondition {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private float airTempC;
    private float trackTempC;
    private float humidityPct;
    private float windSpeedKmh;

    @Enumerated(EnumType.STRING)
    private WeatherType condition;

    private String session;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "race_id")
    @ToString.Exclude @EqualsAndHashCode.Exclude
    private Race race;
}
