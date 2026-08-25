package com.erp.timetable.module.subject.service;

import com.erp.timetable.common.exception.BusinessException;
import com.erp.timetable.common.exception.ResourceNotFoundException;
import com.erp.timetable.common.response.PageResponse;
import com.erp.timetable.module.department.entity.AcademicYear;
import com.erp.timetable.module.department.entity.Department;
import com.erp.timetable.module.department.entity.Section;
import com.erp.timetable.module.department.repository.AcademicYearRepository;
import com.erp.timetable.module.department.repository.DepartmentRepository;
import com.erp.timetable.module.department.repository.SectionRepository;
import com.erp.timetable.module.subject.dto.SubjectRequest;
import com.erp.timetable.module.subject.dto.SubjectResponse;
import com.erp.timetable.module.subject.entity.Subject;
import com.erp.timetable.module.subject.repository.SubjectRepository;
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
import java.util.Objects;

@Service
@RequiredArgsConstructor
@Slf4j
public class SubjectService {

    private final SubjectRepository subjectRepository;
    private final DepartmentRepository departmentRepository;
    private final AcademicYearRepository academicYearRepository;
    private final SectionRepository sectionRepository;
    private final FacultyRepository facultyRepository;
    private final com.erp.timetable.module.timetable.repository.TimetableEntryRepository entryRepository;

    @Transactional
    public SubjectResponse createSubject(SubjectRequest request) {
        if (subjectRepository.existsBySubjectCode(request.getSubjectCode())) {
            throw new BusinessException("Subject with code '" + request.getSubjectCode() + "' already exists");
        }

        Department department = request.getDepartmentId() != null ?
            departmentRepository.findById(request.getDepartmentId()).orElse(null) : null;

        AcademicYear academicYear = request.getAcademicYearId() != null ?
            academicYearRepository.findById(request.getAcademicYearId()).orElse(null) : null;

        Section section = request.getSectionId() != null ?
            sectionRepository.findById(request.getSectionId()).orElse(null) : null;

        Faculty assignedFaculty = request.getFacultyId() != null ?
            facultyRepository.findById(request.getFacultyId()).orElse(null) : null;

        validateHierarchy(department, academicYear, section);

        Subject subject = Subject.builder()
            .subjectCode(request.getSubjectCode())
            .subjectName(request.getSubjectName())
            .department(department)
            .academicYear(academicYear)
            .section(section)
            .assignedFaculty(assignedFaculty)
            .semester(request.getSemester())
            .credits(request.getCredits())
            .theoryHours(request.getTheoryHours())
            .practicalHours(request.getPracticalHours())
            .subjectType(request.getSubjectType() != null ? request.getSubjectType() : "THEORY")
            .sessionBlockSize(request.getSessionBlockSize() != null ? request.getSessionBlockSize() : 1)
            .isActive(request.getIsActive() != null ? request.getIsActive() : true)
            .totalSemesterHours(request.getTotalSemesterHours() != null ? request.getTotalSemesterHours() : 45)
            .teachingWeeks(request.getTeachingWeeks() != null ? request.getTeachingWeeks() : 15)
            .build();

        Subject saved = subjectRepository.save(subject);
        log.info("Subject created: {} - {}", saved.getSubjectCode(), saved.getSubjectName());
        return mapToResponse(saved);
    }

    @Transactional(readOnly = true)
    public PageResponse<SubjectResponse> getSubjects(int page, int size, String search, Long deptId, Long academicYearId, Long sectionId, String subjectType, String sort) {
        Sort sortObj = Sort.by(Sort.Direction.ASC, "subjectCode");
        Pageable pageable = PageRequest.of(page, size, sortObj);

        Page<Subject> pageResult = subjectRepository.searchSubjects(
            search != null && search.isBlank() ? null : search,
            deptId,
            academicYearId,
            sectionId,
            subjectType != null && subjectType.isBlank() ? null : subjectType,
            pageable
        );

        List<SubjectResponse> content = pageResult.getContent().stream()
            .map(this::mapToResponse)
            .toList();

        return PageResponse.<SubjectResponse>builder()
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
    public SubjectResponse getSubjectById(Long id) {
        Subject subject = subjectRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Subject", "id", id));
        return mapToResponse(subject);
    }

    @Transactional
    public SubjectResponse updateSubject(Long id, SubjectRequest request) {
        Subject subject = subjectRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Subject", "id", id));

        Department department = request.getDepartmentId() != null ?
            departmentRepository.findById(request.getDepartmentId()).orElse(null) : null;

        AcademicYear academicYear = request.getAcademicYearId() != null ?
            academicYearRepository.findById(request.getAcademicYearId()).orElse(null) : null;

        Section section = request.getSectionId() != null ?
            sectionRepository.findById(request.getSectionId()).orElse(null) : null;

        Faculty assignedFaculty = request.getFacultyId() != null ?
            facultyRepository.findById(request.getFacultyId()).orElse(null) : null;

        validateHierarchy(department, academicYear, section);

        subject.setSubjectCode(request.getSubjectCode());
        subject.setSubjectName(request.getSubjectName());
        subject.setDepartment(department);
        subject.setAcademicYear(academicYear);
        subject.setSection(section);
        subject.setAssignedFaculty(assignedFaculty);
        subject.setSemester(request.getSemester());
        subject.setCredits(request.getCredits());
        subject.setTheoryHours(request.getTheoryHours());
        subject.setPracticalHours(request.getPracticalHours());
        subject.setSubjectType(request.getSubjectType() != null ? request.getSubjectType() : subject.getSubjectType());
        subject.setSessionBlockSize(request.getSessionBlockSize() != null ? request.getSessionBlockSize() : subject.getSessionBlockSize());
        subject.setIsActive(request.getIsActive() != null ? request.getIsActive() : subject.getIsActive());
        if (request.getTotalSemesterHours() != null) subject.setTotalSemesterHours(request.getTotalSemesterHours());
        if (request.getTeachingWeeks() != null) subject.setTeachingWeeks(request.getTeachingWeeks());

        Subject updated = subjectRepository.save(subject);
        return mapToResponse(updated);
    }

    @Transactional
    public void deleteSubject(Long id) {
        Subject subject = subjectRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Subject", "id", id));
        entryRepository.deleteBySubjectId(id);
        subjectRepository.delete(subject);
    }

    /**
     * Subjects must belong to a fully-specified Department -> Academic Year ->
     * Section hierarchy and a valid semester. Every level of the chain is required,
     * and the section must belong to the selected academic year, which in turn must
     * belong to the selected department. Rows created before this hierarchy was
     * enforced (department-level subjects with null year/section) are left untouched.
     */
    private void validateHierarchy(Department department, AcademicYear academicYear, Section section) {
        if (department == null) {
            throw new BusinessException("Department is required for a subject. Select the department offering this subject.");
        }
        if (academicYear == null) {
            throw new BusinessException("Academic Year is required for a subject. Select the academic year for this subject.");
        }
        if (section == null) {
            throw new BusinessException("Section is required for a subject. Select the section this subject is taught to.");
        }
        if (academicYear.getDepartment() == null || !Objects.equals(academicYear.getDepartment().getId(), department.getId())) {
            throw new BusinessException("Academic year '" + academicYear.getYearLabel()
                + "' does not belong to department '" + department.getName() + "'. Choose a matching academic year.");
        }
        if (section.getAcademicYear() == null || !Objects.equals(section.getAcademicYear().getId(), academicYear.getId())) {
            throw new BusinessException("Section '" + section.getName()
                + "' does not belong to academic year '" + academicYear.getYearLabel() + "'. Choose a matching section.");
        }
        assertYearEnabled(academicYear, section);
    }

    /**
     * Subjects may not reference an academic year (or a section whose year) that
     * is disabled in the department's per-year configuration.
     */
    private void assertYearEnabled(AcademicYear academicYear, Section section) {
        if (academicYear != null && !Boolean.TRUE.equals(academicYear.getIsEnabled())) {
            throw new BusinessException("Cannot assign subject to '" + academicYear.getYearLabel()
                + "': the academic year is disabled for its department. Enable it in Department Management first.");
        }
        if (section != null && section.getAcademicYear() != null
                && !Boolean.TRUE.equals(section.getAcademicYear().getIsEnabled())) {
            throw new BusinessException("Cannot assign subject to section '" + section.getName()
                + "': its academic year '" + section.getAcademicYear().getYearLabel() + "' is disabled.");
        }
    }

    private SubjectResponse mapToResponse(Subject s) {
        return SubjectResponse.builder()
            .id(s.getId())
            .subjectCode(s.getSubjectCode())
            .subjectName(s.getSubjectName())
            .departmentId(s.getDepartment() != null ? s.getDepartment().getId() : null)
            .departmentName(s.getDepartment() != null ? s.getDepartment().getName() : null)
            .academicYearId(s.getAcademicYear() != null ? s.getAcademicYear().getId() : null)
            .yearLabel(s.getAcademicYear() != null ? s.getAcademicYear().getYearLabel() : null)
            .sectionId(s.getSection() != null ? s.getSection().getId() : null)
            .sectionName(s.getSection() != null ? s.getSection().getName() : null)
            .facultyId(s.getAssignedFaculty() != null ? s.getAssignedFaculty().getId() : null)
            .facultyName(s.getAssignedFaculty() != null ? s.getAssignedFaculty().getFullName() : null)
            .semester(s.getSemester())
            .credits(s.getCredits())
            .theoryHours(s.getTheoryHours())
            .practicalHours(s.getPracticalHours())
            .subjectType(s.getSubjectType())
            .sessionBlockSize(s.getSessionBlockSize() != null ? s.getSessionBlockSize() : 1)
            .isActive(s.getIsActive())
            .totalSemesterHours(s.getTotalSemesterHours())
            .teachingWeeks(s.getTeachingWeeks())
            .createdAt(s.getCreatedAt())
            .build();
    }
}
