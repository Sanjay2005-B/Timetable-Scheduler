package com.erp.timetable.module.auth.service;

import com.erp.timetable.common.exception.BusinessException;
import com.erp.timetable.module.auth.dto.InstitutionRequest;
import com.erp.timetable.module.auth.dto.InstitutionResponse;
import com.erp.timetable.module.auth.entity.Institution;
import com.erp.timetable.module.auth.repository.InstitutionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Global institution (single row, id = 1) read/update logic.
 *
 * <p>Authorization is enforced at the controller boundary:
 * <ul>
 *   <li>{@code getInstitution()} — any authenticated user.</li>
 *   <li>{@code updateInstitution()} — {@code ROLE_SUPER_ADMIN} only
 *       (via {@code @PreAuthorize} in the controller).</li>
 * </ul>
 * The row is only ever id = 1; callers cannot supply an institution id.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class InstitutionService {

    private final InstitutionRepository institutionRepository;

    @Transactional(readOnly = true)
    public InstitutionResponse getInstitution() {
        Institution inst = institutionRepository.findById(Institution.SINGLETON_ID)
            .orElseThrow(() -> new BusinessException("Institution is not configured"));
        return toResponse(inst);
    }

    @Transactional
    public InstitutionResponse updateInstitution(InstitutionRequest request) {
        Institution inst = institutionRepository.findById(Institution.SINGLETON_ID)
            .orElseGet(() -> Institution.builder().id(Institution.SINGLETON_ID).build());
        inst.setName(request.getName());
        inst.setAddress(request.getAddress());
        institutionRepository.save(inst);

        log.info("Institution information updated by {}{}",
            inst.getUpdatedBy() != null ? inst.getUpdatedBy() : "SUPER_ADMIN", "");
        return toResponse(inst);
    }

    private InstitutionResponse toResponse(Institution inst) {
        return InstitutionResponse.builder()
            .id(inst.getId())
            .name(inst.getName())
            .address(inst.getAddress())
            .build();
    }
}