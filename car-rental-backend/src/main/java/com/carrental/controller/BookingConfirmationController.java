package com.carrental.controller;

import com.carrental.dto.BookingConfirmationResponse;
import com.carrental.service.BookingConfirmationService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/confirmations")
public class BookingConfirmationController {

    private final BookingConfirmationService confirmationService;

    public BookingConfirmationController(
            BookingConfirmationService confirmationService) {
        this.confirmationService = confirmationService;
    }

    @GetMapping("/{bookingId}")
    public ResponseEntity<BookingConfirmationResponse> getConfirmation(
            @PathVariable Long bookingId,
            Authentication authentication) {

        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(401).build();
        }

        BookingConfirmationResponse confirmation =
                confirmationService.getConfirmation(
                        bookingId,
                        authentication.getName()
                );

        return ResponseEntity.ok(confirmation);
    }
}