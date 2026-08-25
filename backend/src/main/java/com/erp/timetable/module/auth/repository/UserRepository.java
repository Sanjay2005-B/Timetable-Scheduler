package com.erp.timetable.module.auth.repository;

import com.erp.timetable.module.auth.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByUsername(String username);

    List<User> findByDepartment_Id(Long departmentId);

    Optional<User> findByEmail(String email);

    Optional<User> findByUsernameOrEmail(String username, String email);

    Optional<User> findByRefreshToken(String refreshToken);

    boolean existsByUsername(String username);

    boolean existsByEmail(String email);

    @Modifying
    @Query("UPDATE User u SET u.refreshToken = null, u.refreshTokenExpiry = null WHERE u.id = :userId")
    void revokeRefreshToken(Long userId);
}
