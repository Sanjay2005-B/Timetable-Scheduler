package com.erp.timetable.module.dashboard.controller;

import com.erp.timetable.common.response.ApiResponse;
import com.erp.timetable.module.dashboard.dto.DashboardStatsResponse;
import com.erp.timetable.module.dashboard.service.DashboardService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/dashboard")
@RequiredArgsConstructor
@Tag(name = "Dashboard", description = "Real-time system statistics and analytics")
public class DashboardController {

    private final DashboardService dashboardService;

    @GetMapping("/stats")
    @Operation(summary = "Get database-backed dashboard statistics")
    public ResponseEntity<ApiResponse<DashboardStatsResponse>> getDashboardStats() {
        DashboardStatsResponse stats = dashboardService.getDashboardStats();
        return ResponseEntity.ok(ApiResponse.success(stats));
    }
}
