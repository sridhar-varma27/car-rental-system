
package com.carrental.dto;

public class RazorpayOrderResponse {

    private final Long bookingId;
    private final String keyId;
    private final String orderId;
    private final Long amount;
    private final String currency;

    public RazorpayOrderResponse(
            Long bookingId,
            String keyId,
            String orderId,
            Long amount,
            String currency) {
        this.bookingId = bookingId;
        this.keyId = keyId;
        this.orderId = orderId;
        this.amount = amount;
        this.currency = currency;
    }

    public Long getBookingId() {
        return bookingId;
    }

    public String getKeyId() {
        return keyId;
    }

    public String getOrderId() {
        return orderId;
    }

    public Long getAmount() {
        return amount;
    }

    public String getCurrency() {
        return currency;
    }
}
