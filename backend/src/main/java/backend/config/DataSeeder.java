package backend.config;

import backend.model.Driver;
import backend.repository.DriverRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class DataSeeder implements CommandLineRunner {

    @Autowired
    private DriverRepository driverRepository;

    @Override
    public void run(String... args) throws Exception {

        if (driverRepository.count() == 0) {

            Driver driver1 = new Driver();
            driver1.setName("Max Verstappen");
            driver1.setTeam("Red Bull Racing");
            driver1.setCarNumber(33);

            Driver driver2 = new Driver();
            driver2.setName("Lewis Hamilton");
            driver2.setTeam("Ferrari");
            driver2.setCarNumber(44);

            Driver driver3 = new Driver();
            driver3.setName("Charles Leclerc");
            driver3.setTeam("Ferrari");
            driver3.setCarNumber(16);


            driverRepository.saveAll(List.of(driver1, driver2, driver3));

            System.out.println("✅ Insert driver data successfully!");
        }
    }
}