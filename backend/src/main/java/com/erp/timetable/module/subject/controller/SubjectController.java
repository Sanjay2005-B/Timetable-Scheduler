package com.erp.timetable.module.subject.controller;

import com.erp.timetable.common.response.ApiResponse;
import com.erp.timetable.common.response.PageResponse;
import com.erp.timetable.module.subject.dto.SubjectRequest;
import com.erp.timetable.module.subject.dto.SubjectResponse;
import com.erp.timetable.module.subject.service.SubjectService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/subjects")
@RequiredArgsConstructor
@Tag(name = "Subject Management", description = "CRUD endpoints for curriculum subjects")
public class SubjectController {

    private final SubjectService subjectService;

    @PostMapping
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'HOD')")
    @Operation(summary = "Create a new subject")
    public ResponseEntity<ApiResponse<SubjectResponse>> createSubject(
            @Valid @RequestBody SubjectRequest request) {
        SubjectResponse response = subjectService.createSubject(request);
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(ApiResponse.success("Subject created successfully", response));
    }

    @GetMapping
    @Operation(summary = "Get paginated list of subjects")
    public ResponseEntity<ApiResponse<PageResponse<SubjectResponse>>> getSubjects(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) Long departmentId,
            @RequestParam(required = false) Long academicYearId,
            @RequestParam(required = false) Long sectionId,
            @RequestParam(required = false) String subjectType,
            @RequestParam(defaultValue = "subjectCode,asc") String sort) {
        PageResponse<SubjectResponse> pageResponse = subjectService.getSubjects(page, size, search, departmentId, academicYearId, sectionId, subjectType, sort);
        return ResponseEntity.ok(ApiResponse.success(pageResponse));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get subject by ID")
    public ResponseEntity<ApiResponse<SubjectResponse>> getSubjectById(@PathVariable Long id) {
        SubjectResponse response = subjectService.getSubjectById(id);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'HOD')")
    @Operation(summary = "Update subject details")
    public ResponseEntity<ApiResponse<SubjectResponse>> updateSubject(
            @PathVariable Long id,
            @Valid @RequestBody SubjectRequest request) {
        SubjectResponse response = subjectService.updateSubject(id, request);
        return ResponseEntity.ok(ApiResponse.success("Subject updated successfully", response));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    @Operation(summary = "Delete subject")
    public ResponseEntity<ApiResponse<Void>> deleteSubject(@PathVariable Long id) {
        subjectService.deleteSubject(id);
        return ResponseEntity.ok(ApiResponse.successMessage("Subject deleted successfully"));
    }
}
