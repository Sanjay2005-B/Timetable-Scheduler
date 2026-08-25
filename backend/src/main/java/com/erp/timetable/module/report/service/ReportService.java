package com.erp.timetable.module.report.service;

import com.erp.timetable.module.classroom.entity.Classroom;
import com.erp.timetable.module.classroom.repository.ClassroomRepository;
import com.erp.timetable.module.faculty.entity.Faculty;
import com.erp.timetable.module.faculty.repository.FacultyRepository;
import com.erp.timetable.module.timetable.entity.TimetableEntry;
import com.erp.timetable.module.timetable.repository.TimetableEntryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class ReportService {

    /** Canonical working-day ordering for the Faculty Schedule Report: MON=1 ... SAT=6. */
    private static final Map<String, Integer> DAY_ORDER = Map.of(
        "MON", 1, "TUE", 2, "WED", 3, "THU", 4, "FRI", 5, "SAT", 6);

    private final FacultyRepository facultyRepository;
    private final ClassroomRepository classroomRepository;
    private final TimetableEntryRepository entryRepository;

    @Transactional(readOnly = true)
    public Map<String, Object> getFacultyReport(Long facultyId) {
        Faculty faculty = facultyRepository.findById(facultyId).orElse(null);
        List<TimetableEntry> entries = entryRepository.findByFacultyId(facultyId);

        Map<String, Object> report = new HashMap<>();
        report.put("faculty", faculty != null ? faculty.getFullName() : "Unknown");
        report.put("employeeId", faculty != null ? faculty.getEmployeeId() : "N/A");
        report.put("assignedPeriodsCount", entries.size());
        report.put("entries", entries.stream()
            .sorted(Comparator
                .comparingInt((TimetableEntry e) -> DAY_ORDER.getOrDefault(e.getDayOfWeek(), Integer.MAX_VALUE))
                .thenComparingInt(e -> e.getTimeSlot() != null ? e.getTimeSlot().getSlotOrder() : Integer.MAX_VALUE))
            .map(e -> Map.of(
                "day", e.getDayOfWeek(),
                "slot", e.getTimeSlot() != null ? e.getTimeSlot().getSlotOrder() : 0,
                "subject", e.getSubject() != null ? (e.getSubject().getSubjectCode() + " - " + e.getSubject().getSubjectName()) : "N/A",
                "room", e.getClassroom() != null ? e.getClassroom().getRoomNumber() : "N/A"
            ))
            .toList());
        return report;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getRoomUtilizationReport() {
        List<Classroom> rooms = classroomRepository.findAll();
        Map<String, Object> report = new HashMap<>();
        report.put("totalRooms", rooms.size());
        report.put("availableRooms", rooms.stream().filter(r -> "AVAILABLE".equals(r.getStatus())).count());
        report.put("reservedRooms", rooms.stream().filter(r -> "RESERVED".equals(r.getStatus())).count());
        report.put("maintenanceRooms", rooms.stream().filter(r -> "MAINTENANCE".equals(r.getStatus())).count());
        return report;
    }
}
