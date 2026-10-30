
package com.carrental.service;

import com.carrental.dto.BookingResponse;
import com.carrental.entity.Booking;
import com.carrental.entity.BookingStatus;
import com.carrental.repository.BookingRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.List;

@Service
public class AdminBookingService {

    private static final Logger log =
            LoggerFactory.getLogger(AdminBookingService.class);

    private final BookingRepository bookingRepository;
    private final PaymentService paymentService;

    public AdminBookingService(
            BookingRepository bookingRepository,
            PaymentService paymentService) {

        this.bookingRepository = bookingRepository;
        this.paymentService = paymentService;
    }

    @Transactional(readOnly = true)
    public List<BookingResponse> getAllBookings() {

        return bookingRepository.findAll()
                .stream()
                .map(this::convertToResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<BookingResponse> getBookingsByStatus(
            BookingStatus status) {

        return bookingRepository.findByStatus(status)
                .stream()
                .map(this::convertToResponse)
                .toList();
    }

    @Transactional
    public BookingResponse updateBookingStatus(
            Long id,
            BookingStatus status) {

        if (status == null) {
            throw new RuntimeException("Booking status is required");
        }

        Booking booking = bookingRepository.findByIdForUpdate(id)
                .orElseThrow(() ->
                        new RuntimeException(
                                "Booking not found with id: " + id));

        if (booking.getStatus() == BookingStatus.CANCELLED
                && status != BookingStatus.CANCELLED) {
            throw new RuntimeException(
                    "A cancelled booking cannot be reactivated");
        }

        if (booking.getStatus() == BookingStatus.COMPLETED
                && status == BookingStatus.CANCELLED) {
            throw new RuntimeException(
                    "Completed booking cannot be cancelled");
        }

        boolean cancellationRequested =
                status == BookingStatus.CANCELLED
                && booking.getStatus() != BookingStatus.CANCELLED;

        booking.setStatus(status);

        Booking updatedBooking = bookingRepository.save(booking);

        if (cancellationRequested) {
            scheduleRefundAfterCommit(
                    id,
                    booking.getUser().getEmail());
        }

        return convertToResponse(updatedBooking);
    }

    private void scheduleRefundAfterCommit(
            Long bookingId,
            String email) {

        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            throw new IllegalStateException(
                    "Transaction synchronization is not active");
        }

        TransactionSynchronizationManager.registerSynchronization(
                new TransactionSynchronization() {
                    @Override
                    public void afterCommit() {
                        try {
                            paymentService.refundForCancellation(
                                    bookingId, email);

                        } catch (Exception exception) {
                            log.error(
                                    "Admin cancellation refund failed for "
                                            + "booking {}. Reconciliation is required.",
                                    bookingId,
                                    exception);
                        }
                    }
                });
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
