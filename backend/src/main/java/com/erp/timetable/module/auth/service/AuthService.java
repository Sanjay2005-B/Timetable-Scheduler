package com.erp.timetable.module.auth.service;

import com.erp.timetable.common.exception.BusinessException;
import com.erp.timetable.module.auth.dto.LoginRequest;
import com.erp.timetable.module.auth.dto.LoginResponse;
import com.erp.timetable.module.auth.dto.RefreshTokenRequest;
import com.erp.timetable.module.auth.entity.User;
import com.erp.timetable.module.auth.repository.UserRepository;
import com.erp.timetable.module.auth.security.JwtTokenProvider;
import com.erp.timetable.module.auth.security.UserPrincipal;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

/**
 * Handles login, token refresh, and logout operations.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService {

    private final AuthenticationManager authenticationManager;
    private final JwtTokenProvider jwtTokenProvider;
    private final UserRepository userRepository;

    // ── Login ──────────────────────────────────────────────────────────
    @Transactional
    public LoginResponse login(LoginRequest request) {
        Authentication authentication = authenticationManager.authenticate(
            new UsernamePasswordAuthenticationToken(
                request.getUsernameOrEmail(),
                request.getPassword()
            )
        );

        SecurityContextHolder.getContext().setAuthentication(authentication);
        UserPrincipal principal = (UserPrincipal) authentication.getPrincipal();

        String accessToken  = jwtTokenProvider.generateAccessToken(authentication);
        String refreshToken = jwtTokenProvider.generateRefreshToken();

        // Persist refresh token
        User user = userRepository.findById(principal.getId())
            .orElseThrow(() -> new BusinessException("User not found"));
        user.setRefreshToken(refreshToken);
        user.setRefreshTokenExpiry(
            Instant.now().plusMillis(jwtTokenProvider.getRefreshExpirationMs()));
        user.setLastLoginAt(Instant.now());
        userRepository.save(user);

        List<String> roles = principal.getAuthorities().stream()
            .map(GrantedAuthority::getAuthority)
            .toList();

        log.info("User '{}' logged in successfully", principal.getUsername());

        return LoginResponse.builder()
            .accessToken(accessToken)
            .refreshToken(refreshToken)
            .tokenType("Bearer")
            .expiresIn(jwtTokenProvider.getRefreshExpirationMs() / 1000)
            .userId(principal.getId())
            .username(principal.getUsername())
            .email(principal.getEmail())
            .fullName(user.getFullName())
            .departmentId(user.getDepartment() != null ? user.getDepartment().getId() : null)
            .departmentName(user.getDepartment() != null ? user.getDepartment().getName() : null)
            .roles(roles)
            .build();
    }

    // ── Refresh Token ──────────────────────────────────────────────────
    @Transactional
    public LoginResponse refreshToken(RefreshTokenRequest request) {
        User user = userRepository.findByRefreshToken(request.getRefreshToken())
            .orElseThrow(() -> new BusinessException("Invalid refresh token"));

        if (user.getRefreshTokenExpiry() == null ||
                user.getRefreshTokenExpiry().isBefore(Instant.now())) {
            userRepository.revokeRefreshToken(user.getId());
            throw new BusinessException("Refresh token has expired. Please login again.");
        }

        List<String> roles = user.getRoles().stream()
            .map(r -> r.getName().name())
            .toList();

        String newAccessToken = jwtTokenProvider.generateAccessTokenFromUsername(
            user.getUsername(), user.getId(), user.getEmail(), roles);

        // Rotate refresh token
        String newRefreshToken = jwtTokenProvider.generateRefreshToken();
        user.setRefreshToken(newRefreshToken);
        user.setRefreshTokenExpiry(
            Instant.now().plusMillis(jwtTokenProvider.getRefreshExpirationMs()));
        userRepository.save(user);

        return LoginResponse.builder()
            .accessToken(newAccessToken)
            .refreshToken(newRefreshToken)
            .tokenType("Bearer")
            .expiresIn(jwtTokenProvider.getRefreshExpirationMs() / 1000)
            .userId(user.getId())
            .username(user.getUsername())
            .email(user.getEmail())
            .fullName(user.getFullName())
            .departmentId(user.getDepartment() != null ? user.getDepartment().getId() : null)
            .departmentName(user.getDepartment() != null ? user.getDepartment().getName() : null)
            .roles(roles)
            .build();
    }

    // ── Logout ─────────────────────────────────────────────────────────
    @Transactional
    public void logout(Long userId) {
        userRepository.revokeRefreshToken(userId);
        log.info("User {} logged out, refresh token revoked", userId);
    }
}
