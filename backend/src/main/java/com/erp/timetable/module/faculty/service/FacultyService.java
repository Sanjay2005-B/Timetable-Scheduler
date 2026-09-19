package com.erp.timetable.module.faculty.service;

import com.erp.timetable.common.exception.BusinessException;
import com.erp.timetable.common.exception.ResourceNotFoundException;
import com.erp.timetable.common.response.PageResponse;
import com.erp.timetable.module.auth.entity.Role;
import com.erp.timetable.module.auth.entity.RoleName;
import com.erp.timetable.module.auth.entity.User;
import com.erp.timetable.module.auth.entity.College;
import com.erp.timetable.module.auth.repository.RoleRepository;
import com.erp.timetable.module.auth.repository.UserRepository;
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
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

import com.erp.timetable.module.subject.entity.Subject;
import com.erp.timetable.module.subject.repository.SubjectRepository;
import com.erp.timetable.module.timetable.repository.TimetableEntryRepository;
import com.erp.timetable.config.security.TenantContext;

@Service
@RequiredArgsConstructor
@Slf4j
public class FacultyService {

    private final FacultyRepository facultyRepository;
    private final DepartmentRepository departmentRepository;
    private final SubjectRepository subjectRepository;
    private final TimetableEntryRepository timetableEntryRepository;
    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final TenantContext tenantContext;

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
        User caller = tenantContext.currentUser();
        College college = caller != null ? caller.getCollege()
            : (department != null ? department.getCollege() : null);

        Faculty faculty = Faculty.builder()
            .employeeId(request.getEmployeeId())
            .firstName(request.getFirstName())
            .lastName(request.getLastName())
            .email(request.getEmail())
            .phone(request.getPhone())
            .department(department)
            .college(college)
            .designation(request.getDesignation())
            .qualification(request.getQualification())
            .specialization(request.getSpecialization())
            .maxDailyHours(request.getMaxDailyHours())
            .maxWeeklyHours(request.getMaxWeeklyHours())
            .status(request.getStatus() != null ? request.getStatus() : "AVAILABLE")
            .build();

        Faculty saved = facultyRepository.save(faculty);
        createFacultyLogin(saved, request);
        log.info("Faculty created: {} ({})", saved.getFullName(), saved.getEmployeeId());
        return mapToResponse(saved);
    }

    /**
     * Provisions the ROLE_FACULTY account with the credentials supplied on the
     * faculty creation form (if any) and links it to the faculty record via
     * {@code Faculty.userId}. The account is bound to the faculty's own
     * department. Never reuses/overwrites an existing account — a conflicting
     * Login ID or email aborts with a 422 before any write.
     */
    private void createFacultyLogin(Faculty saved, FacultyRequest request) {
        if (request.getUsername() == null || request.getUsername().isBlank()) {
            return;
        }
        String username = request.getUsername().trim();
        Long collegeId = saved.getCollege() != null ? saved.getCollege().getId() : null;
        if (userRepository.existsByUsernameForCollege(username, collegeId)) {
            throw new BusinessException("Faculty Login ID '" + username + "' is already in use in this college");
        }
        String password = request.getPassword();
        if (password == null || password.isBlank()) {
            throw new BusinessException("Faculty Login Password is required when providing a Faculty Login ID");
        }
        if (userRepository.existsByEmailForCollege(saved.getEmail(), collegeId)) {
            throw new BusinessException("Email '" + saved.getEmail() + "' is already in use by a user account in this college");
        }

        Role facultyRole = roleRepository.findByName(RoleName.ROLE_FACULTY)
            .orElseThrow(() -> new BusinessException("Faculty role is not configured"));

        User facultyUser = User.builder()
            .username(username)
            .email(saved.getEmail())
            .password(passwordEncoder.encode(password))
            .fullName(saved.getFullName())
            .department(saved.getDepartment())
            .college(saved.getCollege())
            .isActive(true)
            .build();
        facultyUser.addRole(facultyRole);
        userRepository.save(facultyUser);

        saved.setUserId(facultyUser.getId());
        facultyRepository.save(saved);
        log.info("Faculty login created for {} ({}): username={}, userId={}",
            saved.getFullName(), saved.getEmployeeId(), username, facultyUser.getId());
    }

    @Transactional(readOnly = true)
    public PageResponse<FacultyResponse> getFaculty(int page, int size, String search, Long deptId, String status, String sort) {
        Sort sortObj = Sort.by(Sort.Direction.ASC, "firstName");
        Pageable pageable = PageRequest.of(page, size, sortObj);

        User caller = tenantContext.currentUser();
        boolean global = caller == null || caller.hasRole(RoleName.ROLE_SUPER_ADMIN);
        String normalizedSearch = search != null && search.isBlank() ? null : search;
        String normalizedStatus = status != null && status.isBlank() ? null : status;

        Page<Faculty> pageResult;
        if (global) {
            pageResult = facultyRepository.searchFaculty(
                normalizedSearch, deptId, normalizedStatus, pageable);
        } else {
            Long collegeId = caller.getCollege() != null ? caller.getCollege().getId() : null;
            pageResult = facultyRepository.searchFacultyByCollege(
                normalizedSearch, deptId, collegeId, normalizedStatus, pageable);
        }

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
        if (department != null) {
            faculty.setCollege(department.getCollege());
        }
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
