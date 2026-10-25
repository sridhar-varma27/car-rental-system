
package com.carrental.controller;

import com.carrental.dto.CarRequest;
import com.carrental.dto.CarResponse;
import com.carrental.service.CarService;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/cars")
public class CarController {

    private final CarService carService;

    public CarController(CarService carService) {
        this.carService = carService;
    }

    // ADMIN: Add a new car
    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<CarResponse> createCar(
            @Valid @RequestBody CarRequest request) {

        CarResponse response = carService.createCar(request);

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(response);
    }

    // USER / ADMIN: Get the entire fleet
    @GetMapping
    public ResponseEntity<List<CarResponse>> getAllCars() {

        return ResponseEntity.ok(
                carService.getAllCars()
        );
    }

    // USER / ADMIN: Get car models with units available
    // for the requested rental period.
    @GetMapping("/available")
    public ResponseEntity<List<CarResponse>> getAvailableCars(
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate startDate,

            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate endDate) {

        // Both dates must be supplied together, or omitted together.
        if ((startDate == null) != (endDate == null)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Pickup and return dates must be provided together"
            );
        }

        // Default search: today through tomorrow.
        LocalDate pickupDate = startDate != null
                ? startDate
                : LocalDate.now();

        LocalDate returnDate = endDate != null
                ? endDate
                : pickupDate.plusDays(1);

        return ResponseEntity.ok(
                carService.getAvailableCars(
                        pickupDate,
                        returnDate
                )
        );
    }

    // USER / ADMIN: Get car by ID
    @GetMapping("/{id}")
    public ResponseEntity<CarResponse> getCarById(
            @PathVariable Long id) {

        return ResponseEntity.ok(
                carService.getCarById(id)
        );
    }

    // ADMIN: Update car
    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<CarResponse> updateCar(
            @PathVariable Long id,
            @Valid @RequestBody CarRequest request) {

        return ResponseEntity.ok(
                carService.updateCar(id, request)
        );
    }

    // ADMIN: Delete car
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> deleteCar(
            @PathVariable Long id) {

        carService.deleteCar(id);

        return ResponseEntity.noContent().build();
    }

    // ADMIN: Enable or disable a car model
    @PatchMapping("/{id}/availability")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<CarResponse> updateAvailability(
            @PathVariable Long id,
            @RequestParam Boolean available) {

        return ResponseEntity.ok(
                carService.updateAvailability(id, available)
        );
    }
}
