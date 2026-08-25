package com.erp.timetable.module.classroom.service;

import com.erp.timetable.common.exception.ResourceNotFoundException;
import com.erp.timetable.common.response.PageResponse;
import com.erp.timetable.module.classroom.dto.ClassroomRequest;
import com.erp.timetable.module.classroom.dto.ClassroomResponse;
import com.erp.timetable.module.classroom.entity.Classroom;
import com.erp.timetable.module.classroom.repository.ClassroomRepository;
import com.erp.timetable.module.department.entity.AcademicYear;
import com.erp.timetable.module.department.entity.Department;
import com.erp.timetable.module.department.entity.Section;
import com.erp.timetable.module.department.repository.AcademicYearRepository;
import com.erp.timetable.module.department.repository.DepartmentRepository;
import com.erp.timetable.module.department.repository.SectionRepository;
import com.erp.timetable.module.timetable.repository.TimetableEntryRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class ClassroomService {

    private final ClassroomRepository classroomRepository;
    private final DepartmentRepository departmentRepository;
    private final AcademicYearRepository academicYearRepository;
    private final SectionRepository sectionRepository;
    private final TimetableEntryRepository timetableEntryRepository;

    @Transactional
    public ClassroomResponse createClassroom(ClassroomRequest request) {
        Department department = null;
        if (request.getDepartmentId() != null) {
            department = departmentRepository.findById(request.getDepartmentId())
                .orElseThrow(() -> new ResourceNotFoundException("Department", "id", request.getDepartmentId()));
        }

        AcademicYear academicYear = null;
        if (request.getAcademicYearId() != null) {
            academicYear = academicYearRepository.findById(request.getAcademicYearId())
                .orElseThrow(() -> new ResourceNotFoundException("AcademicYear", "id", request.getAcademicYearId()));
        }

        Section section = null;
        if (request.getSectionId() != null) {
            section = sectionRepository.findById(request.getSectionId())
                .orElseThrow(() -> new ResourceNotFoundException("Section", "id", request.getSectionId()));
        }

        Classroom classroom = Classroom.builder()
            .roomNumber(request.getRoomNumber())
            .roomName(request.getRoomName())
            .building(request.getBuilding())
            .department(department)
            .academicYear(academicYear)
            .section(section)
            .roomType(request.getRoomType() != null ? request.getRoomType() : "LECTURE_HALL")
            .capacity(request.getCapacity())
            .floor(request.getFloor())
            .status(request.getStatus() != null ? request.getStatus() : "AVAILABLE")
            .build();

        Classroom saved = classroomRepository.save(classroom);
        log.info("Classroom created: {} in {}", saved.getRoomNumber(), saved.getBuilding());
        return mapToResponse(saved);
    }

    @Transactional(readOnly = true)
    public PageResponse<ClassroomResponse> getClassrooms(int page, int size, String search, String roomType, String status, String sort) {
        Sort sortObj = Sort.by(Sort.Direction.ASC, "roomNumber");
        Pageable pageable = PageRequest.of(page, size, sortObj);

        Page<Classroom> pageResult = classroomRepository.searchClassrooms(
            search != null && search.isBlank() ? null : search,
            roomType != null && roomType.isBlank() ? null : roomType,
            status != null && status.isBlank() ? null : status,
            pageable
        );

        List<ClassroomResponse> content = pageResult.getContent().stream()
            .map(this::mapToResponse)
            .toList();

        return PageResponse.<ClassroomResponse>builder()
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
    public ClassroomResponse getClassroomById(Long id) {
        Classroom classroom = classroomRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Classroom", "id", id));
        return mapToResponse(classroom);
    }

    @Transactional
    public ClassroomResponse updateClassroom(Long id, ClassroomRequest request) {
        Classroom classroom = classroomRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Classroom", "id", id));

        Department department = null;
        if (request.getDepartmentId() != null) {
            department = departmentRepository.findById(request.getDepartmentId())
                .orElseThrow(() -> new ResourceNotFoundException("Department", "id", request.getDepartmentId()));
        }

        AcademicYear academicYear = null;
        if (request.getAcademicYearId() != null) {
            academicYear = academicYearRepository.findById(request.getAcademicYearId())
                .orElseThrow(() -> new ResourceNotFoundException("AcademicYear", "id", request.getAcademicYearId()));
        }

        Section section = null;
        if (request.getSectionId() != null) {
            section = sectionRepository.findById(request.getSectionId())
                .orElseThrow(() -> new ResourceNotFoundException("Section", "id", request.getSectionId()));
        }

        classroom.setRoomNumber(request.getRoomNumber());
        classroom.setRoomName(request.getRoomName());
        classroom.setBuilding(request.getBuilding());
        classroom.setDepartment(department);
        classroom.setAcademicYear(academicYear);
        classroom.setSection(section);
        classroom.setRoomType(request.getRoomType() != null ? request.getRoomType() : "LECTURE_HALL");
        classroom.setCapacity(request.getCapacity());
        classroom.setFloor(request.getFloor());
        classroom.setStatus(request.getStatus() != null ? request.getStatus() : "AVAILABLE");

        Classroom updated = classroomRepository.save(classroom);
        return mapToResponse(updated);
    }

    @Transactional
    public void deleteClassroom(Long id) {
        Classroom classroom = classroomRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Classroom", "id", id));

        // Remove timetable entries referencing this classroom
        // (timetable_entries.classroom_id is NOT NULL, so the entries must be
        //  deleted before the classroom row itself can be removed)
        timetableEntryRepository.deleteByClassroomId(id);

        classroomRepository.delete(classroom);
    }

    private ClassroomResponse mapToResponse(Classroom c) {
        return ClassroomResponse.builder()
            .id(c.getId())
            .roomNumber(c.getRoomNumber())
            .roomName(c.getRoomName())
            .building(c.getBuilding())
            .departmentId(c.getDepartment() != null ? c.getDepartment().getId() : null)
            .departmentName(c.getDepartment() != null ? c.getDepartment().getName() : null)
            .academicYearId(c.getAcademicYear() != null ? c.getAcademicYear().getId() : null)
            .academicYearLabel(c.getAcademicYear() != null ? c.getAcademicYear().getYearLabel() : null)
            .sectionId(c.getSection() != null ? c.getSection().getId() : null)
            .sectionName(c.getSection() != null ? c.getSection().getName() : null)
            .roomType(c.getRoomType())
            .capacity(c.getCapacity())
            .floor(c.getFloor())
            .status(c.getStatus())
            .createdAt(c.getCreatedAt())
            .build();
    }
}
