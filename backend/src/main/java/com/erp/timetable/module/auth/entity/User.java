package com.erp.timetable.module.auth.entity;

import com.erp.timetable.common.audit.AuditableEntity;
import com.erp.timetable.module.department.entity.Department;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.HashSet;
import java.util.Set;

/**
 * System user entity.
 * Represents admins, HODs, faculty members, and exam coordinators.
 */
@Entity
@Table(name = "users", indexes = {
    @Index(name = "idx_users_email", columnList = "email"),
    @Index(name = "idx_users_username", columnList = "username")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User extends AuditableEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "username", nullable = false, unique = true, length = 100)
    private String username;

    @Column(name = "email", nullable = false, unique = true, length = 255)
    private String email;

    @Column(name = "password", nullable = false)
    private String password;

    @Column(name = "full_name", nullable = false, length = 200)
    private String fullName;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private Boolean isActive = true;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "department_id")
    private Department department;

    @Column(name = "refresh_token", length = 500)
    private String refreshToken;

    @Column(name = "refresh_token_expiry")
    private Instant refreshTokenExpiry;

    @Column(name = "last_login_at")
    private Instant lastLoginAt;

    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(
        name = "user_roles",
        joinColumns = @JoinColumn(name = "user_id"),
        inverseJoinColumns = @JoinColumn(name = "role_id")
    )
    @Builder.Default
    private Set<Role> roles = new HashSet<>();

    // ── Helpers ────────────────────────────────────────────────────────

    public void addRole(Role role) {
        this.roles.add(role);
    }

    public boolean hasRole(RoleName roleName) {
        return this.roles.stream()
            .anyMatch(r -> r.getName() == roleName);
    }
}
