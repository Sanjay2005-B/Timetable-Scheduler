package com.erp.timetable.module.auth.controller;

import com.erp.timetable.common.response.ApiResponse;
import com.erp.timetable.module.auth.dto.InstitutionRequest;
import com.erp.timetable.module.auth.dto.InstitutionResponse;
import com.erp.timetable.module.auth.service.InstitutionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

/**
 * Global institution/college information endpoints.
 *
 * SECURITY: the institution is a single global row (id = 1). No id is ever
 * read from the request — a client cannot point the endpoint at another
 * institution. Updates require ROLE_SUPER_ADMIN, enforced server-side via
 * {@code @PreAuthorize}.
 */
@RestController
@RequestMapping("/institution")
@RequiredArgsConstructor
@Tag(name = "Institution", description = "Global college/institution information (single row, SUPER_ADMIN-controlled)")
public class InstitutionController {

    private final InstitutionService institutionService;

    @GetMapping
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Get the global institution information (any authenticated user)")
    public ResponseEntity<ApiResponse<InstitutionResponse>> getInstitution() {
        return ResponseEntity.ok(ApiResponse.success(institutionService.getInstitution()));
    }

    @PutMapping
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    @Operation(summary = "Update the global institution information (SUPER_ADMIN only)")
    public ResponseEntity<ApiResponse<InstitutionResponse>> updateInstitution(
            @Valid @RequestBody InstitutionRequest request) {
        InstitutionResponse response = institutionService.updateInstitution(request);
        return ResponseEntity.ok(ApiResponse.success("Institution updated", response));
    }
}