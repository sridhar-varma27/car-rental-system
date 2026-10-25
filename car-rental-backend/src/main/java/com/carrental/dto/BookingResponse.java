package com.carrental.dto;

import com.carrental.entity.BookingStatus;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

public class BookingResponse {

    private Long id;
    private Long userId;
    private Long carId;
    private String carBrand;
    private String carModel;
    private LocalDate startDate;
    private LocalDate endDate;
    private Integer numberOfDays;
    private BigDecimal pricePerDay;
    private BigDecimal totalPrice;
    private BookingStatus status;
    private LocalDateTime createdAt;

    public BookingResponse() {
    }

    public BookingResponse(
            Long id,
            Long userId,
            Long carId,
            String carBrand,
            String carModel,
            LocalDate startDate,
            LocalDate endDate,
            Integer numberOfDays,
            BigDecimal pricePerDay,
            BigDecimal totalPrice,
            BookingStatus status,
            LocalDateTime createdAt) {

        this.id = id;
        this.userId = userId;
        this.carId = carId;
        this.carBrand = carBrand;
        this.carModel = carModel;
        this.startDate = startDate;
        this.endDate = endDate;
        this.numberOfDays = numberOfDays;
        this.pricePerDay = pricePerDay;
        this.totalPrice = totalPrice;
        this.status = status;
        this.createdAt = createdAt;
    }

    public Long getId() {
        return id;
    }

    public Long getUserId() {
        return userId;
    }

    public Long getCarId() {
        return carId;
    }

    public String getCarBrand() {
        return carBrand;
    }

    public String getCarModel() {
        return carModel;
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

    public BookingStatus getStatus() {
        return status;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }
}