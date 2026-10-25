
package com.carrental.service;

import com.carrental.dto.CarRequest;
import com.carrental.dto.CarResponse;
import com.carrental.entity.Booking;
import com.carrental.entity.BookingStatus;
import com.carrental.entity.Car;
import com.carrental.repository.BookingRepository;
import com.carrental.repository.CarRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

@Service
public class CarService {

    private static final List<BookingStatus> ACTIVE_STATUSES =
            List.of(
                    BookingStatus.PENDING,
                    BookingStatus.CONFIRMED
            );

    private final CarRepository carRepository;
    private final BookingRepository bookingRepository;

    public CarService(
            CarRepository carRepository,
            BookingRepository bookingRepository) {

        this.carRepository = carRepository;
        this.bookingRepository = bookingRepository;
    }

    @Transactional
    public CarResponse createCar(CarRequest request) {

        validateQuantity(request.getQuantity());

        Car car = new Car();

        car.setBrand(request.getBrand());
        car.setModel(request.getModel());
        car.setCategory(request.getCategory());
        car.setPricePerDay(request.getPricePerDay());
        car.setFuelType(request.getFuelType());
        car.setTransmission(request.getTransmission());
        car.setSeatingCapacity(request.getSeatingCapacity());
        car.setImageUrl(request.getImageUrl());
        car.setAvailable(true);
        car.setQuantity(request.getQuantity());

        return convertToResponse(carRepository.save(car));
    }

    @Transactional(readOnly = true)
    public List<CarResponse> getAllCars() {

        return carRepository.findAll()
                .stream()
                .map(this::convertToResponse)
                .toList();
    }

    /*
     * Returns enabled car models with at least one unit available
     * during the requested rental interval.
     *
     * Rental periods are start-inclusive and end-exclusive.
     */
    @Transactional(readOnly = true)
    public List<CarResponse> getAvailableCars(
            LocalDate startDate,
            LocalDate endDate) {

        validateRentalDates(startDate, endDate);

        return carRepository.findByAvailableTrue()
                .stream()
                .map(car -> {
                    Integer quantity = car.getQuantity();

                    if (quantity == null || quantity <= 0) {
                        return null;
                    }

                    List<Booking> overlappingBookings =
                            bookingRepository.findOverlappingBookings(
                                    car.getId(),
                                    startDate,
                                    endDate,
                                    ACTIVE_STATUSES
                            );

                    int maximumConcurrentBookings =
                            getMaximumConcurrentBookings(
                                    overlappingBookings,
                                    startDate,
                                    endDate
                            );

                    int availableQuantity =
                            quantity - maximumConcurrentBookings;

                    if (availableQuantity <= 0) {
                        return null;
                    }

                    return convertToResponse(
                            car,
                            availableQuantity
                    );
                })
                .filter(response -> response != null)
                .toList();
    }

    @Transactional(readOnly = true)
    public CarResponse getCarById(Long id) {

        Car car = carRepository.findById(id)
                .orElseThrow(() ->
                        new RuntimeException(
                                "Car not found with id: " + id
                        )
                );

        return convertToResponse(car);
    }

    @Transactional
    public CarResponse updateCar(Long id, CarRequest request) {

        validateQuantity(request.getQuantity());

        Car car = carRepository.findById(id)
                .orElseThrow(() ->
                        new RuntimeException(
                                "Car not found with id: " + id
                        )
                );

        car.setBrand(request.getBrand());
        car.setModel(request.getModel());
        car.setCategory(request.getCategory());
        car.setPricePerDay(request.getPricePerDay());
        car.setFuelType(request.getFuelType());
        car.setTransmission(request.getTransmission());
        car.setSeatingCapacity(request.getSeatingCapacity());
        car.setImageUrl(request.getImageUrl());
        car.setQuantity(request.getQuantity());

        return convertToResponse(carRepository.save(car));
    }

    @Transactional
    public void deleteCar(Long id) {

        if (!carRepository.existsById(id)) {
            throw new RuntimeException(
                    "Car not found with id: " + id
            );
        }

        carRepository.deleteById(id);
    }

    @Transactional
    public CarResponse updateAvailability(
            Long id,
            Boolean available) {

        if (available == null) {
            throw new RuntimeException(
                    "Availability value is required"
            );
        }

        Car car = carRepository.findById(id)
                .orElseThrow(() ->
                        new RuntimeException(
                                "Car not found with id: " + id
                        )
                );

        car.setAvailable(available);

        return convertToResponse(carRepository.save(car));
    }

    private int getMaximumConcurrentBookings(
            List<Booking> bookings,
            LocalDate requestedStart,
            LocalDate requestedEnd) {

        Map<LocalDate, Integer> dateChanges = new TreeMap<>();

        for (Booking booking : bookings) {

            LocalDate effectiveStart =
                    booking.getStartDate().isAfter(requestedStart)
                            ? booking.getStartDate()
                            : requestedStart;

            LocalDate effectiveEnd =
                    booking.getEndDate().isBefore(requestedEnd)
                            ? booking.getEndDate()
                            : requestedEnd;

            if (!effectiveEnd.isAfter(effectiveStart)) {
                continue;
            }

            dateChanges.merge(
                    effectiveStart,
                    1,
                    Integer::sum
            );

            dateChanges.merge(
                    effectiveEnd,
                    -1,
                    Integer::sum
            );
        }

        int concurrentBookings = 0;
        int maximumConcurrentBookings = 0;

        for (Integer change : dateChanges.values()) {
            concurrentBookings += change;

            maximumConcurrentBookings = Math.max(
                    maximumConcurrentBookings,
                    concurrentBookings
            );
        }

        return maximumConcurrentBookings;
    }

    private void validateRentalDates(
            LocalDate startDate,
            LocalDate endDate) {

        if (startDate == null || endDate == null) {
            throw new RuntimeException(
                    "Pickup and return dates are required"
            );
        }

        if (startDate.isBefore(LocalDate.now())) {
            throw new RuntimeException(
                    "Pickup date cannot be in the past"
            );
        }

        if (!endDate.isAfter(startDate)) {
            throw new RuntimeException(
                    "Return date must be after pickup date"
            );
        }
    }

    private void validateQuantity(Integer quantity) {

        if (quantity == null || quantity < 1) {
            throw new RuntimeException(
                    "Car quantity must be at least 1"
            );
        }
    }

    private CarResponse convertToResponse(Car car) {

        return convertToResponse(
                car,
                car.getQuantity() == null ? 0 : car.getQuantity()
        );
    }

    private CarResponse convertToResponse(
            Car car,
            Integer availableQuantity) {

        return new CarResponse(
                car.getId(),
                car.getBrand(),
                car.getModel(),
                car.getCategory(),
                car.getPricePerDay(),
                car.getFuelType(),
                car.getTransmission(),
                car.getSeatingCapacity(),
                car.getImageUrl(),
                car.getAvailable(),
                car.getQuantity(),
                availableQuantity,
                car.getCreatedAt()
        );
    }
}
