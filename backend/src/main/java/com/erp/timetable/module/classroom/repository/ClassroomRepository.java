package com.erp.timetable.module.classroom.repository;

import com.erp.timetable.module.classroom.entity.Classroom;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ClassroomRepository extends JpaRepository<Classroom, Long> {

    List<Classroom> findByStatus(String status);

    List<Classroom> findByDepartment_Id(Long departmentId);

    @Query("SELECT c FROM Classroom c WHERE " +
           "(:search IS NULL OR LOWER(c.roomNumber) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(c.roomName) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(c.building) LIKE LOWER(CONCAT('%', :search, '%'))) AND " +
           "(:roomType IS NULL OR c.roomType = :roomType) AND " +
           "(:status IS NULL OR c.status = :status)")
    Page<Classroom> searchClassrooms(String search, String roomType, String status, Pageable pageable);
}
