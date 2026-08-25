package com.erp.timetable.module.auth.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;

/**
 * Login response containing JWT access token, refresh token, and user info.
 */
@Data
@Builder
public class LoginResponse {

    private String accessToken;
    private String refreshToken;
    private String tokenType;
    private long expiresIn;         // seconds
    private Long userId;
    private String username;
    private String email;
    private String fullName;
    private Long departmentId;
    private String departmentName;
    private List<String> roles;
}
