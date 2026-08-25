package com.erp.timetable.module.timetable.planning.constraint;

import ai.timefold.solver.core.api.score.HardSoftScore;
import ai.timefold.solver.core.api.score.stream.test.ConstraintVerifier;
import com.erp.timetable.module.timetable.planning.model.PlannableFaculty;
import com.erp.timetable.module.timetable.planning.model.PlannableSubject;
import com.erp.timetable.module.timetable.planning.model.PlannableTimeSlot;
import com.erp.timetable.module.timetable.planning.model.PlanningLesson;
import com.erp.timetable.module.timetable.planning.model.SchedulingSolution;
import org.junit.jupiter.api.Test;

import static com.erp.timetable.module.timetable.planning.constraint.ConstraintTestFixtures.faculty;
import static com.erp.timetable.module.timetable.planning.constraint.ConstraintTestFixtures.room;
import static com.erp.timetable.module.timetable.planning.constraint.ConstraintTestFixtures.subject;
import static com.erp.timetable.module.timetable.planning.constraint.ConstraintTestFixtures.window;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Phase 6C — {@code TimetableConstraintProvider#subjectDistribution} (soft).
 *
 * <p>The objective clusters repeated sessions of the same subject onto as few
 * teaching days as possible, matching the Greedy planner's {@code idealDaySizes}
 * business rule (the ideal now follows the college-wide daily teaching cap of 5).
 * Exact scoring formula:
 * <pre>
 *   idealDays(subject)     = 1 if weeklyHours &lt;= 5, else ceil(weeklyHours / 5)
 *   daysUsed(subject)      = distinct teaching days
 *   dayPenalty             = max(0, daysUsed - idealDays) * EXTRA_THEORY_DAY_WEIGHT
 *   gapPenalty             = non-adjacent pairs of same-day THEORY sessions
 *   penalty(subject)       = dayPenalty + gapPenalty
 *   total                  = SUM over (subject, section)
 * </pre>
 * {@code EXTRA_THEORY_DAY_WEIGHT} (5, the daily cap) dominates the gap weight
 * so "fewer teaching days" always beats same-day compactness: the lunch-break
 * rule forces one gap on any 5-lesson day, and a day penalty equal to the gap
 * penalty would make 3 days look as good as 2.
 * LAB is exempt from clustering: it keeps the original spread rule (one point
 * per same-day session beyond the first, a session being a consecutive run), so
 * the sessions of a {@code sessionBlockSize} 1 lab stay distinct single-period
 * runs and never merge into one oversized block. The hierarchy stays hard rules
 * &gt; UNASSIGNED_LESSONS &gt;
 * IDLE_GAP &gt; SUBJECT_DISTRIBUTION; this constraint never contributes to the
 * hard score, never penalises different subjects on one day, never penalises a
 * subject taught for a full day of back-to-back sessions, and never blocks a
 * placement the hard rules allow.
 */
class SubjectDistributionConstraintTest {

    private final ConstraintVerifier<TimetableConstraintProvider, SchedulingSolution> constraintVerifier =
        ConstraintVerifier.build(new TimetableConstraintProvider(), SchedulingSolution.class, PlanningLesson.class);

    private static final PlannableFaculty PROF = faculty(1);
    // 5 weekly hours → ideal 1 teaching day.
    private static final PlannableSubject MATH = subject(1, "MATH101", "THEORY", 1L, 5);
    private static final PlannableSubject PHYSICS = subject(2, "PHY201", "THEORY", 1L, 5);
    // 6 weekly hours → ideal 2 teaching days, but LAB is exempt from clustering
    // (keeps the spread rule), so the ideal never affects these LAB fixtures.
    private static final PlannableSubject PHYSICS_LAB = subject(3, "PHY201L", "LAB", 1L, 6);

    // 1. One session → 0 distribution penalty.
    @Test
    void singleSession_hasNoImpact() {
        constraintVerifier.verifyThat(TimetableConstraintProvider::subjectDistribution)
            .given(
                teachingLesson(1, 1, MATH, mon(2)),
                mon(2))
            .hasNoImpact();
    }

    // 2. The whole week clustered onto one day, back-to-back → ideal → 0.
    @Test
    void allSessionsOnOneDay_consecutive_hasNoImpact() {
        constraintVerifier.verifyThat(TimetableConstraintProvider::subjectDistribution)
            .given(
                teachingLesson(1, 1, MATH, mon(1)),
                teachingLesson(2, 1, MATH, mon(2)),
                teachingLesson(3, 1, MATH, mon(3)),
                teachingLesson(4, 1, MATH, mon(4)),
                teachingLesson(5, 1, MATH, mon(5)),
                mon(1), mon(2), mon(3), mon(4), mon(5))
            .hasNoImpact();
    }

    // 3. Sessions split over MORE days than ideal → EXTRA_THEORY_DAY_WEIGHT per
    // extra day (dominates gap penalties, so fewer days always wins).
    @Test
    void extraTeachingDays_penalizeByDaysBeyondIdeal() {
        // Two days for a 5-hour subject → 1 extra day × 5.
        constraintVerifier.verifyThat(TimetableConstraintProvider::subjectDistribution)
            .given(
                teachingLesson(1, 1, MATH, mon(1)),
                teachingLesson(2, 1, MATH, mon(2)),
                teachingLesson(3, 1, MATH, tue(1)),
                mon(1), mon(2), tue(1))
            .penalizesBy(TimetableConstraintProvider.EXTRA_THEORY_DAY_WEIGHT);

        // Five days for a 5-hour subject → 4 extra days × 5.
        constraintVerifier.verifyThat(TimetableConstraintProvider::subjectDistribution)
            .given(
                teachingLesson(1, 1, MATH, mon(1)),
                teachingLesson(2, 1, MATH, tue(1)),
                teachingLesson(3, 1, MATH, wed(1)),
                teachingLesson(4, 1, MATH, thu(1)),
                teachingLesson(5, 1, MATH, fri(1)),
                mon(1), tue(1), wed(1), thu(1), fri(1))
            .penalizesBy(4 * TimetableConstraintProvider.EXTRA_THEORY_DAY_WEIGHT);
    }

    // 4. Same-day sessions that are NOT back-to-back cost one point per gap.
    @Test
    void sameDaySplitSessions_penalizePerGap() {
        constraintVerifier.verifyThat(TimetableConstraintProvider::subjectDistribution)
            .given(
                teachingLesson(1, 1, MATH, mon(1)),
                teachingLesson(2, 1, MATH, mon(3)),
                teachingLesson(3, 1, MATH, mon(5)),
                mon(1), mon(3), mon(5))
            .penalizesBy(2);
    }

    // 5. Back-to-back same-day sessions outscore the same sessions split apart.
    @Test
    void backToBack_outScoresSplitSameDay() {
        HardSoftScore backToBack = constraintVerifier.verifyThat()
            .given(
                teachingLesson(1, 1, MATH, mon(1)),
                teachingLesson(2, 1, MATH, mon(2)),
                teachingLesson(3, 1, MATH, mon(3)),
                mon(1), mon(2), mon(3))
            .getScore();

        HardSoftScore split = constraintVerifier.verifyThat()
            .given(
                teachingLesson(1, 1, MATH, mon(1)),
                teachingLesson(2, 1, MATH, mon(3)),
                teachingLesson(3, 1, MATH, mon(5)),
                mon(1), mon(3), mon(5))
            .getScore();

        assertEquals(HardSoftScore.of(0, 0), backToBack);
        assertEquals(HardSoftScore.of(0, -2), split);
        assertTrue(backToBack.compareTo(split) > 0,
            "back-to-back sessions on one day must outscore the same sessions split apart");
    }

    // 6. Different subjects on the same day → no impact.
    @Test
    void differentSubjectsSameDay_noImpact() {
        constraintVerifier.verifyThat(TimetableConstraintProvider::subjectDistribution)
            .given(
                teachingLesson(1, 1, MATH, mon(1)),
                teachingLesson(2, 1, PHYSICS, mon(2)),
                mon(1), mon(2))
            .hasNoImpact();
    }

    // 7. LAB keeps the original spread rule: two complete blocks on one day are
    // a two-session day (one point); one block on each of two days is free. Labs
    // are never rewarded for clustering, so size-1 sessions stay separate runs.
    @Test
    void labBlocks_keepOriginalSpreadSemantics() {
        // Two complete 3-period lab blocks on the SAME day → 2 sessions on one
        // day → 1 point.
        constraintVerifier.verifyThat(TimetableConstraintProvider::subjectDistribution)
            .given(
                labLesson(1, 1, mon(1)),
                labLesson(2, 1, mon(2)),
                labLesson(3, 1, mon(3)),
                labLesson(4, 1, mon(5)),
                labLesson(5, 1, mon(6)),
                labLesson(6, 1, mon(7)),
                mon(1), mon(2), mon(3), mon(5), mon(6), mon(7))
            .penalizesBy(1);

        // The same 6 hours split across two days (one block per day) → clean
        // spread → 0.
        constraintVerifier.verifyThat(TimetableConstraintProvider::subjectDistribution)
            .given(
                labLesson(1, 1, mon(1)),
                labLesson(2, 1, mon(2)),
                labLesson(3, 1, mon(3)),
                labLesson(4, 1, tue(1)),
                labLesson(5, 1, tue(2)),
                labLesson(6, 1, tue(3)),
                mon(1), mon(2), mon(3), tue(1), tue(2), tue(3))
            .hasNoImpact();
    }

    // 8. An unassigned lesson creates no additional distribution penalty.
    @Test
    void unassignedLesson_doesNotAddPenalty() {
        // Two placed sessions on two days = 1 extra day (× 5) for a 5-hour
        // subject; the unassigned lesson (no window) adds nothing on top.
        constraintVerifier.verifyThat(TimetableConstraintProvider::subjectDistribution)
            .given(
                teachingLesson(1, 1, MATH, mon(1)),
                teachingLesson(2, 1, MATH, tue(1)),
                unassignedLesson(3, 1, MATH),
                mon(1), tue(1))
            .penalizesBy(TimetableConstraintProvider.EXTRA_THEORY_DAY_WEIGHT);
    }

    // 9. Hard score remains unaffected by the subject-distribution penalty.
    @Test
    void hardScore_remainsUnaffected() {
        HardSoftScore full = constraintVerifier.verifyThat()
            .given(
                teachingLesson(1, 1, MATH, mon(1)),
                teachingLesson(2, 1, MATH, tue(1)),
                teachingLesson(3, 1, MATH, wed(1)),
                teachingLesson(4, 1, MATH, thu(1)),
                mon(1), tue(1), wed(1), thu(1))
            .getScore();

        assertEquals(HardSoftScore.of(0, -3 * TimetableConstraintProvider.EXTRA_THEORY_DAY_WEIGHT), full);
    }

    // 10. Explicit score-direction comparison: a clustered schedule (one day of
    // back-to-back sessions) always outscores the same sessions scattered
    // across days.
    @Test
    void scoreDirection_clusteredOutscoresScattered() {
        // Schedule A: one MATH session on each of four days → (4 - 1) × 5 = 15.
        HardSoftScore scattered = constraintVerifier.verifyThat()
            .given(
                teachingLesson(1, 1, MATH, mon(1)),
                teachingLesson(2, 1, MATH, tue(1)),
                teachingLesson(3, 1, MATH, wed(1)),
                teachingLesson(4, 1, MATH, thu(1)),
                mon(1), tue(1), wed(1), thu(1))
            .getScore();

        // Schedule B: the same four sessions back-to-back on one day → 0.
        HardSoftScore clustered = constraintVerifier.verifyThat()
            .given(
                teachingLesson(1, 1, MATH, mon(1)),
                teachingLesson(2, 1, MATH, mon(2)),
                teachingLesson(3, 1, MATH, mon(3)),
                teachingLesson(4, 1, MATH, mon(4)),
                mon(1), mon(2), mon(3), mon(4))
            .getScore();

        assertEquals(HardSoftScore.of(0, -3 * TimetableConstraintProvider.EXTRA_THEORY_DAY_WEIGHT), scattered);
        assertEquals(HardSoftScore.of(0, 0), clustered);
        assertTrue(clustered.compareTo(scattered) > 0,
            "a clustered schedule must outscore the same sessions scattered across days");
    }

    // ── helpers ────────────────────────────────────────────────────────────

    private static PlannableTimeSlot mon(int order) {
        return window(order, "MON", order);
    }

    private static PlannableTimeSlot tue(int order) {
        return window(100 + order, "TUE", order);
    }

    private static PlannableTimeSlot wed(int order) {
        return window(200 + order, "WED", order);
    }

    private static PlannableTimeSlot thu(int order) {
        return window(300 + order, "THU", order);
    }

    private static PlannableTimeSlot fri(int order) {
        return window(400 + order, "FRI", order);
    }

    private static PlanningLesson teachingLesson(long id, long sectionId, PlannableSubject subject,
            PlannableTimeSlot timeSlot) {
        return ConstraintTestFixtures.lesson(id, sectionId, PROF, subject, room(1), timeSlot);
    }

    private static PlanningLesson labLesson(long id, long sectionId, PlannableTimeSlot timeSlot) {
        return ConstraintTestFixtures.lesson(id, sectionId, PROF, PHYSICS_LAB, room(5, "LAB", 60), timeSlot);
    }

    private static PlanningLesson unassignedLesson(long id, long sectionId, PlannableSubject subject) {
        return ConstraintTestFixtures.lesson(id, sectionId, PROF, subject, null, null);
    }
}
