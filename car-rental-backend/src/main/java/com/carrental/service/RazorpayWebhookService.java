
package com.carrental.service;

import com.carrental.entity.Booking;
import com.carrental.entity.BookingStatus;
import com.carrental.entity.Payment;
import com.carrental.entity.PaymentStatus;
import com.carrental.entity.WebhookEvent;
import com.carrental.exception.ResourceNotFoundException;
import com.carrental.repository.BookingRepository;
import com.carrental.repository.PaymentRepository;
import com.carrental.repository.WebhookEventRepository;

import com.razorpay.Utils;

import org.json.JSONObject;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.function.Supplier;

@Service
public class RazorpayWebhookService {

    private static final Logger log =
            LoggerFactory.getLogger(RazorpayWebhookService.class);

    private static final DateTimeFormatter EMAIL_DATE_FORMAT =
            DateTimeFormatter.ofPattern("dd MMM yyyy");

    private final PaymentRepository paymentRepository;
    private final BookingRepository bookingRepository;
    private final WebhookEventRepository webhookEventRepository;

    private final EmailService emailService;
    private final EmailTemplateService emailTemplateService;
    private final PaymentService paymentService;

    @Value("${razorpay.webhook-secret}")
    private String webhookSecret;

    public RazorpayWebhookService(
            PaymentRepository paymentRepository,
            BookingRepository bookingRepository,
            WebhookEventRepository webhookEventRepository,
            EmailService emailService,
            EmailTemplateService emailTemplateService,
            PaymentService paymentService) {

        this.paymentRepository = paymentRepository;
        this.bookingRepository = bookingRepository;
        this.webhookEventRepository = webhookEventRepository;
        this.emailService = emailService;
        this.emailTemplateService = emailTemplateService;
        this.paymentService = paymentService;
    }

    @Transactional
    public void processWebhook(
            String payload,
            String signature,
            String eventId) {

        if (payload == null || payload.isBlank()
                || signature == null || signature.isBlank()
                || eventId == null || eventId.isBlank()) {

            throw new IllegalArgumentException(
                    "Invalid Razorpay webhook request"
            );
        }

        verifySignature(payload, signature);

        JSONObject webhook = new JSONObject(payload);
        String eventType = webhook.optString("event");

        if (eventType.isBlank()) {
            throw new IllegalArgumentException(
                    "Missing Razorpay event type"
            );
        }

        log.info(
                "Received Razorpay webhook. Event ID: {}, Event type: {}",
                eventId,
                eventType
        );

        webhookEventRepository.insertIfAbsent(eventId, eventType);

        WebhookEvent event = webhookEventRepository
                .findByEventIdForUpdate(eventId)
                .orElseThrow(() -> new IllegalStateException(
                        "Unable to retrieve webhook event"
                ));

        if (event.isProcessed()) {
            log.info(
                    "Razorpay webhook event {} was already processed. Skipping.",
                    eventId
            );
            return;
        }

        switch (eventType) {

            case "payment.captured" ->
                    handlePaymentCaptured(webhook);

            case "refund.processed" ->
                    handleRefundProcessed(webhook);

            case "refund.failed" ->
                    handleRefundFailed(webhook);

            default -> log.info(
                    "No handler required for Razorpay event type: {}",
                    eventType
            );
        }

        event.setProcessed(true);
        event.setProcessedAt(LocalDateTime.now());

        webhookEventRepository.save(event);

        log.info(
                "Razorpay webhook event {} ({}) processed successfully",
                eventId,
                eventType
        );
    }

    private void verifySignature(String payload, String signature) {

        try {
            if (!Utils.verifyWebhookSignature(
                    payload, signature, webhookSecret)) {

                throw new IllegalArgumentException(
                        "Invalid Razorpay webhook signature"
                );
            }

        } catch (IllegalArgumentException exception) {
            throw exception;

        } catch (Exception exception) {
            throw new IllegalArgumentException(
                    "Unable to verify Razorpay webhook signature",
                    exception
            );
        }
    }

    private void handlePaymentCaptured(JSONObject webhook) {

        JSONObject paymentEntity = getEntity(webhook, "payment");

        String orderId = paymentEntity.optString("order_id");
        String paymentId = paymentEntity.optString("id");
        long capturedAmount = paymentEntity.optLong("amount", -1);

        if (orderId.isBlank() || paymentId.isBlank()
                || capturedAmount < 0) {

            throw new IllegalArgumentException(
                    "Payment webhook is missing payment details"
            );
        }

        Payment initialPayment = paymentRepository
                .findByRazorpayOrderId(orderId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Payment not found for Razorpay order"
                ));

        Long bookingId = initialPayment.getBooking().getId();

        Booking booking = bookingRepository
                .findByIdForUpdate(bookingId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Booking not found"
                ));

        Payment payment = paymentRepository
                .findByBookingIdForUpdate(bookingId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Payment not found for booking"
                ));

        if (!orderId.equals(payment.getRazorpayOrderId())) {
            throw new IllegalArgumentException(
                    "Payment order does not match booking payment"
            );
        }

        long expectedAmount = payment.getAmount()
                .multiply(BigDecimal.valueOf(100))
                .longValueExact();

        if (capturedAmount != expectedAmount) {
            throw new IllegalArgumentException(
                    "Captured amount does not match booking payment"
            );
        }

        Payment duplicatePayment = paymentRepository
                .findByRazorpayPaymentId(paymentId)
                .orElse(null);

        if (duplicatePayment != null
                && !duplicatePayment.getId().equals(payment.getId())) {

            throw new IllegalArgumentException(
                    "Razorpay payment is already linked to another booking"
            );
        }

        if (payment.getStatus() == PaymentStatus.REFUNDED
                || payment.getStatus() == PaymentStatus.REFUND_PENDING
                || payment.getStatus() == PaymentStatus.REFUND_FAILED) {

            log.info(
                    "Ignoring captured payment {} because its current status is {}",
                    paymentId,
                    payment.getStatus()
            );
            return;
        }

        if (payment.getStatus() == PaymentStatus.SUCCESS) {
            log.info(
                    "Payment {} is already marked as successful",
                    paymentId
            );
            return;
        }

        payment.setRazorpayPaymentId(paymentId);
        payment.setTransactionId(paymentId);
        payment.setStatus(PaymentStatus.SUCCESS);
        payment.setPaymentDate(LocalDateTime.now());

        paymentRepository.save(payment);

        if (booking.getStatus() == BookingStatus.CANCELLED) {

            scheduleRefundForCancelledBooking(booking);

            log.warn(
                    "Payment {} was captured after booking {} was cancelled. "
                            + "Refund has been scheduled.",
                    paymentId,
                    bookingId
            );

            return;
        }

        if (booking.getStatus() == BookingStatus.PENDING) {
            booking.setStatus(BookingStatus.CONFIRMED);
            bookingRepository.save(booking);
        }

        if (booking.getStatus() == BookingStatus.CONFIRMED) {
            sendBookingConfirmationAfterCommit(booking);
        }
    }

    private void scheduleRefundForCancelledBooking(Booking booking) {

        Long bookingId = booking.getId();
        String customerEmail = booking.getUser().getEmail();

        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            log.error(
                    "Cannot schedule refund for cancelled booking {} "
                            + "because transaction synchronization is inactive",
                    bookingId
            );
            return;
        }

        TransactionSynchronizationManager.registerSynchronization(
                new TransactionSynchronization() {

                    @Override
                    public void afterCommit() {

                        try {
                            paymentService.refundForCancellation(
                                    bookingId,
                                    customerEmail
                            );

                            log.info(
                                    "Refund initiation requested for cancelled "
                                            + "booking {} after delayed payment capture",
                                    bookingId
                            );

                        } catch (Exception exception) {

                            log.error(
                                    "Failed to initiate refund for cancelled "
                                            + "booking {} after payment capture. "
                                            + "Manual reconciliation may be required.",
                                    bookingId,
                                    exception
                            );
                        }
                    }
                }
        );
    }

    private void sendBookingConfirmationAfterCommit(Booking booking) {

        String customerEmail = booking.getUser().getEmail();
        String customerName = booking.getUser().getName();

        String bookingId = booking.getId().toString();

        String carName = booking.getCar().getBrand()
                + " " + booking.getCar().getModel();

        String pickupDate = booking.getStartDate()
                .format(EMAIL_DATE_FORMAT);

        String returnDate = booking.getEndDate()
                .format(EMAIL_DATE_FORMAT);

        String totalAmount = "INR "
                + booking.getTotalPrice().toPlainString();

        registerEmailAfterCommit(
                "booking confirmation",
                bookingId,
                () -> {
                    String html = emailTemplateService
                            .bookingConfirmationEmail(
                                    customerName,
                                    bookingId,
                                    carName,
                                    pickupDate,
                                    returnDate,
                                    totalAmount
                            );

                    return emailService.sendHtmlEmail(
                            customerEmail,
                            "Booking Confirmed - Car Rental System",
                            html
                    );
                }
        );
    }

    private void handleRefundProcessed(JSONObject webhook) {

        JSONObject refundEntity = getEntity(webhook, "refund");

        String paymentId = refundEntity.optString("payment_id");
        String refundId = refundEntity.optString("id");
        long refundAmount = refundEntity.optLong("amount", -1);

        if (paymentId.isBlank() || refundId.isBlank()
                || refundAmount < 0) {

            throw new IllegalArgumentException(
                    "Refund webhook is missing refund details"
            );
        }

        log.info(
                "Processing refund.processed event. Payment ID: {}, Refund ID: {}",
                paymentId,
                refundId
        );

        Payment payment = findLockedPaymentByPaymentId(paymentId);

        Long bookingId = payment.getBooking().getId();

        validateFullRefundAmount(payment, refundAmount);
        validateRefundId(payment, refundId);

        if (payment.getStatus() == PaymentStatus.REFUNDED) {

            log.info(
                    "Refund {} for booking {} is already marked as REFUNDED. "
                            + "No duplicate email will be sent.",
                    refundId,
                    bookingId
            );
            return;
        }

        if (payment.getStatus() != PaymentStatus.REFUND_PENDING
                && payment.getStatus() != PaymentStatus.REFUND_FAILED
                && payment.getStatus() != PaymentStatus.SUCCESS) {

            log.warn(
                    "Refund {} for booking {} cannot be processed because "
                            + "payment status is {}. Webhook will be retried.",
                    refundId,
                    bookingId,
                    payment.getStatus()
            );

            throw new IllegalStateException(
                    "Unexpected payment status for processed refund: "
                            + payment.getStatus()
            );
        }

        payment.setRazorpayRefundId(refundId);
        payment.setStatus(PaymentStatus.REFUNDED);

        paymentRepository.save(payment);

        log.info(
                "Refund {} successfully recorded for booking {}. "
                        + "Refund amount: {}",
                refundId,
                bookingId,
                payment.getAmount()
        );

        sendRefundConfirmationAfterCommit(payment, refundId);
    }

    private void handleRefundFailed(JSONObject webhook) {

        JSONObject refundEntity = getEntity(webhook, "refund");

        String paymentId = refundEntity.optString("payment_id");
        String refundId = refundEntity.optString("id");
        long refundAmount = refundEntity.optLong("amount", -1);

        if (paymentId.isBlank() || refundId.isBlank()
                || refundAmount < 0) {

            throw new IllegalArgumentException(
                    "Refund webhook is missing refund details"
            );
        }

        log.info(
                "Processing refund.failed event. Payment ID: {}, Refund ID: {}",
                paymentId,
                refundId
        );

        Payment payment = findLockedPaymentByPaymentId(paymentId);

        Long bookingId = payment.getBooking().getId();

        validateFullRefundAmount(payment, refundAmount);
        validateRefundId(payment, refundId);

        if (payment.getStatus() == PaymentStatus.REFUNDED
                || payment.getStatus() == PaymentStatus.REFUND_FAILED) {

            log.info(
                    "Refund {} for booking {} is already in final status {}",
                    refundId,
                    bookingId,
                    payment.getStatus()
            );
            return;
        }

        if (payment.getStatus() != PaymentStatus.REFUND_PENDING
                && payment.getStatus() != PaymentStatus.SUCCESS) {

            log.warn(
                    "Refund failure {} for booking {} cannot be processed "
                            + "because payment status is {}. Webhook will be retried.",
                    refundId,
                    bookingId,
                    payment.getStatus()
            );

            throw new IllegalStateException(
                    "Unexpected payment status for failed refund: "
                            + payment.getStatus()
            );
        }

        payment.setRazorpayRefundId(refundId);
        payment.setStatus(PaymentStatus.REFUND_FAILED);

        paymentRepository.save(payment);

        log.warn(
                "Refund {} failed for booking {}. Refund amount: {}",
                refundId,
                bookingId,
                payment.getAmount()
        );

        sendRefundFailureAfterCommit(payment, refundId);
    }

    private void validateRefundId(
            Payment payment,
            String refundId) {

        String existingRefundId = payment.getRazorpayRefundId();

        if (existingRefundId != null
                && !existingRefundId.isBlank()
                && !existingRefundId.equals(refundId)) {

            throw new IllegalStateException(
                    "Refund ID does not match the refund already recorded"
            );
        }
    }

    private void sendRefundConfirmationAfterCommit(
            Payment payment,
            String refundId) {

        Booking booking = payment.getBooking();

        String customerEmail = booking.getUser().getEmail();
        String customerName = booking.getUser().getName();
        String bookingId = booking.getId().toString();

        String refundAmount = "INR "
                + payment.getAmount().toPlainString();

        registerEmailAfterCommit(
                "refund confirmation",
                bookingId,
                () -> {
                    log.info(
                            "Preparing refund confirmation email. "
                                    + "Booking ID: {}, Refund ID: {}, Recipient: {}",
                            bookingId,
                            refundId,
                            customerEmail
                    );

                    String html = emailTemplateService
                            .refundConfirmationEmail(
                                    customerName,
                                    bookingId,
                                    refundAmount,
                                    refundId
                            );

                    return emailService.sendHtmlEmail(
                            customerEmail,
                            "Refund Processed - Car Rental System",
                            html
                    );
                }
        );
    }

    private void sendRefundFailureAfterCommit(
            Payment payment,
            String refundId) {

        Booking booking = payment.getBooking();

        String customerEmail = booking.getUser().getEmail();
        String customerName = booking.getUser().getName();
        String bookingId = booking.getId().toString();

        String refundAmount = "INR "
                + payment.getAmount().toPlainString();

        registerEmailAfterCommit(
                "refund failure notification",
                bookingId,
                () -> {
                    log.info(
                            "Preparing refund failure email. "
                                    + "Booking ID: {}, Refund ID: {}, Recipient: {}",
                            bookingId,
                            refundId,
                            customerEmail
                    );

                    String html = emailTemplateService
                            .refundFailureEmail(
                                    customerName,
                                    bookingId,
                                    refundAmount,
                                    refundId
                            );

                    return emailService.sendHtmlEmail(
                            customerEmail,
                            "Refund Update - Car Rental System",
                            html
                    );
                }
        );
    }

    private void registerEmailAfterCommit(
            String emailType,
            String bookingId,
            Supplier<Boolean> emailTask) {

        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            log.error(
                    "Transaction synchronization inactive. "
                            + "{} email was not scheduled for booking {}",
                    emailType,
                    bookingId
            );
            return;
        }

        TransactionSynchronizationManager.registerSynchronization(
                new TransactionSynchronization() {

                    @Override
                    public void afterCommit() {

                        try {
                            log.info(
                                    "Starting {} email delivery for booking {}",
                                    emailType,
                                    bookingId
                            );

                            boolean sent = Boolean.TRUE.equals(
                                    emailTask.get()
                            );

                            if (sent) {
                                log.info(
                                        "{} email sent successfully for booking {}",
                                        emailType,
                                        bookingId
                                );
                            } else {
                                log.error(
                                        "{} email delivery failed for booking {}. "
                                                + "Check EmailService logs and SMTP configuration.",
                                        emailType,
                                        bookingId
                                );
                            }

                        } catch (Exception exception) {
                            log.error(
                                    "Exception while sending {} email for booking {}",
                                    emailType,
                                    bookingId,
                                    exception
                            );
                        }
                    }
                }
        );
    }

    private Payment findLockedPaymentByPaymentId(String paymentId) {

        Payment initialPayment = paymentRepository
                .findByRazorpayPaymentId(paymentId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Payment not found for Razorpay payment ID"
                ));

        Long bookingId = initialPayment.getBooking().getId();

        bookingRepository.findByIdForUpdate(bookingId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Booking not found"
                ));

        return paymentRepository
                .findByBookingIdForUpdate(bookingId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Payment not found for booking"
                ));
    }

    private void validateFullRefundAmount(
            Payment payment,
            long refundAmount) {

        long expectedAmount = payment.getAmount()
                .multiply(BigDecimal.valueOf(100))
                .longValueExact();

        if (refundAmount != expectedAmount) {
            throw new IllegalArgumentException(
                    "Refund amount does not match the full payment amount"
            );
        }
    }

    private JSONObject getEntity(
            JSONObject webhook,
            String resourceName) {

        JSONObject payload = webhook.optJSONObject("payload");

        if (payload == null) {
            throw new IllegalArgumentException(
                    "Invalid Razorpay webhook payload"
            );
        }

        JSONObject resource = payload.optJSONObject(resourceName);

        if (resource == null) {
            throw new IllegalArgumentException(
                    "Missing " + resourceName + " information"
            );
        }

        JSONObject entity = resource.optJSONObject("entity");

        if (entity == null) {
            throw new IllegalArgumentException(
                    "Missing " + resourceName + " entity"
            );
        }

        return entity;
    }
}
