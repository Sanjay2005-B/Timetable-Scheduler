package com.erp.timetable.module.timetable.engine.shared;

import com.erp.timetable.module.subject.entity.Subject;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for {@link SubjectDemandService} — verifies the weekly theory
 * distribution plan spreads single-period subjects across distinct days.
 */
class SubjectDemandServiceTest {

    private SubjectDemandService service;

    @BeforeEach
    void setUp() {
        service = new SubjectDemandService();
    }

    private Subject theorySubject(long id, int theoryHours, int blockSize) {
        Subject s = Subject.builder()
            .id(id)
            .subjectCode("SUBJ" + id)
            .subjectName("Subject " + id)
            .subjectType("THEORY")
            .theoryHours(theoryHours)
            .practicalHours(0)
            .build();
        s.setSessionBlockSize(blockSize);
        return s;
    }

    private Map<String, Integer> fullDayCapacity() {
        Map<String, Integer> cap = new HashMap<>();
        for (String day : SubjectDemandService.WORKING_DAYS) {
            cap.put(day, 7);
        }
        return cap;
    }

    private Map<Long, Map<String, Integer>> emptyFacultyDayCapacity(List<Subject> subjects) {
        Map<Long, Map<String, Integer>> map = new HashMap<>();
        for (Subject s : subjects) {
            Map<String, Integer> dayCap = new HashMap<>();
            for (String day : SubjectDemandService.WORKING_DAYS) {
                dayCap.put(day, 5);
            }
            map.put(s.getId(), dayCap);
        }
        return map;
    }

    // ──────────────────────────────────────────────────────────────────────
    // blockSize=1: H periods → H distinct days, 1 period each
    // ──────────────────────────────────────────────────────────────────────

    @Test
    void blockSize1_H5_spreadsAcross5DistinctDays() {
        Subject english = theorySubject(1, 5, 1);
        List<Subject> subjects = List.of(english);
        Map<Long, Integer> hours = Map.of(1L, 5);

        Map<Long, List<SubjectDemandService.DistributionEntry>> plan =
            service.buildTheoryDistributionPlan(
                subjects, hours, Map.of(), fullDayCapacity(), emptyFacultyDayCapacity(subjects));

        List<SubjectDemandService.DistributionEntry> entries = plan.get(1L);
        assertNotNull(entries);
        assertEquals(5, entries.size(), "must produce 5 sessions: " + entries);

        Set<String> days = new HashSet<>();
        for (SubjectDemandService.DistributionEntry e : entries) {
            assertEquals(1, e.blockSize(), "each session must be size 1: " + e);
            days.add(e.day());
        }
        assertEquals(5, days.size(),
            "5 periods with blockSize=1 must land on 5 distinct days: " + entries);
    }

    @Test
    void blockSize1_H3_spreadsAcross3DistinctDays() {
        Subject physics = theorySubject(2, 3, 1);
        List<Subject> subjects = List.of(physics);
        Map<Long, Integer> hours = Map.of(2L, 3);

        Map<Long, List<SubjectDemandService.DistributionEntry>> plan =
            service.buildTheoryDistributionPlan(
                subjects, hours, Map.of(), fullDayCapacity(), emptyFacultyDayCapacity(subjects));

        List<SubjectDemandService.DistributionEntry> entries = plan.get(2L);
        assertNotNull(entries);
        assertEquals(3, entries.size());

        Set<String> days = new HashSet<>();
        for (SubjectDemandService.DistributionEntry e : entries) {
            assertEquals(1, e.blockSize());
            days.add(e.day());
        }
        assertEquals(3, days.size(),
            "3 periods with blockSize=1 must land on 3 distinct days: " + entries);
    }

    @Test
    void blockSize1_H6_spreadsAcross6DistinctDays() {
        Subject maths = theorySubject(3, 6, 1);
        List<Subject> subjects = List.of(maths);
        Map<Long, Integer> hours = Map.of(3L, 6);

        Map<Long, List<SubjectDemandService.DistributionEntry>> plan =
            service.buildTheoryDistributionPlan(
                subjects, hours, Map.of(), fullDayCapacity(), emptyFacultyDayCapacity(subjects));

        List<SubjectDemandService.DistributionEntry> entries = plan.get(3L);
        assertNotNull(entries);
        assertEquals(6, entries.size());

        Set<String> days = new HashSet<>();
        for (SubjectDemandService.DistributionEntry e : entries) {
            assertEquals(1, e.blockSize());
            days.add(e.day());
        }
        assertEquals(6, days.size(),
            "6 periods with blockSize=1 must land on 6 distinct days: " + entries);
    }

    @Test
    void blockSize1_H4_spreadsAcross4DistinctDays() {
        Subject tamil = theorySubject(4, 4, 1);
        List<Subject> subjects = List.of(tamil);
        Map<Long, Integer> hours = Map.of(4L, 4);

        Map<Long, List<SubjectDemandService.DistributionEntry>> plan =
            service.buildTheoryDistributionPlan(
                subjects, hours, Map.of(), fullDayCapacity(), emptyFacultyDayCapacity(subjects));

        List<SubjectDemandService.DistributionEntry> entries = plan.get(4L);
        assertNotNull(entries);
        assertEquals(4, entries.size());

        Set<String> days = new HashSet<>();
        for (SubjectDemandService.DistributionEntry e : entries) {
            assertEquals(1, e.blockSize());
            days.add(e.day());
        }
        assertEquals(4, days.size(),
            "4 periods with blockSize=1 must land on 4 distinct days: " + entries);
    }

    // ──────────────────────────────────────────────────────────────────────
    // Multiple blockSize=1 subjects: each gets distinct days, plans don't
    // pile up on the same days (least-loaded assignment).
    // ──────────────────────────────────────────────────────────────────────

    @Test
    void multipleBlocksize1Subjects_eachSpreadsAcrossDistinctDays() {
        Subject english = theorySubject(1, 5, 1);
        Subject tamil   = theorySubject(2, 5, 1);
        Subject c       = theorySubject(3, 5, 1);
        List<Subject> subjects = List.of(english, tamil, c);
        Map<Long, Integer> hours = Map.of(1L, 5, 2L, 5, 3L, 5);

        Map<Long, List<SubjectDemandService.DistributionEntry>> plan =
            service.buildTheoryDistributionPlan(
                subjects, hours, Map.of(), fullDayCapacity(), emptyFacultyDayCapacity(subjects));

        for (Subject s : subjects) {
            List<SubjectDemandService.DistributionEntry> entries = plan.get(s.getId());
            assertNotNull(entries);
            assertEquals(5, entries.size(), s.getSubjectCode() + " must have 5 sessions");

            Set<String> days = new HashSet<>();
            for (SubjectDemandService.DistributionEntry e : entries) {
                assertEquals(1, e.blockSize(), s.getSubjectCode() + " each session must be size 1");
                days.add(e.day());
            }
            assertEquals(5, days.size(),
                s.getSubjectCode() + " must spread across 5 distinct days: " + entries);
        }

        // Verify the three subjects don't ALL plan for the same days.
        // Each subject uses least-loaded assignment, so their day sets differ.
        Set<String> days1 = new HashSet<>();
        Set<String> days2 = new HashSet<>();
        for (SubjectDemandService.DistributionEntry e : plan.get(1L)) days1.add(e.day());
        for (SubjectDemandService.DistributionEntry e : plan.get(2L)) days2.add(e.day());
        // At least some days should differ between subjects
        Set<String> intersection = new HashSet<>(days1);
        intersection.retainAll(days2);
        assertTrue(intersection.size() < 5,
            "two subjects should not share all 5 planned days");
    }

    // ──────────────────────────────────────────────────────────────────────
    // blockSize=2: H=8 → mix of double and single sessions across 5 days
    // ──────────────────────────────────────────────────────────────────────

    @Test
    void blockSize2_H8_distributesAcross5Days() {
        Subject maths = theorySubject(1, 8, 2);
        List<Subject> subjects = List.of(maths);
        Map<Long, Integer> hours = Map.of(1L, 8);

        Map<Long, List<SubjectDemandService.DistributionEntry>> plan =
            service.buildTheoryDistributionPlan(
                subjects, hours, Map.of(), fullDayCapacity(), emptyFacultyDayCapacity(subjects));

        List<SubjectDemandService.DistributionEntry> entries = plan.get(1L);
        assertNotNull(entries);

        int totalPeriods = entries.stream().mapToInt(SubjectDemandService.DistributionEntry::blockSize).sum();
        assertEquals(8, totalPeriods, "total periods must equal weekly hours: " + entries);

        Set<String> days = new HashSet<>();
        for (SubjectDemandService.DistributionEntry e : entries) {
            assertTrue(e.blockSize() == 1 || e.blockSize() == 2,
                "blockSize=2 sessions must be size 1 or 2: " + e);
            days.add(e.day());
        }
        assertEquals(5, days.size(),
            "8 periods with blockSize=2 should spread across 5 days: " + entries);

        long doubleSessions = entries.stream().filter(e -> e.blockSize() == 2).count();
        long singleSessions = entries.stream().filter(e -> e.blockSize() == 1).count();
        assertEquals(3, doubleSessions, "must have 3 double-period sessions");
        assertEquals(2, singleSessions, "must have 2 single-period sessions");
    }

    // ──────────────────────────────────────────────────────────────────────
    // getSessionBlockSize returns 1 for blockSize=1 subjects
    // ──────────────────────────────────────────────────────────────────────

    @Test
    void getSessionBlockSize_returns1_forSinglePeriodSubject() {
        Subject subject = theorySubject(1, 5, 1);
        assertEquals(1, service.getSessionBlockSize(subject));
    }

    @Test
    void getSessionBlockSize_returns2_forDoublePeriodSubject() {
        Subject subject = theorySubject(1, 8, 2);
        assertEquals(2, service.getSessionBlockSize(subject));
    }

    @Test
    void getSessionBlockSize_clamps3to2() {
        Subject subject = theorySubject(1, 8, 3);
        assertEquals(2, service.getSessionBlockSize(subject));
    }

    @Test
    void getSessionBlockSize_defaultsTo1_whenNull() {
        Subject subject = theorySubject(1, 5, 1);
        subject.setSessionBlockSize(null);
        assertEquals(1, service.getSessionBlockSize(subject));
    }

    // ──────────────────────────────────────────────────────────────────────
    // Edge cases
    // ──────────────────────────────────────────────────────────────────────

    @Test
    void zeroWeeklyHours_producesEmptyPlan() {
        Subject subject = theorySubject(1, 0, 1);
        List<Subject> subjects = List.of(subject);
        Map<Long, Integer> hours = Map.of(1L, 0);

        Map<Long, List<SubjectDemandService.DistributionEntry>> plan =
            service.buildTheoryDistributionPlan(
                subjects, hours, Map.of(), fullDayCapacity(), emptyFacultyDayCapacity(subjects));

        assertTrue(plan.get(1L).isEmpty());
    }

    @Test
    void singlePeriod_producesOneSession() {
        Subject subject = theorySubject(1, 1, 1);
        List<Subject> subjects = List.of(subject);
        Map<Long, Integer> hours = Map.of(1L, 1);

        Map<Long, List<SubjectDemandService.DistributionEntry>> plan =
            service.buildTheoryDistributionPlan(
                subjects, hours, Map.of(), fullDayCapacity(), emptyFacultyDayCapacity(subjects));

        List<SubjectDemandService.DistributionEntry> entries = plan.get(1L);
        assertEquals(1, entries.size());
        assertEquals(1, entries.get(0).blockSize());
    }
}
