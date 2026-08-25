package com.erp.timetable.module.timetable.repository;

import com.erp.timetable.module.timetable.entity.Timetable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TimetableRepository extends JpaRepository<Timetable, Long> {
    Optional<Timetable> findBySectionIdAndSemester(Long sectionId, Integer semester);
    Optional<Timetable> findBySectionIdAndSemesterAndAcademicSession(Long sectionId, Integer semester, String academicSession);
    List<Timetable> findByDepartmentId(Long departmentId);
    List<Timetable> findBySectionIdIn(List<Long> sectionIds);
}
