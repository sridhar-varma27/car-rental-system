package com.carrental.service;

import com.carrental.dto.LoginRequest;
import com.carrental.dto.RegisterRequest;
import com.carrental.entity.Role;
import com.carrental.entity.User;
import com.carrental.repository.UserRepository;
import com.carrental.security.JwtService;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.Locale;

@Service
public class AuthService {

    private static final Logger log =
            LoggerFactory.getLogger(AuthService.class);

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final EmailService emailService;
    private final EmailTemplateService emailTemplateService;

    public AuthService(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            EmailService emailService,
            EmailTemplateService emailTemplateService) {

        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.emailService = emailService;
        this.emailTemplateService = emailTemplateService;
    }

    /**
     * Registers a new user and sends a welcome email after the
     * database transaction commits successfully.
     */
    @Transactional
    public User register(RegisterRequest request) {

        String email = normalizeEmail(request.getEmail());

        if (userRepository.existsByEmail(email)) {
            throw new RuntimeException("Email already registered");
        }

        User user = new User();
        user.setName(request.getName().trim());
        user.setEmail(email);
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setPhone(request.getPhone());
        user.setRole(Role.USER);

        User savedUser = userRepository.save(user);

        String customerName = savedUser.getName();
        String customerEmail = savedUser.getEmail();

        if (TransactionSynchronizationManager.isSynchronizationActive()) {

            TransactionSynchronizationManager.registerSynchronization(
                    new TransactionSynchronization() {

                        @Override
                        public void afterCommit() {

                            try {
                                String html = emailTemplateService
                                        .welcomeEmail(customerName);

                                emailService.sendHtmlEmail(
                                        customerEmail,
                                        "Welcome to Car Rental System!",
                                        html
                                );

                            } catch (Exception exception) {
                                log.error(
                                        "Unable to generate or send welcome email to {}",
                                        customerEmail,
                                        exception
                                );
                            }
                        }
                    }
            );
        } else {
            log.warn(
                    "Transaction synchronization is inactive. "
                            + "Welcome email was not scheduled for {}",
                    customerEmail
            );
        }

        return savedUser;
    }

    /**
     * Authenticates a user and generates a JWT token.
     */
    @Transactional(readOnly = true)
    public String login(LoginRequest request) {

        String email = normalizeEmail(request.getEmail());

        User user = userRepository.findByEmail(email)
                .orElseThrow(() ->
                        new RuntimeException("Invalid email or password"));

        boolean passwordMatches = passwordEncoder.matches(
                request.getPassword(),
                user.getPassword()
        );

        if (!passwordMatches) {
            throw new RuntimeException("Invalid email or password");
        }

        return jwtService.generateToken(
                user.getEmail(),
                user.getRole().name()
        );
    }

    /**
     * Retrieves a user using their email address.
     */
    @Transactional(readOnly = true)
    public User getUserByEmail(String email) {

        String normalizedEmail = normalizeEmail(email);

        return userRepository.findByEmail(normalizedEmail)
                .orElseThrow(() ->
                        new RuntimeException("User not found"));
    }

    /**
     * Normalizes and validates an email address.
     */
    private String normalizeEmail(String email) {

        if (email == null || email.isBlank()) {
            throw new IllegalArgumentException("Email is required");
        }

        return email.trim().toLowerCase(Locale.ROOT);
    }
}