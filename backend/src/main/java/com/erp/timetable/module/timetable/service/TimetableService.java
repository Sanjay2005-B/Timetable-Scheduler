package com.erp.timetable.module.timetable.service;

import com.erp.timetable.common.exception.BusinessException;
import com.erp.timetable.common.exception.ResourceNotFoundException;
import com.erp.timetable.module.department.entity.Department;
import com.erp.timetable.module.department.entity.Section;
import com.erp.timetable.module.department.repository.DepartmentRepository;
import com.erp.timetable.module.department.repository.SectionRepository;
import com.erp.timetable.module.timetable.dto.*;
import com.erp.timetable.module.timetable.engine.ScheduleEngine;
import com.erp.timetable.module.timetable.entity.Timetable;
import com.erp.timetable.module.timetable.entity.TimetableEntry;
import com.erp.timetable.module.timetable.repository.TimetableEntryRepository;
import com.erp.timetable.module.timetable.repository.TimetableRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Objects;

@Service
@RequiredArgsConstructor
@Slf4j
public class TimetableService {

    private final TimetableRepository timetableRepository;
    private final TimetableEntryRepository entryRepository;
    private final DepartmentRepository departmentRepository;
    private final SectionRepository sectionRepository;
    private final ScheduleEngine generatorEngine;

    @PersistenceContext
    private EntityManager entityManager;

    @Transactional
    public TimetableResponse generateTimetable(GenerateTimetableRequest request) {
        Department dept = departmentRepository.findById(request.getDepartmentId())
            .orElseThrow(() -> new ResourceNotFoundException("Department", "id", request.getDepartmentId()));

        Section section = sectionRepository.findById(request.getSectionId())
            .orElseThrow(() -> new ResourceNotFoundException("Section", "id", request.getSectionId()));

        // Timetables may only be generated for sections selected in the department's
        // per-year configuration (Department -> Academic Year -> Selected Sections).
        if (section.getAcademicYear() == null
                || section.getAcademicYear().getDepartment() == null
                || !Objects.equals(section.getAcademicYear().getDepartment().getId(), dept.getId())) {
            throw new BusinessException(
                "Section '" + section.getName() + "' does not belong to department '" + dept.getName()
                    + "'. Timetables can only be generated for sections configured under the department.");
        }

        // Timetables may not be generated for sections whose academic year is disabled
        // in the department's per-year configuration.
        if (!Boolean.TRUE.equals(section.getAcademicYear().getIsEnabled())) {
            throw new BusinessException(
                "Cannot generate timetable for section '" + section.getName() + "': the academic year '"
                    + section.getAcademicYear().getYearLabel() + "' is disabled for department '" + dept.getName()
                    + "'. Enable the year in Department Management to schedule it.");
        }

        // Find or create timetable
        Timetable timetable = timetableRepository.findBySectionIdAndSemester(request.getSectionId(), request.getSemester())
            .orElseGet(() -> Timetable.builder()
                .academicSession(request.getAcademicSession() != null ? request.getAcademicSession() : currentAcademicSession())
                .department(dept)
                .section(section)
                .semester(request.getSemester())
                .status("DRAFT")
                .build());

        if (timetable.getId() != null) {
            timetable.getEntries().clear();
            timetable.getConflicts().clear();
            timetable = timetableRepository.saveAndFlush(timetable);
        }

        generatorEngine.generateSchedule(timetable, false);
        Timetable saved = timetableRepository.save(timetable);
        log.info("Timetable generated: ID {} for section {}", saved.getId(), section.getName());
        return mapToResponse(saved);
    }

    @Transactional
    public TimetableResponse regenerateUnlockedSlots(Long timetableId) {
        // Remove unlocked entries from the DB before the engine re-places them,
        // otherwise fresh inserts can collide with the not-yet-flushed old rows
        // under the (timetable_id, day_of_week, time_slot_id) unique constraint.
        entryRepository.deleteUnlockedByTimetableId(timetableId);
        entityManager.flush();

        // Drop the stale managed instances so the engine's locked-entry
        // preservation never schedules orphan-removal deletes for rows that the
        // bulk delete above already removed (double-delete would fail the flush).
        entityManager.clear();

        Timetable timetable = timetableRepository.findById(timetableId)
            .orElseThrow(() -> new ResourceNotFoundException("Timetable", "id", timetableId));

        generatorEngine.generateSchedule(timetable, true); // Partial regenerate preserving locked slots
        Timetable saved = timetableRepository.save(timetable);
        log.info("Timetable regenerated (unlocked slots only): ID {}", saved.getId());
        return mapToResponse(saved);
    }

    @Transactional
    public TimetableResponse toggleSlotLock(Long entryId) {
        TimetableEntry entry = entryRepository.findById(entryId)
            .orElseThrow(() -> new ResourceNotFoundException("TimetableEntry", "id", entryId));

        entry.setIsLocked(!Boolean.TRUE.equals(entry.getIsLocked()));
        entryRepository.save(entry);
        log.info("Timetable entry ID {} lock status toggled to {}", entryId, entry.getIsLocked());

        return mapToResponse(entry.getTimetable());
    }

    @Transactional(readOnly = true)
    public TimetableResponse getTimetableById(Long id) {
        Timetable timetable = timetableRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Timetable", "id", id));
        return mapToResponse(timetable);
    }

    @Transactional(readOnly = true)
    public TimetableResponse getTimetableBySectionAndSemester(Long sectionId, Integer semester) {
        Timetable timetable = timetableRepository.findBySectionIdAndSemester(sectionId, semester)
            .orElseThrow(() -> new ResourceNotFoundException("Timetable for section ID " + sectionId + ", semester " + semester + " not found"));
        return mapToResponse(timetable);
    }

    @Transactional(readOnly = true)
    public List<TimetableResponse> getTimetablesByDepartment(Long departmentId) {
        return timetableRepository.findByDepartmentId(departmentId).stream()
            .map(this::mapToResponse)
            .toList();
    }

    @Transactional
    public void deleteTimetable(Long id) {
        Timetable timetable = timetableRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Timetable", "id", id));
        timetableRepository.delete(timetable);
        log.info("Timetable deleted: ID {}", id);
    }

    /**
     * Derives the current academic session from the calendar instead of a stale
     * hardcoded label: July–December is the ODD (current-year → next-year)
     * semester, January–June the EVEN (previous-year → current-year) one.
     */
    private String currentAcademicSession() {
        LocalDate now = LocalDate.now();
        int year = now.getYear();
        if (now.getMonthValue() >= 7) {
            return year + "-" + (year + 1) + " ODD";
        }
        return (year - 1) + "-" + year + " EVEN";
    }

    private TimetableResponse mapToResponse(Timetable t) {
        List<TimetableEntryDto> entryDtos = t.getEntries() == null ? List.of() :
            t.getEntries().stream().map(e -> TimetableEntryDto.builder()
                .id(e.getId())
                .dayOfWeek(e.getDayOfWeek())
                .timeSlotId(e.getTimeSlot().getId())
                .timeSlotLabel(e.getTimeSlot().getSlotLabel())
                .timeSlotTime(e.getTimeSlot().getStartTime() + " - " + e.getTimeSlot().getEndTime())
                .subjectId(e.getSubject().getId())
                .subjectCode(e.getSubject().getSubjectCode())
                .subjectName(e.getSubject().getSubjectName())
                .subjectType(e.getSubject().getSubjectType())
                .facultyId(e.getFaculty().getId())
                .facultyName(e.getFaculty().getFullName())
                .classroomId(e.getClassroom().getId())
                .roomNumber(e.getClassroom().getRoomNumber())
                .roomName(e.getClassroom().getRoomName())
                .isLocked(Boolean.TRUE.equals(e.getIsLocked()))
                .isLab(Boolean.TRUE.equals(e.getIsLab()))
                .build()).toList();

        List<TimetableConflictDto> conflictDtos = t.getConflicts() == null ? List.of() :
            t.getConflicts().stream().map(c -> TimetableConflictDto.builder()
                .id(c.getId())
                .conflictType(c.getConflictType())
                .description(c.getDescription())
                .severity(c.getSeverity())
                .build()).toList();

        return TimetableResponse.builder()
            .id(t.getId())
            .academicSession(t.getAcademicSession())
            .departmentId(t.getDepartment().getId())
            .departmentName(t.getDepartment().getName())
            .sectionId(t.getSection().getId())
            .sectionName(t.getSection().getName())
            .semester(t.getSemester())
            .status(t.getStatus())
            .conflictCount(t.getConflictCount())
            .optimizationScore(t.getOptimizationScore() != null ? t.getOptimizationScore() : 100)
            .createdAt(t.getCreatedAt() != null ? String.valueOf(t.getCreatedAt()) : null)
            .entries(entryDtos)
            .conflicts(conflictDtos)
            .build();
    }
}
