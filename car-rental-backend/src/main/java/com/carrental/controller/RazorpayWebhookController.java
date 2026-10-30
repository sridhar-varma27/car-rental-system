package com.carrental.controller;

import com.carrental.service.RazorpayWebhookService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/webhooks")
public class RazorpayWebhookController {

    private final RazorpayWebhookService webhookService;

    public RazorpayWebhookController(
            RazorpayWebhookService webhookService) {
        this.webhookService = webhookService;
    }

    @PostMapping("/razorpay")
    public ResponseEntity<String> handleRazorpayWebhook(
            @RequestBody String payload,
            @RequestHeader(
                    value = "X-Razorpay-Signature",
                    required = false
            ) String signature,
            @RequestHeader(
                    value = "x-razorpay-event-id",
                    required = false
            ) String eventId) {

        webhookService.processWebhook(payload, signature, eventId);

        return ResponseEntity.ok("Webhook processed");
    }
}