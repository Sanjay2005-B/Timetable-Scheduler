package com.erp.timetable.module.faculty.service;

import com.erp.timetable.common.exception.BusinessException;
import com.erp.timetable.common.exception.ResourceNotFoundException;
import com.erp.timetable.common.response.PageResponse;
import com.erp.timetable.module.department.entity.Department;
import com.erp.timetable.module.department.repository.DepartmentRepository;
import com.erp.timetable.module.faculty.dto.FacultyRequest;
import com.erp.timetable.module.faculty.dto.FacultyResponse;
import com.erp.timetable.module.faculty.entity.Faculty;
import com.erp.timetable.module.faculty.repository.FacultyRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

import com.erp.timetable.module.subject.entity.Subject;
import com.erp.timetable.module.subject.repository.SubjectRepository;
import com.erp.timetable.module.timetable.repository.TimetableEntryRepository;

@Service
@RequiredArgsConstructor
@Slf4j
public class FacultyService {

    private final FacultyRepository facultyRepository;
    private final DepartmentRepository departmentRepository;
    private final SubjectRepository subjectRepository;
    private final TimetableEntryRepository timetableEntryRepository;

    @Transactional
    public FacultyResponse createFaculty(FacultyRequest request) {
        if (facultyRepository.existsByEmployeeId(request.getEmployeeId())) {
            throw new BusinessException("Faculty with Employee ID '" + request.getEmployeeId() + "' already exists");
        }
        if (facultyRepository.existsByEmail(request.getEmail())) {
            throw new BusinessException("Faculty with email '" + request.getEmail() + "' already exists");
        }

        Department department = null;
        if (request.getDepartmentId() != null) {
            department = departmentRepository.findById(request.getDepartmentId())
                .orElseThrow(() -> new ResourceNotFoundException("Department", "id", request.getDepartmentId()));
        }

        Faculty faculty = Faculty.builder()
            .employeeId(request.getEmployeeId())
            .firstName(request.getFirstName())
            .lastName(request.getLastName())
            .email(request.getEmail())
            .phone(request.getPhone())
            .department(department)
            .designation(request.getDesignation())
            .qualification(request.getQualification())
            .specialization(request.getSpecialization())
            .maxDailyHours(request.getMaxDailyHours())
            .maxWeeklyHours(request.getMaxWeeklyHours())
            .status(request.getStatus() != null ? request.getStatus() : "AVAILABLE")
            .build();

        Faculty saved = facultyRepository.save(faculty);
        log.info("Faculty created: {} ({})", saved.getFullName(), saved.getEmployeeId());
        return mapToResponse(saved);
    }

    @Transactional(readOnly = true)
    public PageResponse<FacultyResponse> getFaculty(int page, int size, String search, Long deptId, String status, String sort) {
        Sort sortObj = Sort.by(Sort.Direction.ASC, "firstName");
        Pageable pageable = PageRequest.of(page, size, sortObj);

        Page<Faculty> pageResult = facultyRepository.searchFaculty(
            search != null && search.isBlank() ? null : search,
            deptId,
            status != null && status.isBlank() ? null : status,
            pageable
        );

        List<FacultyResponse> content = pageResult.getContent().stream()
            .map(this::mapToResponse)
            .toList();

        return PageResponse.<FacultyResponse>builder()
            .content(content)
            .page(pageResult.getNumber())
            .size(pageResult.getSize())
            .totalElements(pageResult.getTotalElements())
            .totalPages(pageResult.getTotalPages())
            .first(pageResult.isFirst())
            .last(pageResult.isLast())
            .build();
    }

    @Transactional(readOnly = true)
    public FacultyResponse getFacultyById(Long id) {
        Faculty faculty = facultyRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Faculty", "id", id));
        return mapToResponse(faculty);
    }

    @Transactional
    public FacultyResponse updateFaculty(Long id, FacultyRequest request) {
        Faculty faculty = facultyRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Faculty", "id", id));

        Department department = null;
        if (request.getDepartmentId() != null) {
            department = departmentRepository.findById(request.getDepartmentId())
                .orElseThrow(() -> new ResourceNotFoundException("Department", "id", request.getDepartmentId()));
        }

        faculty.setEmployeeId(request.getEmployeeId());
        faculty.setFirstName(request.getFirstName());
        faculty.setLastName(request.getLastName());
        faculty.setEmail(request.getEmail());
        faculty.setPhone(request.getPhone());
        faculty.setDepartment(department);
        faculty.setDesignation(request.getDesignation());
        faculty.setQualification(request.getQualification());
        faculty.setSpecialization(request.getSpecialization());
        faculty.setMaxDailyHours(request.getMaxDailyHours());
        faculty.setMaxWeeklyHours(request.getMaxWeeklyHours());
        faculty.setStatus(request.getStatus() != null ? request.getStatus() : "AVAILABLE");

        Faculty updated = facultyRepository.save(faculty);
        return mapToResponse(updated);
    }

    @Transactional
    public void deleteFaculty(Long id) {
        Faculty faculty = facultyRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Faculty", "id", id));

        // Step 1: Unlink any assigned subjects
        List<Subject> assignedSubjects = subjectRepository.findByAssignedFacultyId(id);
        for (Subject s : assignedSubjects) {
            s.setAssignedFaculty(null);
            subjectRepository.save(s);
        }

        // Step 2: Remove timetable entries referencing this faculty
        // (timetable_entries.faculty_id is NOT NULL, so the entries must be
        //  deleted before the faculty row itself can be removed)
        timetableEntryRepository.deleteByFacultyId(id);

        // Step 3: Delete faculty
        facultyRepository.delete(faculty);
        log.info("Faculty deleted: {} (unlinked {} subjects)", id, assignedSubjects.size());
    }

    private FacultyResponse mapToResponse(Faculty f) {
        return FacultyResponse.builder()
            .id(f.getId())
            .employeeId(f.getEmployeeId())
            .firstName(f.getFirstName())
            .lastName(f.getLastName())
            .fullName(f.getFullName())
            .email(f.getEmail())
            .phone(f.getPhone())
            .departmentId(f.getDepartment() != null ? f.getDepartment().getId() : null)
            .departmentName(f.getDepartment() != null ? f.getDepartment().getName() : null)
            .designation(f.getDesignation())
            .qualification(f.getQualification())
            .specialization(f.getSpecialization())
            .maxDailyHours(f.getMaxDailyHours())
            .maxWeeklyHours(f.getMaxWeeklyHours())
            .status(f.getStatus())
            .createdAt(f.getCreatedAt())
            .build();
    }
}
