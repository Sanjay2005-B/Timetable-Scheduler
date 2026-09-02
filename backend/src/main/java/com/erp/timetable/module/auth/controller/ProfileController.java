package com.erp.timetable.module.auth.controller;

import com.erp.timetable.common.response.ApiResponse;
import com.erp.timetable.module.auth.dto.ProfileResponse;
import com.erp.timetable.module.auth.dto.UpdateProfileRequest;
import com.erp.timetable.module.auth.security.UserPrincipal;
import com.erp.timetable.module.auth.service.ProfileService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/**
 * "My Profile" endpoints.
 *
 * SECURITY: the current user's identity is derived EXCLUSIVELY from the
 * authenticated JWT principal (@AuthenticationPrincipal). There is NO
 * @RequestParam, @PathVariable, or request-body user ID anywhere in these
 * handlers — a client cannot target another user by changing an ID in the
 * request, because no ID is read from the request at all.
 */
@RestController
@RequestMapping("/me")
@RequiredArgsConstructor
@Tag(name = "Profile", description = "Current user's own profile (identity from JWT only)")
public class ProfileController {

    private final ProfileService profileService;

    @GetMapping
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Get currently authenticated user's full profile")
    public ResponseEntity<ApiResponse<ProfileResponse>> getProfile(
            @AuthenticationPrincipal UserPrincipal principal) {
        ProfileResponse response = profileService.getProfile(principal.getId());
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PutMapping
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Update own profile — whitelisted fields only (fullName, phone, profilePhotoUrl)")
    public ResponseEntity<ApiResponse<ProfileResponse>> updateProfile(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody UpdateProfileRequest request) {
        ProfileResponse response = profileService.updateProfile(principal.getId(), request);
        return ResponseEntity.ok(ApiResponse.success("Profile updated", response));
    }
}