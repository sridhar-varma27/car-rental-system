
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
import com.razorpay.Refund;
import com.razorpay.Utils;

import org.json.JSONObject;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Service
public class PaymentService {

    private static final Logger log = LoggerFactory.getLogger(PaymentService.class);

    private final PaymentRepository paymentRepository;
    private final BookingRepository bookingRepository;
    private final TransactionTemplate transactionTemplate;

    private final EmailService emailService;
    private final EmailTemplateService emailTemplateService;

    @Value("${razorpay.key-id}")
    private String razorpayKeyId;

    @Value("${razorpay.key-secret}")
    private String razorpayKeySecret;

    public PaymentService(
            PaymentRepository paymentRepository,
            BookingRepository bookingRepository,
            PlatformTransactionManager transactionManager,
            EmailService emailService,
            EmailTemplateService emailTemplateService) {

        this.paymentRepository = paymentRepository;
        this.bookingRepository = bookingRepository;
        this.emailService = emailService;
        this.emailTemplateService = emailTemplateService;

        this.transactionTemplate =
                new TransactionTemplate(transactionManager);

        // Refund-state updates must commit independently.
        this.transactionTemplate.setPropagationBehavior(
                TransactionDefinition.PROPAGATION_REQUIRES_NEW
        );
    }

    @Transactional
    public RazorpayOrderResponse createOrder(
            PaymentRequest request,
            String email) {

        Booking booking = bookingRepository
                .findByIdForUpdate(request.getBookingId())
                .orElseThrow(() ->
                        new ResourceNotFoundException("Booking not found"));

        validateBookingOwner(booking, email);
        validateBookingCanBePaid(booking);

        Payment payment = paymentRepository
                .findByBookingIdForUpdate(booking.getId())
                .orElse(null);

        if (payment != null &&
                (payment.getStatus() == PaymentStatus.SUCCESS ||
                 payment.getStatus() == PaymentStatus.REFUND_PENDING ||
                 payment.getStatus() == PaymentStatus.REFUNDED ||
                 payment.getStatus() == PaymentStatus.REFUND_FAILED)) {

            throw new IllegalStateException(
                    "This booking already has a payment that cannot be reused");
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
            payment.setRazorpayRefundId(null);
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

        Booking booking = bookingRepository
                .findByIdForUpdate(request.getBookingId())
                .orElseThrow(() ->
                        new ResourceNotFoundException("Booking not found"));

        validateBookingOwner(booking, email);

        Payment payment = paymentRepository
                .findByBookingIdForUpdate(booking.getId())
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

        if (payment.getStatus() == PaymentStatus.REFUND_PENDING ||
                payment.getStatus() == PaymentStatus.REFUNDED ||
                payment.getStatus() == PaymentStatus.REFUND_FAILED) {

            throw new IllegalStateException(
                    "This payment is already in a refund state");
        }

        if (payment.getRazorpayOrderId() == null ||
                !payment.getRazorpayOrderId()
                        .equals(request.getRazorpayOrderId())) {

            throw new IllegalArgumentException(
                    "Razorpay order does not match this booking");
        }

        validateBookingCanBePaid(booking);

        Payment duplicatePayment = paymentRepository
                .findByRazorpayPaymentId(request.getRazorpayPaymentId())
                .orElse(null);

        if (duplicatePayment != null &&
                !duplicatePayment.getId().equals(payment.getId())) {

            throw new IllegalArgumentException(
                    "This Razorpay payment has already been used");
        }

        try {
            JSONObject attributes = new JSONObject();
            attributes.put("razorpay_order_id", payment.getRazorpayOrderId());
            attributes.put("razorpay_payment_id", request.getRazorpayPaymentId());
            attributes.put("razorpay_signature", request.getRazorpaySignature());

            boolean signatureValid =
                    Utils.verifyPaymentSignature(
                            attributes,
                            razorpayKeySecret);

            if (!signatureValid) {
                throw new IllegalArgumentException(
                        "Razorpay payment signature is invalid");
            }

            payment.setRazorpayPaymentId(request.getRazorpayPaymentId());
            payment.setTransactionId(request.getRazorpayPaymentId());
            payment.setStatus(PaymentStatus.SUCCESS);
            payment.setPaymentDate(LocalDateTime.now());

            booking.setStatus(BookingStatus.CONFIRMED);

            paymentRepository.save(payment);
            bookingRepository.save(booking);

            // Capture email details before the transaction closes.
            String customerEmail = booking.getUser().getEmail();
            String customerName = booking.getUser().getName();

            String bookingId = booking.getId().toString();

            String pickupDate = booking.getStartDate().format(
                    DateTimeFormatter.ofPattern("dd MMM yyyy"));

            String returnDate = booking.getEndDate().format(
                    DateTimeFormatter.ofPattern("dd MMM yyyy"));

            String totalAmount = "INR "
                    + booking.getTotalPrice().toPlainString();

            String carName = booking.getCar().getBrand() + " "
                    + booking.getCar().getModel();

            // Send booking confirmation only after database commit.
            if (TransactionSynchronizationManager.isSynchronizationActive()) {

                TransactionSynchronizationManager.registerSynchronization(
                        new TransactionSynchronization() {

                            @Override
                            public void afterCommit() {

                                try {
                                    String html =
                                            emailTemplateService
                                                    .bookingConfirmationEmail(
                                                            customerName,
                                                            bookingId,
                                                            carName,
                                                            pickupDate,
                                                            returnDate,
                                                            totalAmount
                                                    );

                                    emailService.sendHtmlEmail(
                                            customerEmail,
                                            "Booking Confirmed - Car Rental System",
                                            html
                                    );

                                } catch (Exception exception) {
                                    log.error(
                                            "Failed to generate or send booking confirmation email for booking {}",
                                            bookingId,
                                            exception
                                    );
                                }
                            }
                        }
                );

            } else {
                log.warn(
                        "Transaction synchronization inactive. "
                                + "Booking confirmation email was not scheduled for booking {}",
                        bookingId
                );
            }
            return convertToResponse(payment);

        } catch (RazorpayException exception) {
            throw new IllegalArgumentException(
                    "Unable to verify Razorpay payment",
                    exception);
        }
    }

    /*
     * Refund processing:
     * 1. Lock booking and payment in a new transaction.
     * 2. Mark REFUND_PENDING and commit.
     * 3. Call Razorpay outside the database transaction.
     * 4. Save the Razorpay refund ID in another new transaction.
     * 5. Wait for webhook confirmation when necessary.
     */
    public void refundForCancellation(
            Long bookingId,
            String email) {

        RefundRequestData refundData = transactionTemplate.execute(status -> {

            Booking booking = bookingRepository
                    .findByIdForUpdate(bookingId)
                    .orElseThrow(() ->
                            new ResourceNotFoundException("Booking not found"));

            validateBookingOwner(booking, email);

            if (booking.getStatus() != BookingStatus.CANCELLED) {
                throw new IllegalStateException(
                        "Booking must be cancelled before refund processing");
            }

            Payment payment = paymentRepository
                    .findByBookingIdForUpdate(bookingId)
                    .orElse(null);

            if (payment == null ||
                    payment.getStatus() == PaymentStatus.PENDING ||
                    payment.getStatus() == PaymentStatus.FAILED) {
                return null;
            }

            if (payment.getStatus() == PaymentStatus.REFUNDED) {
                return null;
            }

            if (payment.getStatus() == PaymentStatus.REFUND_PENDING) {
                throw new IllegalStateException(
                        "A refund is already being processed");
            }

            if (payment.getStatus() == PaymentStatus.REFUND_FAILED) {
                throw new IllegalStateException(
                        "The previous refund requires admin review before retrying");
            }

            if (payment.getStatus() != PaymentStatus.SUCCESS) {
                throw new IllegalStateException(
                        "This payment cannot be refunded in its current state");
            }

            if (payment.getRazorpayPaymentId() == null ||
                    payment.getRazorpayPaymentId().isBlank()) {

                throw new IllegalStateException(
                        "Razorpay payment ID is missing");
            }

            if (payment.getRazorpayRefundId() != null &&
                    !payment.getRazorpayRefundId().isBlank()) {

                throw new IllegalStateException(
                        "A Razorpay refund ID already exists. Reconciliation is required");
            }

            long refundAmount = payment.getAmount()
                    .movePointRight(2)
                    .longValueExact();

            if (refundAmount <= 0) {
                throw new IllegalStateException(
                        "Refund amount must be greater than zero");
            }

            payment.setStatus(PaymentStatus.REFUND_PENDING);
            paymentRepository.saveAndFlush(payment);

            return new RefundRequestData(
                    payment.getRazorpayPaymentId(),
                    refundAmount,
                    bookingId
            );
        });

        if (refundData == null) {
            return;
        }

        try {
            RazorpayClient client =
                    new RazorpayClient(razorpayKeyId, razorpayKeySecret);

            JSONObject refundRequest = new JSONObject();
            refundRequest.put("amount", refundData.amount());
            refundRequest.put("speed", "normal");

            JSONObject notes = new JSONObject();
            notes.put("bookingId", refundData.bookingId().toString());
            notes.put("reason", "Booking cancellation");
            refundRequest.put("notes", notes);

            Refund refund = client.payments.refund(
                    refundData.paymentId(),
                    refundRequest
            );

            String refundId = refund.get("id");
            // String refundStatus = refund.get("status");

            if (refundId == null || refundId.isBlank()) {
                throw new IllegalStateException(
                        "Razorpay did not return a refund ID. Reconciliation is required");
            }

            transactionTemplate.executeWithoutResult(status -> {

                Payment payment = paymentRepository
                        .findByBookingIdForUpdate(refundData.bookingId())
                        .orElseThrow(() ->
                                new ResourceNotFoundException("Payment not found"));

                if (payment.getRazorpayRefundId() != null &&
                        !payment.getRazorpayRefundId().equals(refundId)) {

                    throw new IllegalStateException(
                            "A different refund ID is already recorded");
                }

                payment.setRazorpayRefundId(refundId);

                // Keep the refund pending until the webhook confirms its final status.
                // The webhook is responsible for updating the status and sending the email.
                if (payment.getStatus() != PaymentStatus.REFUNDED && payment.getStatus() != PaymentStatus.REFUND_FAILED) {
                        payment.setStatus(PaymentStatus.REFUND_PENDING);
                }

                paymentRepository.save(payment);
            });

        } catch (RazorpayException exception) {

            // The request outcome may be ambiguous.
            // Keep REFUND_PENDING until reconciliation confirms the result.
            throw new IllegalStateException(
                    "Unable to confirm the Razorpay refund request. " +
                    "The refund remains pending and must be reconciled before retrying.",
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

        if (booking.getUser() == null ||
                booking.getUser().getEmail() == null ||
                !booking.getUser().getEmail().equalsIgnoreCase(email)) {

            throw new IllegalArgumentException(
                    "You are not allowed to access this booking");
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

    private record RefundRequestData(
            String paymentId,
            long amount,
            Long bookingId) {
    }
}
