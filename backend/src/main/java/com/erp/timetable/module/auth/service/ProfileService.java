package com.erp.timetable.module.auth.service;

import com.erp.timetable.common.exception.BusinessException;
import com.erp.timetable.module.auth.dto.ProfileResponse;
import com.erp.timetable.module.auth.dto.UpdateProfileRequest;
import com.erp.timetable.module.auth.entity.Institution;
import com.erp.timetable.module.auth.entity.User;
import com.erp.timetable.module.auth.repository.InstitutionRepository;
import com.erp.timetable.module.auth.repository.UserRepository;
import com.erp.timetable.module.faculty.entity.Faculty;
import com.erp.timetable.module.faculty.repository.FacultyRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class ProfileService {

    private final UserRepository userRepository;
    private final FacultyRepository facultyRepository;
    private final InstitutionRepository institutionRepository;

    // ── Read own profile ───────────────────────────────────────────────
    @Transactional(readOnly = true)
    public ProfileResponse getProfile(Long userId) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new BusinessException("User not found"));
        return toResponse(user);
    }

    // ── Update own profile (whitelist enforced by DTO shape) ────────────
    @Transactional
    public ProfileResponse updateProfile(Long userId, UpdateProfileRequest request) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new BusinessException("User not found"));

        // Apply ONLY the whitelisted fields. role / isActive / department /
        // username / email / employeeId / designation are NOT settable here —
        // they have no field in UpdateProfileRequest, so they cannot arrive.
        user.setFullName(request.getFullName());
        user.setPhone(request.getPhone());
        user.setProfilePhotoUrl(request.getProfilePhotoUrl());
        userRepository.save(user);

        log.info("User {} updated own profile", userId);
        return toResponse(user);
    }

    // ── Mapping ────────────────────────────────────────────────────────
    private ProfileResponse toResponse(User user) {
        Faculty faculty = user.getId() != null
            ? facultyRepository.findByUserId(user.getId()).orElse(null)
            : null;

        Institution institution = institutionRepository
            .findById(Institution.SINGLETON_ID).orElse(null);

        return ProfileResponse.builder()
            .userId(user.getId())
            .username(user.getUsername())
            .email(user.getEmail())
            .fullName(user.getFullName())
            .phone(user.getPhone())
            .profilePhotoUrl(user.getProfilePhotoUrl())
            .departmentId(user.getDepartment() != null ? user.getDepartment().getId() : null)
            .departmentName(user.getDepartment() != null ? user.getDepartment().getName() : null)
            .institutionName(institution != null ? institution.getName() : null)
            .institutionAddress(institution != null ? institution.getAddress() : null)
            .employeeId(faculty != null ? faculty.getEmployeeId() : null)
            .designation(faculty != null ? faculty.getDesignation() : null)
            .roles(user.getRoles().stream().map(r -> r.getName().name()).toList())
            .isActive(user.getIsActive())
            .joinedDate(user.getCreatedAt())
            .lastLoginAt(user.getLastLoginAt())
            .activeSessionCount(0L) // populated in Phase 5 (user_sessions table)
            .build();
    }
}