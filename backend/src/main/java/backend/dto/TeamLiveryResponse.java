package backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * A team's identity as the 3D car inspector needs it: both livery colours, the car it is racing,
 * and the drivers whose numbers go on it.
 */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class TeamLiveryResponse {
    private Long id;
    private String name;
    private String country;
    private String colorHex;
    private String accentHex;
    private String engineSupplier;
    private String carName;
    private String teamPrincipal;
    private String base;
    private int championships;
    private int foundedYear;
    private float annualBudgetM;
    private List<LiveryDriver> drivers;

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class LiveryDriver {
        private Long id;
        private String name;
        private int carNumber;
        private String nationality;
    }
}
