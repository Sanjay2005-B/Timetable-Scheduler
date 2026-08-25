package com.erp.timetable.module.department.repository;

import com.erp.timetable.module.department.entity.Department;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DepartmentRepository extends JpaRepository<Department, Long> {

    Optional<Department> findByName(String name);

    boolean existsByName(String name);

    boolean existsByNameAndIdNot(String name, Long id);

    List<Department> findByIsArchivedFalse();

    @Query("SELECT d FROM Department d WHERE " +
           "(:search IS NULL OR :search = '' OR LOWER(d.name) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "(d.hodName IS NOT NULL AND LOWER(d.hodName) LIKE LOWER(CONCAT('%', :search, '%'))) OR " +
           "(d.building IS NOT NULL AND LOWER(d.building) LIKE LOWER(CONCAT('%', :search, '%')))) AND " +
           "(:isArchived IS NULL OR d.isArchived = :isArchived)")
    Page<Department> searchDepartments(@org.springframework.data.repository.query.Param("search") String search, @org.springframework.data.repository.query.Param("isArchived") Boolean isArchived, Pageable pageable);
}
