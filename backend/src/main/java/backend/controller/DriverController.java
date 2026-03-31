package backend.controller;

import backend.model.Driver;
import backend.repository.DriverRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/drivers") 
public class DriverController {

    @Autowired
    private DriverRepository driverRepository;

    
    @GetMapping
    public List<Driver> getAllDrivers() {
        return driverRepository.findAll();
    }

    
    @PostMapping
    public Driver addDriver(@RequestBody Driver driver) {
        return driverRepository.save(driver);
    }
}