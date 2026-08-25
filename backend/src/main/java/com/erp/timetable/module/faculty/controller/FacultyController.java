package com.erp.timetable.module.faculty.controller;

import com.erp.timetable.common.response.ApiResponse;
import com.erp.timetable.common.response.PageResponse;
import com.erp.timetable.module.faculty.dto.FacultyRequest;
import com.erp.timetable.module.faculty.dto.FacultyResponse;
import com.erp.timetable.module.faculty.service.FacultyService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/faculty")
@RequiredArgsConstructor
@Tag(name = "Faculty Management", description = "CRUD endpoints for faculty profiles")
public class FacultyController {

    private final FacultyService facultyService;

    @PostMapping
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'HOD')")
    @Operation(summary = "Create a new faculty profile")
    public ResponseEntity<ApiResponse<FacultyResponse>> createFaculty(
            @Valid @RequestBody FacultyRequest request) {
        FacultyResponse response = facultyService.createFaculty(request);
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(ApiResponse.success("Faculty created successfully", response));
    }

    @GetMapping
    @Operation(summary = "Get paginated list of faculty")
    public ResponseEntity<ApiResponse<PageResponse<FacultyResponse>>> getFaculty(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) Long departmentId,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "firstName,asc") String sort) {
        PageResponse<FacultyResponse> pageResponse = facultyService.getFaculty(page, size, search, departmentId, status, sort);
        return ResponseEntity.ok(ApiResponse.success(pageResponse));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get faculty by ID")
    public ResponseEntity<ApiResponse<FacultyResponse>> getFacultyById(@PathVariable Long id) {
        FacultyResponse response = facultyService.getFacultyById(id);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'HOD')")
    @Operation(summary = "Update faculty profile")
    public ResponseEntity<ApiResponse<FacultyResponse>> updateFaculty(
            @PathVariable Long id,
            @Valid @RequestBody FacultyRequest request) {
        FacultyResponse response = facultyService.updateFaculty(id, request);
        return ResponseEntity.ok(ApiResponse.success("Faculty updated successfully", response));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    @Operation(summary = "Delete faculty profile")
    public ResponseEntity<ApiResponse<Void>> deleteFaculty(@PathVariable Long id) {
        facultyService.deleteFaculty(id);
        return ResponseEntity.ok(ApiResponse.successMessage("Faculty deleted successfully"));
    }
}
