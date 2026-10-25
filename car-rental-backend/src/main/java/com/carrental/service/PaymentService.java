
package com.carrental.service;

import com.carrental.dto.PaymentRequest;
import com.carrental.dto.PaymentResponse;
import com.carrental.dto.RazorpayOrderResponse;
import com.carrental.dto.RazorpayVerificationRequest;
import com.carrental.entity.Booking;
import com.carrental.entity.BookingStatus;
import com.carrental.entity.Payment;
import com.carrental.entity.PaymentStatus;
import com.carrental.exception.ResourceNotFoundException;
import com.carrental.repository.BookingRepository;
import com.carrental.repository.PaymentRepository;
import com.razorpay.Order;
import com.razorpay.RazorpayClient;
import com.razorpay.RazorpayException;
import com.razorpay.Utils;
import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;


import java.time.LocalDateTime;

@Service
public class PaymentService {

    private final PaymentRepository paymentRepository;
    private final BookingRepository bookingRepository;

    @Value("${razorpay.key-id}")
    private String razorpayKeyId;

    @Value("${razorpay.key-secret}")
    private String razorpayKeySecret;

    public PaymentService(
            PaymentRepository paymentRepository,
            BookingRepository bookingRepository) {
        this.paymentRepository = paymentRepository;
        this.bookingRepository = bookingRepository;
    }

    @Transactional
    public RazorpayOrderResponse createOrder(
            PaymentRequest request,
            String email) {

        Booking booking = bookingRepository.findById(request.getBookingId())
                .orElseThrow(() ->
                        new ResourceNotFoundException("Booking not found"));

        validateBookingOwner(booking, email);
        validateBookingCanBePaid(booking);

        Payment payment = paymentRepository
                .findByBookingId(booking.getId())
                .orElse(null);

        if (payment != null
                && payment.getStatus() == PaymentStatus.SUCCESS) {
            throw new IllegalStateException(
                    "This booking has already been paid for");
        }

        if (payment != null
                && payment.getStatus() == PaymentStatus.REFUNDED) {
            throw new IllegalStateException(
                    "A refunded payment cannot be reused");
        }

        try {
            long amountInPaise = booking.getTotalPrice()
                    .movePointRight(2)
                    .longValueExact();

            if (amountInPaise <= 0) {
                throw new IllegalStateException(
                        "Payment amount must be greater than zero");
            }

            RazorpayClient client =
                    new RazorpayClient(razorpayKeyId, razorpayKeySecret);

            JSONObject orderRequest = new JSONObject();
            orderRequest.put("amount", amountInPaise);
            orderRequest.put("currency", "INR");
            orderRequest.put("receipt", "booking_" + booking.getId());

            JSONObject notes = new JSONObject();
            notes.put("bookingId", booking.getId().toString());
            notes.put("customerEmail", email);
            orderRequest.put("notes", notes);

            Order order = client.orders.create(orderRequest);
            String orderId = order.get("id");

            if (payment == null) {
                payment = new Payment();
                payment.setBooking(booking);
            }

            payment.setAmount(booking.getTotalPrice());
            payment.setPaymentMethod(request.getPaymentMethod());
            payment.setStatus(PaymentStatus.PENDING);
            payment.setPaymentDate(LocalDateTime.now());
            payment.setTransactionId(null);
            payment.setRazorpayPaymentId(null);
            payment.setRazorpayOrderId(orderId);

            paymentRepository.save(payment);

            return new RazorpayOrderResponse(
                    booking.getId(),
                    razorpayKeyId,
                    orderId,
                    amountInPaise,
                    "INR"
            );

        } catch (RazorpayException exception) {
            throw new IllegalStateException(
                    "Unable to create Razorpay order. Please try again.",
                    exception);
        }
    }

    @Transactional
    public PaymentResponse verifyPayment(
            RazorpayVerificationRequest request,
            String email) {

        Booking booking = bookingRepository.findById(request.getBookingId())
                .orElseThrow(() ->
                        new ResourceNotFoundException("Booking not found"));

        validateBookingOwner(booking, email);

        Payment payment = paymentRepository
                .findByBookingId(booking.getId())
                .orElseThrow(() ->
                        new IllegalStateException(
                                "Payment order was not found for this booking"));

        if (payment.getStatus() == PaymentStatus.SUCCESS) {
            if (request.getRazorpayPaymentId()
                    .equals(payment.getRazorpayPaymentId())) {
                return convertToResponse(payment);
            }

            throw new IllegalStateException(
                    "This booking already has a successful payment");
        }

        if (payment.getRazorpayOrderId() == null
                || !payment.getRazorpayOrderId()
                        .equals(request.getRazorpayOrderId())) {
            throw new IllegalArgumentException(
                    "Razorpay order does not match this booking");
        }

        validateBookingCanBePaid(booking);

        Payment duplicatePayment = paymentRepository
                .findByRazorpayPaymentId(request.getRazorpayPaymentId())
                .orElse(null);

        if (duplicatePayment != null
                && !duplicatePayment.getId().equals(payment.getId())) {
            throw new IllegalArgumentException(
                    "This Razorpay payment has already been used");
        }

        try {
            JSONObject attributes = new JSONObject();
            attributes.put(
                    "razorpay_order_id",
                    payment.getRazorpayOrderId());
            attributes.put(
                    "razorpay_payment_id",
                    request.getRazorpayPaymentId());
            attributes.put(
                    "razorpay_signature",
                    request.getRazorpaySignature());

            boolean signatureValid =
                    Utils.verifyPaymentSignature(
                            attributes,
                            razorpayKeySecret);

            if (!signatureValid) {
                throw new IllegalArgumentException(
                        "Razorpay payment signature is invalid");
            }

            payment.setRazorpayPaymentId(
                    request.getRazorpayPaymentId());
            payment.setTransactionId(
                    request.getRazorpayPaymentId());
            payment.setStatus(PaymentStatus.SUCCESS);
            payment.setPaymentDate(LocalDateTime.now());

            booking.setStatus(BookingStatus.CONFIRMED);

            paymentRepository.save(payment);
            bookingRepository.save(booking);

            return convertToResponse(payment);

        } catch (RazorpayException exception) {
            throw new IllegalArgumentException(
                    "Unable to verify Razorpay payment",
                    exception);
        }
    }

    @Transactional(readOnly = true)
    public PaymentResponse getPayment(Long bookingId, String email) {

        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() ->
                        new ResourceNotFoundException("Booking not found"));

        validateBookingOwner(booking, email);

        Payment payment = paymentRepository.findByBookingId(bookingId)
                .orElseThrow(() ->
                        new ResourceNotFoundException(
                                "Payment not found for this booking"));

        return convertToResponse(payment);
    }

    private void validateBookingOwner(Booking booking, String email) {
        if (booking.getUser() == null
                || booking.getUser().getEmail() == null
                || !booking.getUser().getEmail()
                        .equalsIgnoreCase(email)) {
            throw new IllegalArgumentException(
                    "You are not allowed to pay for this booking");
        }
    }

    private void validateBookingCanBePaid(Booking booking) {
        if (booking.getStatus() == BookingStatus.CANCELLED) {
            throw new IllegalStateException(
                    "A cancelled booking cannot be paid for");
        }

        if (booking.getStatus() == BookingStatus.COMPLETED) {
            throw new IllegalStateException(
                    "A completed booking cannot be paid for");
        }

        if (booking.getStatus() == BookingStatus.CONFIRMED) {
            throw new IllegalStateException(
                    "This booking is already confirmed");
        }
    }

    private PaymentResponse convertToResponse(Payment payment) {
        return new PaymentResponse(
                payment.getId(),
                payment.getBooking().getId(),
                payment.getAmount(),
                payment.getPaymentMethod(),
                payment.getStatus(),
                payment.getPaymentDate(),
                payment.getTransactionId()
        );
    }
}
