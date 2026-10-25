
package com.carrental.service;

import com.carrental.dto.BookingConfirmationResponse;
import com.carrental.entity.Booking;
import com.carrental.entity.Payment;
import com.carrental.repository.BookingRepository;
import com.carrental.repository.PaymentRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class BookingConfirmationService {

    private final BookingRepository bookingRepository;
    private final PaymentRepository paymentRepository;

    public BookingConfirmationService(
            BookingRepository bookingRepository,
            PaymentRepository paymentRepository) {

        this.bookingRepository = bookingRepository;
        this.paymentRepository = paymentRepository;
    }

    @Transactional(readOnly = true)
    public BookingConfirmationResponse getConfirmation(
            Long bookingId,
            String email) {

        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() ->
                        new RuntimeException("Booking not found")
                );

        // Only the booking owner can view the confirmation.
        if (!booking.getUser().getEmail().equals(email)) {
            throw new RuntimeException(
                    "You are not allowed to view this confirmation"
            );
        }

        // Retrieve the stored payment regardless of booking status.
        Payment payment = paymentRepository
                .findByBookingId(bookingId)
                .orElseThrow(() ->
                        new RuntimeException(
                                "Payment not found for this booking"
                        )
                );

        return new BookingConfirmationResponse(
                booking.getId(),
                booking.getUser().getName(),
                booking.getUser().getEmail(),
                booking.getCar().getBrand()
                        + " "
                        + booking.getCar().getModel(),
                booking.getStartDate(),
                booking.getEndDate(),
                booking.getNumberOfDays(),
                booking.getPricePerDay(),
                booking.getTotalPrice(),
                booking.getStatus(),
                payment.getStatus().name(),
                payment.getTransactionId()
        );
    }
}
