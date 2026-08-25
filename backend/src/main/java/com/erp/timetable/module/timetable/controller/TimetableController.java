package com.erp.timetable.module.timetable.controller;

import com.erp.timetable.common.response.ApiResponse;
import com.erp.timetable.module.timetable.dto.GenerateTimetableRequest;
import com.erp.timetable.module.timetable.dto.TimetableResponse;
import com.erp.timetable.module.timetable.service.TimetableService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/timetable")
@RequiredArgsConstructor
public class TimetableController {

    private final TimetableService timetableService;

    @PostMapping("/generate")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'HOD', 'EXAM_COORDINATOR')")
    public ResponseEntity<ApiResponse<TimetableResponse>> generateTimetable(
            @Valid @RequestBody GenerateTimetableRequest request) {
        TimetableResponse response = timetableService.generateTimetable(request);
        return ResponseEntity.ok(ApiResponse.success("Timetable generated successfully", response));
    }

    @PostMapping("/{id}/regenerate-unlocked")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'HOD', 'EXAM_COORDINATOR')")
    public ResponseEntity<ApiResponse<TimetableResponse>> regenerateUnlockedSlots(@PathVariable Long id) {
        TimetableResponse response = timetableService.regenerateUnlockedSlots(id);
        return ResponseEntity.ok(ApiResponse.success("Unlocked slots regenerated successfully", response));
    }

    @PatchMapping("/entries/{entryId}/lock")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'HOD', 'EXAM_COORDINATOR')")
    public ResponseEntity<ApiResponse<TimetableResponse>> toggleSlotLock(@PathVariable Long entryId) {
        TimetableResponse response = timetableService.toggleSlotLock(entryId);
        return ResponseEntity.ok(ApiResponse.success("Slot lock status updated", response));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<TimetableResponse>> getTimetableById(@PathVariable Long id) {
        TimetableResponse response = timetableService.getTimetableById(id);
        return ResponseEntity.ok(ApiResponse.success("Timetable retrieved", response));
    }

    @GetMapping("/section/{sectionId}/semester/{semester}")
    public ResponseEntity<ApiResponse<TimetableResponse>> getTimetableBySectionAndSemester(
            @PathVariable Long sectionId,
            @PathVariable Integer semester) {
        TimetableResponse response = timetableService.getTimetableBySectionAndSemester(sectionId, semester);
        return ResponseEntity.ok(ApiResponse.success("Timetable retrieved", response));
    }

    @GetMapping("/department/{departmentId}")
    public ResponseEntity<ApiResponse<List<TimetableResponse>>> getTimetablesByDepartment(
            @PathVariable Long departmentId) {
        List<TimetableResponse> response = timetableService.getTimetablesByDepartment(departmentId);
        return ResponseEntity.ok(ApiResponse.success("Department timetables retrieved", response));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<Void>> deleteTimetable(@PathVariable Long id) {
        timetableService.deleteTimetable(id);
        return ResponseEntity.ok(ApiResponse.success("Timetable deleted successfully", null));
    }
}
