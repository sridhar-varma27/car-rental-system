package com.carrental.dto;

import com.carrental.entity.BookingStatus;

import java.math.BigDecimal;
import java.time.LocalDate;

public class BookingConfirmationResponse {

    private Long bookingId;
    private String customerName;
    private String customerEmail;
    private String car;
    private LocalDate startDate;
    private LocalDate endDate;
    private Integer numberOfDays;
    private BigDecimal pricePerDay;
    private BigDecimal totalPrice;
    private BookingStatus bookingStatus;
    private String paymentStatus;
    private String transactionId;

    public BookingConfirmationResponse() {
    }

    public BookingConfirmationResponse(
            Long bookingId,
            String customerName,
            String customerEmail,
            String car,
            LocalDate startDate,
            LocalDate endDate,
            Integer numberOfDays,
            BigDecimal pricePerDay,
            BigDecimal totalPrice,
            BookingStatus bookingStatus,
            String paymentStatus,
            String transactionId) {

        this.bookingId = bookingId;
        this.customerName = customerName;
        this.customerEmail = customerEmail;
        this.car = car;
        this.startDate = startDate;
        this.endDate = endDate;
        this.numberOfDays = numberOfDays;
        this.pricePerDay = pricePerDay;
        this.totalPrice = totalPrice;
        this.bookingStatus = bookingStatus;
        this.paymentStatus = paymentStatus;
        this.transactionId = transactionId;
    }

    public Long getBookingId() {
        return bookingId;
    }

    public String getCustomerName() {
        return customerName;
    }

    public String getCustomerEmail() {
        return customerEmail;
    }

    public String getCar() {
        return car;
    }

    public LocalDate getStartDate() {
        return startDate;
    }

    public LocalDate getEndDate() {
        return endDate;
    }

    public Integer getNumberOfDays() {
        return numberOfDays;
    }

    public BigDecimal getPricePerDay() {
        return pricePerDay;
    }

    public BigDecimal getTotalPrice() {
        return totalPrice;
    }

    public BookingStatus getBookingStatus() {
        return bookingStatus;
    }

    public String getPaymentStatus() {
        return paymentStatus;
    }

    public String getTransactionId() {
        return transactionId;
    }
}