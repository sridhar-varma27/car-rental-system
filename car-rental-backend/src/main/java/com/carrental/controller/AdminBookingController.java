package com.carrental.controller;

import com.carrental.dto.BookingResponse;
import com.carrental.entity.BookingStatus;
import com.carrental.service.AdminBookingService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/bookings")
@PreAuthorize("hasRole('ADMIN')")
public class AdminBookingController {

    private final AdminBookingService adminBookingService;

    public AdminBookingController(
            AdminBookingService adminBookingService) {

        this.adminBookingService = adminBookingService;
    }

    @GetMapping
    public ResponseEntity<List<BookingResponse>> getAllBookings() {

        return ResponseEntity.ok(
                adminBookingService.getAllBookings()
        );
    }

    @GetMapping("/status/{status}")
    public ResponseEntity<List<BookingResponse>> getBookingsByStatus(
            @PathVariable BookingStatus status) {

        return ResponseEntity.ok(
                adminBookingService.getBookingsByStatus(status)
        );
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<BookingResponse> updateBookingStatus(
            @PathVariable Long id,
            @RequestParam BookingStatus status) {

        return ResponseEntity.ok(
                adminBookingService.updateBookingStatus(
                        id,
                        status
                )
        );
    }
}