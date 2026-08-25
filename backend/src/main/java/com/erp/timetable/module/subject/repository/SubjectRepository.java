package com.erp.timetable.module.subject.repository;

import com.erp.timetable.module.subject.entity.Subject;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SubjectRepository extends JpaRepository<Subject, Long> {

    Optional<Subject> findBySubjectCode(String subjectCode);

    boolean existsBySubjectCode(String subjectCode);

    List<Subject> findByDepartmentId(Long departmentId);

    List<Subject> findByAcademicYearIdIn(List<Long> academicYearIds);

    List<Subject> findBySectionIdIn(List<Long> sectionIds);

    List<Subject> findByAssignedFacultyId(Long facultyId);

    @Query("SELECT s FROM Subject s WHERE " +
           "(:search IS NULL OR LOWER(s.subjectCode) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(s.subjectName) LIKE LOWER(CONCAT('%', :search, '%'))) AND " +
           "(:deptId IS NULL OR s.department.id = :deptId) AND " +
           "(:academicYearId IS NULL OR s.academicYear.id = :academicYearId) AND " +
           "(:sectionId IS NULL OR s.section.id = :sectionId) AND " +
           "(:subjectType IS NULL OR s.subjectType = :subjectType)")
    Page<Subject> searchSubjects(String search, Long deptId, Long academicYearId, Long sectionId, String subjectType, Pageable pageable);
}
