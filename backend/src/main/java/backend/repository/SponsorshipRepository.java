package backend.repository;

import backend.model.Sponsorship;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface SponsorshipRepository extends JpaRepository<Sponsorship, Long> {}
