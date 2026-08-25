package com.erp.timetable.module.report.controller;

import com.erp.timetable.common.response.ApiResponse;
import com.erp.timetable.module.report.service.ReportService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/reports")
@RequiredArgsConstructor
@Tag(name = "Report Centre", description = "Endpoints for timetable & room utilization reporting")
public class ReportController {

    private final ReportService reportService;

    @GetMapping("/faculty/{id}")
    @Operation(summary = "Get schedule report for a faculty member")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getFacultyReport(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(reportService.getFacultyReport(id)));
    }

    @GetMapping("/rooms/utilization")
    @Operation(summary = "Get classroom utilization summary report")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getRoomUtilization() {
        return ResponseEntity.ok(ApiResponse.success(reportService.getRoomUtilizationReport()));
    }
}
