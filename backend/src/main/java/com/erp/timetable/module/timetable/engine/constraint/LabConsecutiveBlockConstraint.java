package com.erp.timetable.module.timetable.engine.constraint;

import com.erp.timetable.module.availability.entity.TimeSlot;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class LabConsecutiveBlockConstraint implements SchedulingConstraint {

    /** Global fallback block size (used when a subject has no explicit per-subject block). */
    private final int practicalBlockSize;

    public LabConsecutiveBlockConstraint(
            @Value("${timetable.scheduler.practical-block-size:2}") int practicalBlockSize) {
        this.practicalBlockSize = practicalBlockSize;
    }

    @Override
    public String getConstraintName() {
        return "LAB_CONSECUTIVE_BLOCK";
    }

    @Override
    public boolean isSatisfied(CandidatePlacement placement, ConstraintContext context) {
        if (!placement.isLab()) {
            return true; // Not a practical lesson, constraint trivially satisfied
        }

        // Part 2: greedy engine sends blocks of size practicalHours, so the
        // constraint must accept that size (not the dropdown clamped [1,2]).
        int blockSize = placement.getSubject() != null
            ? placement.getSubject().getPracticalHours()
            : practicalBlockSize;

        List<TimeSlot> slots = placement.getSlots();
        if (slots == null || slots.isEmpty() || slots.size() > blockSize) {
            return false; // A practical session may occupy at most `blockSize` periods
        }

        for (int i = 0; i < slots.size(); i++) {
            TimeSlot current = slots.get(i);
            if (Boolean.TRUE.equals(current.getIsBreak())) {
                return false; // Cannot span over break
            }
            if (i > 0) {
                TimeSlot prev = slots.get(i - 1);
                if (current.getSlotOrder() != prev.getSlotOrder() + 1) {
                    return false; // Periods are not strictly consecutive
                }
            }
        }
        return true;
    }

    @Override
    public String getViolationMessage(CandidatePlacement placement) {
        int blockSize = placement.getSubject() != null
            ? placement.getSubject().getPracticalHours()
            : practicalBlockSize;
        return "Practical lesson " + placement.getSubject().getSubjectCode() +
            " requires " + blockSize + " consecutive non-break periods in a single day";
    }
}
