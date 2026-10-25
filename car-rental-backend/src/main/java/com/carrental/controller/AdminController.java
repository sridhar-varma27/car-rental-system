package com.carrental.controller;

import com.carrental.entity.Role;
import com.carrental.entity.User;
import com.carrental.repository.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public AdminController(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder) {

        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @PostMapping("/create")
    public ResponseEntity<String> createAdmin() {

        String email = "admin@carrental.com";

        if (userRepository.existsByEmail(email)) {
            return ResponseEntity.ok(
                    "Admin account already exists"
            );
        }

        User admin = new User();

        admin.setName("Car Rental Admin");
        admin.setEmail(email);
        admin.setPassword(
                passwordEncoder.encode("admin123")
        );
        admin.setPhone("9999999999");
        admin.setRole(Role.ADMIN);

        userRepository.save(admin);

        return ResponseEntity.ok(
                "Admin account created successfully"
        );
    }
}