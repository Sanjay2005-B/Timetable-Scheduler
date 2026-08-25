package com.erp.timetable.module.auth.controller;

import com.erp.timetable.common.response.ApiResponse;
import com.erp.timetable.module.auth.dto.LoginRequest;
import com.erp.timetable.module.auth.dto.LoginResponse;
import com.erp.timetable.module.auth.dto.RefreshTokenRequest;
import com.erp.timetable.module.auth.security.UserPrincipal;
import com.erp.timetable.module.auth.service.AuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/**
 * REST controller for authentication operations.
 * All endpoints under /auth/** are publicly accessible (no JWT required).
 */
@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
@Tag(name = "Authentication", description = "Login, refresh, and logout endpoints")
public class AuthController {

    private final AuthService authService;

    @PostMapping("/login")
    @Operation(summary = "Authenticate user and obtain JWT token pair")
    public ResponseEntity<ApiResponse<LoginResponse>> login(
            @Valid @RequestBody LoginRequest request) {
        LoginResponse response = authService.login(request);
        return ResponseEntity.ok(ApiResponse.success("Login successful", response));
    }

    @PostMapping("/refresh")
    @Operation(summary = "Refresh JWT access token using a valid refresh token")
    public ResponseEntity<ApiResponse<LoginResponse>> refresh(
            @Valid @RequestBody RefreshTokenRequest request) {
        LoginResponse response = authService.refreshToken(request);
        return ResponseEntity.ok(ApiResponse.success("Token refreshed", response));
    }

    @PostMapping("/logout")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Logout and revoke the current refresh token")
    public ResponseEntity<ApiResponse<Void>> logout(
            @AuthenticationPrincipal UserPrincipal principal) {
        authService.logout(principal.getId());
        return ResponseEntity.ok(ApiResponse.successMessage("Logged out successfully"));
    }

    @GetMapping("/me")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Get currently authenticated user's profile")
    public ResponseEntity<ApiResponse<UserPrincipal>> me(
            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(ApiResponse.success(principal));
    }
}
