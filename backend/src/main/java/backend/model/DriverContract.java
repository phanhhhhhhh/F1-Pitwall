package backend.model;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import backend.model.enums.ContractStatus;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;

@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
@Data @Entity @Builder
@NoArgsConstructor @AllArgsConstructor
@Table(name = "driver_contracts")
public class DriverContract {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private float annualSalaryM;
    private LocalDate startDate;
    private LocalDate endDate;
    private boolean hasOptionYear;

    @Enumerated(EnumType.STRING)
    private ContractStatus status;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "driver_id")
    @ToString.Exclude @EqualsAndHashCode.Exclude
    private Driver driver;
}
