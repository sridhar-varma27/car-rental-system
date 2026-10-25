
package com.carrental.service;

import com.carrental.dto.BookingRequest;
import com.carrental.dto.BookingResponse;
import com.carrental.entity.Booking;
import com.carrental.entity.BookingStatus;
import com.carrental.entity.Car;
import com.carrental.entity.User;
import com.carrental.repository.BookingRepository;
import com.carrental.repository.CarRepository;
import com.carrental.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

@Service
public class BookingService {

    private static final List<BookingStatus> ACTIVE_STATUSES =
            List.of(BookingStatus.PENDING, BookingStatus.CONFIRMED);

    private final BookingRepository bookingRepository;
    private final CarRepository carRepository;
    private final UserRepository userRepository;

    public BookingService(
            BookingRepository bookingRepository,
            CarRepository carRepository,
            UserRepository userRepository) {

        this.bookingRepository = bookingRepository;
        this.carRepository = carRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public BookingResponse createBooking(
            BookingRequest request,
            String email) {

        if (request.getStartDate() == null ||
                request.getEndDate() == null) {
            throw new RuntimeException(
                    "Pickup and return dates are required"
            );
        }

        LocalDate startDate = request.getStartDate();
        LocalDate endDate = request.getEndDate();

        if (startDate.isBefore(LocalDate.now())) {
            throw new RuntimeException(
                    "Start date cannot be in the past"
            );
        }

        if (!endDate.isAfter(startDate)) {
            throw new RuntimeException(
                    "End date must be after start date"
            );
        }

        User user = userRepository.findByEmail(email)
                .orElseThrow(() ->
                        new RuntimeException("User not found")
                );

        /*
         * Lock this car record so two booking requests for this
         * inventory group cannot simultaneously reserve its last unit.
         */
        Car car = carRepository
                .findByIdForUpdate(request.getCarId())
                .orElseThrow(() ->
                        new RuntimeException("Car not found")
                );

        if (!Boolean.TRUE.equals(car.getAvailable())) {
            throw new RuntimeException(
                    "This car model has been disabled by the administrator"
            );
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

        if (maximumConcurrentBookings >= car.getQuantity()) {
            throw new RuntimeException(
                    "All units of this car are booked for the selected dates"
            );
        }

        int numberOfDays = Math.toIntExact(
                ChronoUnit.DAYS.between(startDate, endDate)
        );

        BigDecimal totalPrice = car.getPricePerDay()
                .multiply(BigDecimal.valueOf(numberOfDays));

        Booking booking = new Booking();
        booking.setUser(user);
        booking.setCar(car);
        booking.setStartDate(startDate);
        booking.setEndDate(endDate);
        booking.setNumberOfDays(numberOfDays);
        booking.setPricePerDay(car.getPricePerDay());
        booking.setTotalPrice(totalPrice);
        booking.setStatus(BookingStatus.PENDING);

        Booking savedBooking = bookingRepository.save(booking);

        return convertToResponse(savedBooking);
    }

    /*
     * Rental intervals are start-inclusive and end-exclusive.
     * For example, a booking ending on 14 October does not occupy
     * a unit on 14 October, so another booking can start that day.
     */
    private int getMaximumConcurrentBookings(
            List<Booking> bookings,
            LocalDate requestedStart,
            LocalDate requestedEnd) {

        Map<LocalDate, Integer> dateChanges = new TreeMap<>();

        for (Booking booking : bookings) {
            LocalDate effectiveStart = booking.getStartDate()
                    .isAfter(requestedStart)
                    ? booking.getStartDate()
                    : requestedStart;

            LocalDate effectiveEnd = booking.getEndDate()
                    .isBefore(requestedEnd)
                    ? booking.getEndDate()
                    : requestedEnd;

            if (!effectiveEnd.isAfter(effectiveStart)) {
                continue;
            }

            dateChanges.merge(effectiveStart, 1, Integer::sum);
            dateChanges.merge(effectiveEnd, -1, Integer::sum);
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

    @Transactional(readOnly = true)
    public List<BookingResponse> getUserBookings(String email) {

        User user = userRepository.findByEmail(email)
                .orElseThrow(() ->
                        new RuntimeException("User not found")
                );

        return bookingRepository.findByUserId(user.getId())
                .stream()
                .map(this::convertToResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public BookingResponse getBookingById(
            Long id,
            String email) {

        Booking booking = bookingRepository.findById(id)
                .orElseThrow(() ->
                        new RuntimeException("Booking not found")
                );

        if (!booking.getUser().getEmail().equalsIgnoreCase(email)) {
            throw new RuntimeException(
                    "You are not allowed to view this booking"
            );
        }

        return convertToResponse(booking);
    }

    @Transactional
    public BookingResponse cancelBooking(
            Long id,
            String email) {

        Booking booking = bookingRepository.findById(id)
                .orElseThrow(() ->
                        new RuntimeException("Booking not found")
                );

        if (!booking.getUser().getEmail().equalsIgnoreCase(email)) {
            throw new RuntimeException(
                    "You are not allowed to cancel this booking"
            );
        }

        if (booking.getStatus() == BookingStatus.CANCELLED) {
            throw new RuntimeException(
                    "Booking is already cancelled"
            );
        }

        if (booking.getStatus() == BookingStatus.COMPLETED) {
            throw new RuntimeException(
                    "Completed booking cannot be cancelled"
            );
        }

        booking.setStatus(BookingStatus.CANCELLED);

        return convertToResponse(
                bookingRepository.save(booking)
        );
    }

    private BookingResponse convertToResponse(Booking booking) {

        return new BookingResponse(
                booking.getId(),
                booking.getUser().getId(),
                booking.getCar().getId(),
                booking.getCar().getBrand(),
                booking.getCar().getModel(),
                booking.getStartDate(),
                booking.getEndDate(),
                booking.getNumberOfDays(),
                booking.getPricePerDay(),
                booking.getTotalPrice(),
                booking.getStatus(),
                booking.getCreatedAt()
        );
    }
}
