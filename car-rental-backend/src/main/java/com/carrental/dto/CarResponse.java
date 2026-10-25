
package com.carrental.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public class CarResponse {

    private Long id;
    private String brand;
    private String model;
    private String category;
    private BigDecimal pricePerDay;
    private String fuelType;
    private String transmission;
    private Integer seatingCapacity;
    private String imageUrl;
    private Boolean available;
    private Integer quantity;
    private Integer availableQuantity;
    private LocalDateTime createdAt;

    public CarResponse() {
    }

    // Original constructor retained for compatibility.
    public CarResponse(
            Long id,
            String brand,
            String model,
            String category,
            BigDecimal pricePerDay,
            String fuelType,
            String transmission,
            Integer seatingCapacity,
            String imageUrl,
            Boolean available,
            Integer quantity,
            LocalDateTime createdAt) {

        this(
                id,
                brand,
                model,
                category,
                pricePerDay,
                fuelType,
                transmission,
                seatingCapacity,
                imageUrl,
                available,
                quantity,
                quantity == null || quantity < 1 ? 1 : quantity,
                createdAt
        );
    }

    // Constructor supporting date-specific availability.
    public CarResponse(
            Long id,
            String brand,
            String model,
            String category,
            BigDecimal pricePerDay,
            String fuelType,
            String transmission,
            Integer seatingCapacity,
            String imageUrl,
            Boolean available,
            Integer quantity,
            Integer availableQuantity,
            LocalDateTime createdAt) {

        this.id = id;
        this.brand = brand;
        this.model = model;
        this.category = category;
        this.pricePerDay = pricePerDay;
        this.fuelType = fuelType;
        this.transmission = transmission;
        this.seatingCapacity = seatingCapacity;
        this.imageUrl = imageUrl;
        this.available = available;
        this.quantity = quantity == null || quantity < 1 ? 1 : quantity;
        this.availableQuantity = availableQuantity == null
                ? this.quantity
                : Math.max(0, Math.min(availableQuantity, this.quantity));
        this.createdAt = createdAt;
    }

    public Long getId() {
        return id;
    }

    public String getBrand() {
        return brand;
    }

    public String getModel() {
        return model;
    }

    public String getCategory() {
        return category;
    }

    public BigDecimal getPricePerDay() {
        return pricePerDay;
    }

    public String getFuelType() {
        return fuelType;
    }

    public String getTransmission() {
        return transmission;
    }

    public Integer getSeatingCapacity() {
        return seatingCapacity;
    }

    public String getImageUrl() {
        return imageUrl;
    }

    public Boolean getAvailable() {
        return available;
    }

    public Integer getQuantity() {
        return quantity;
    }

    public Integer getAvailableQuantity() {
        return availableQuantity;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }
}
