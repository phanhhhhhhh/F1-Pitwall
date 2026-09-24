package backend.dto;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * Partial profile update: a null field is left untouched, an empty string clears it.
 * Limits mirror the column sizes so an oversize value is a 400, not a database error.
 */
@Data
public class UpdateProfileRequest {
    @Size(max = 100)
    private String displayName;

    @Size(max = 255)
    private String email;

    /** https only — the value is rendered as an image source. */
    @Size(max = 500)
    @Pattern(regexp = "^(https://\\S+)?$", message = "avatarUrl must be an https URL")
    private String avatarUrl;

    @Size(max = 20)
    private String phone;

    @Size(max = 300)
    private String bio;

    @Size(max = 100)
    private String location;

    @Size(max = 10)
    private String dateOfBirth;
}
