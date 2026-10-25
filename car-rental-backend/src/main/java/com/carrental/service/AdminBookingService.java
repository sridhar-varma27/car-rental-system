package com.carrental.service;

import com.carrental.dto.BookingResponse;
import com.carrental.entity.Booking;
import com.carrental.entity.BookingStatus;
import com.carrental.repository.BookingRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class AdminBookingService {

    private final BookingRepository bookingRepository;

    public AdminBookingService(BookingRepository bookingRepository) {
        this.bookingRepository = bookingRepository;
    }

    public List<BookingResponse> getAllBookings() {

        return bookingRepository.findAll()
                .stream()
                .map(this::convertToResponse)
                .toList();
    }

    public List<BookingResponse> getBookingsByStatus(
            BookingStatus status) {

        return bookingRepository.findByStatus(status)
                .stream()
                .map(this::convertToResponse)
                .toList();
    }

    public BookingResponse updateBookingStatus(
            Long id,
            BookingStatus status) {

        Booking booking = bookingRepository.findById(id)
                .orElseThrow(() ->
                        new RuntimeException(
                                "Booking not found with id: " + id
                        )
                );

        booking.setStatus(status);

        Booking updatedBooking =
                bookingRepository.save(booking);

        return convertToResponse(updatedBooking);
    }

    private BookingResponse convertToResponse(
            Booking booking) {

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