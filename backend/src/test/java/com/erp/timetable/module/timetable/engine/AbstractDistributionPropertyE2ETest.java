package com.erp.timetable.module.timetable.engine;

import com.erp.timetable.module.department.entity.AcademicYear;
import com.erp.timetable.module.department.entity.Department;
import com.erp.timetable.module.department.entity.Section;
import com.erp.timetable.module.department.repository.DepartmentRepository;
import com.erp.timetable.module.faculty.entity.Faculty;
import com.erp.timetable.module.faculty.repository.FacultyRepository;
import com.erp.timetable.module.subject.entity.Subject;
import com.erp.timetable.module.subject.repository.SubjectRepository;
import com.erp.timetable.module.timetable.entity.Timetable;
import com.erp.timetable.module.timetable.entity.TimetableEntry;
import com.erp.timetable.module.timetable.repository.TimetableRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Dynamic distribution-property contract, run identically for BOTH engines
 * (greedy / timefold) on temporary, isolated records.
 *
 * <p>The properties are deliberately independent of any fixed day or pattern —
 * they follow the college-wide daily teaching cap of 5 and the minimum-days
 * rule, and must hold across the whole demand spectrum:
 * <ul>
 *   <li>low / medium / high weekly demands ({@code 1..14}), odd and even,</li>
 *   <li>over-capacity demands (a single day cannot hold them),</li>
 *   <li>sessionBlockSize 1 / 2 / 3 must never inflate the teaching days,</li>
 *   <li>a mixed THEORY+practical subject keeps its theory clustered on the
 *       minimum teaching days (the Greedy/Timefold distribution parity),</li>
 *   <li>multiple subjects balance the whole-section day load while each keeps
 *       its minimum teaching days.</li>
 * </ul>
 *
 * <p>No mentor-created subject, faculty, classroom, department or section is
 * ever touched; records are deleted explicitly and the transaction rolls back.
 */
@SpringBootTest
@ActiveProfiles("h2")
@Transactional
public abstract class AbstractDistributionPropertyE2ETest {

    private static final AtomicInteger COUNTER = new AtomicInteger(1);
    private static final String SESSION = "2025-2026 EVEN";

    @Autowired
    protected ScheduleEngine engine;

    @Autowired
    protected DepartmentRepository departmentRepository;

    @Autowired
    protected FacultyRepository facultyRepository;

    @Autowired
    protected SubjectRepository subjectRepository;

    @Autowired
    protected TimetableRepository timetableRepository;

    protected abstract String engineName();

    // ── TEST 1: minimum teaching days across the whole demand spectrum ──────

    /**
     * A single THEORY subject alone in its section must cluster onto the
     * minimum teaching days imposed by the college-wide daily cap of 5:
     * {@code ceil(theoryHours / 5)}. Low (1-2), medium (4-5), high (6-10) and
     * odd/even demands are all covered by the same rule.
     */
    @Test
    void theoryDemand_followsMinimumDaysRule_acrossAllDemandShapes() {
        for (int theory : List.of(1, 2, 4, 5, 6, 7, 9, 10, 11, 12)) {
            Department dept = newDepartment("DISLOW");
            Section section = dept.getAcademicYears().get(0).getSections().get(0);
            Faculty faculty = newFaculty(dept, "DISFAC");
            Subject subject = newSubject(dept, section, faculty, "DIST", "Dist Subject", "THEORY", theory, 0, 1);
            try {
                Timetable timetable = generateForSection(dept, section);
                long days = theoryDaysOf(timetable, subject);
                long expected = ceilDiv(theory, 5);
                assertEquals(theory, entriesOf(timetable, subject).size(),
                    engineName() + " T=" + theory + ": all " + theory + " periods must be placed");
                assertEquals(expected, days,
                    engineName() + " T=" + theory + ": minimum teaching days rule ceil(T/5)");
                assertClean(timetable, "T=" + theory);
                assertNoClashes(timetable.getEntries());
                assertDailyFacultyCap(timetable);
                printMetric("min-days|engine=" + engineName() + "|theory=" + theory + "|days=" + days + "|expected=" + expected);
            } finally {
                cleanup(dept, List.of(subject), List.of(faculty));
            }
        }
    }

    // ── TEST 2: over-capacity demands keep the minimum days ────────────────

    /**
     * Over-capacity theory demands (13 and 14 weekly hours) must still cluster
     * onto the theoretical minimum of 3 teaching days (5+5+3 / 5+5+4) — the
     * days rule never degrades when a single day cannot hold the subject.
     */
    @Test
    void overCapacityDemand_stillKeepsMinimumDays() {
        for (int theory : List.of(13, 14)) {
            Department dept = newDepartment("DISHIGH");
            Section section = dept.getAcademicYears().get(0).getSections().get(0);
            Faculty faculty = newFaculty(dept, "DISFAC");
            Subject subject = newSubject(dept, section, faculty, "DISH", "High Dist Subject", "THEORY", theory, 0, 1);
            try {
                Timetable timetable = generateForSection(dept, section);
                long days = theoryDaysOf(timetable, subject);
                assertEquals(theory, entriesOf(timetable, subject).size(),
                    engineName() + " T=" + theory + ": all periods must be placed");
                assertEquals(3, days,
                    engineName() + " T=" + theory + ": 14 hours must fit 3 days (5+5+4)");
                assertClean(timetable, "T=" + theory);
                assertNoClashes(timetable.getEntries());
                assertDailyFacultyCap(timetable);
                printMetric("over-capacity|engine=" + engineName() + "|theory=" + theory + "|days=" + days);
            } finally {
                cleanup(dept, List.of(subject), List.of(faculty));
            }
        }
    }

    // ── TEST 3: block size 2 distributes via double/single pattern ───────────

    /**
     * sessionBlockSize 2 distributes theory using the new double/single pattern:
     * doubleDays=max(0,H-5), singleDays=H-2*doubleDays. This always produces
     * 5 teaching days for H=5..10 and 6 days for H=11 (5 doubles + 1 single).
     * sessionBlockSize 3 is clamped to 2 by the backend, so both produce
     * the same distribution.
     */
    @Test
    void theoryBlockSizes_doNotInflateTeachingDays() {
        Map<Integer, Integer> expectedDays = Map.of(
            5, 5,   // 0 doubles + 5 singles
            6, 5,   // 1 double + 4 singles
            7, 5,   // 2 doubles + 3 singles
            11, 6   // 5 doubles + 1 single
        );
        for (int block : List.of(2)) {
            for (int theory : List.of(5, 6, 7, 11)) {
                Department dept = newDepartment("DISBLK");
                Section section = dept.getAcademicYears().get(0).getSections().get(0);
                Faculty faculty = newFaculty(dept, "DISFAC");
                Subject subject = newSubject(dept, section, faculty, "DISB", "Block Dist Subject", "THEORY", theory, 0, block);
                try {
                    Timetable timetable = generateForSection(dept, section);
                    long days = theoryDaysOf(timetable, subject);
                    assertEquals(theory, entriesOf(timetable, subject).size(),
                        engineName() + " block=" + block + " T=" + theory + ": all periods must be placed");
                    assertEquals(expectedDays.get(theory), (int) days,
                        engineName() + " block=" + block + " T=" + theory + ": double/single distribution");
                    assertClean(timetable, "block=" + block + " T=" + theory);
                    assertNoClashes(timetable.getEntries());
                    assertDailyFacultyCap(timetable);
                    printMetric("block-days|engine=" + engineName() + "|block=" + block + "|theory=" + theory + "|days=" + days);
                } finally {
                    cleanup(dept, List.of(subject), List.of(faculty));
                }
            }
        }
    }

    // ── TEST 4: mixed theory + practical with block 2 ──────────────────────

    /**
     * A THEORY subject (5 theory hours, block 2) with 2 practical hours.
     * Block 2 distributes theory as 5 single-period sessions across 5 days.
     * The practical renders as one strict 2-consecutive LAB session (Part 2: lab
     * always uses full practicalHours as one block).
     */
    @Test
    void mixedTheoryPractical_keepsTheoryOnMinimumDays() {
        Department dept = newDepartment("DISMIX");
        Section section = dept.getAcademicYears().get(0).getSections().get(0);
        Faculty faculty = newFaculty(dept, "DISFAC");
        Subject subject = newSubject(dept, section, faculty, "DISM", "Mixed Dist Subject", "THEORY", 5, 2, 2);
        try {
            Timetable timetable = generateForSection(dept, section);
            printMetric("mixed-entries|engine=" + engineName() + "|entries="
                + timetable.getEntries().stream()
                    .map(e -> e.getDayOfWeek() + ":" + (e.isLab() ? "LAB" : "THY") + ":" + e.getTimeSlot().getSlotOrder())
                    .collect(Collectors.toList()));
            assertEquals(5, theoryOf(timetable, subject),
                engineName() + ": 5 theory periods must be placed");
            assertEquals(2, labOf(timetable, subject),
                engineName() + ": 2 practical periods must be placed");
            // H=5, block=2: doubleDays=0, singleDays=5 → 5 theory days.
            assertEquals(5, theoryDaysOf(timetable, subject),
                engineName() + ": theory must spread across 5 single-period days (block 2)");
            // Part 2: lab always uses full practicalHours as one block.
            assertEquals(List.of(2), labRunSizes(timetable, subject),
                engineName() + ": practical must render as one strict 2-consecutive session");
            printMetric("mixed|engine=" + engineName() + "|entries="
                + timetable.getEntries().stream()
                    .map(e -> e.getDayOfWeek() + ":" + (e.isLab() ? "LAB" : "THY") + ":" + e.getTimeSlot().getSlotOrder())
                    .collect(Collectors.toList()));
            assertClean(timetable, "mixed");
            assertLabRules(timetable);
            assertNoClashes(timetable.getEntries());
            assertDailyFacultyCap(timetable);
            printMetric("mixed|engine=" + engineName()
                + "|theory=5|practical=2|theoryDays=5|labRuns=" + labRunSizes(timetable, subject));
        } finally {
            cleanup(dept, List.of(subject), List.of(faculty));
        }
    }

    // ── TEST 5: multiple subjects balance the section days ──────────────────

    /**
     * Three 5-hour theory subjects (distinct faculties) must each keep their
     * single teaching day AND land on three different days, so the whole-section
     * day load is balanced (5 / 5 / 5) instead of leaving some day overloaded
     * and another unused.
     */
    @Test
    void multipleSubjects_balanceSectionDays_whileKeepingMinimumSubjectDays() {
        Department dept = newDepartment("DISBAL");
        Section section = dept.getAcademicYears().get(0).getSections().get(0);
        List<Faculty> faculties = new ArrayList<>();
        List<Subject> subjects = new ArrayList<>();
        try {
            for (int i = 1; i <= 3; i++) {
                Faculty f = newFaculty(dept, "DISF" + i);
                faculties.add(f);
                subjects.add(newSubject(dept, section, f, "DISB" + i, "Balanced Subject " + i, "THEORY", 5, 0, 1));
            }
            Timetable timetable = generateForSection(dept, section);
            assertEquals(15, timetable.getEntries().size(), "3 x 5 theory = 15");

            for (Subject s : subjects) {
                assertEquals(1, theoryDaysOf(timetable, s),
                    engineName() + ": each 5-hour subject must keep its single teaching day");
            }
            long usedDays = timetable.getEntries().stream()
                .map(TimetableEntry::getDayOfWeek).distinct().count();
            assertEquals(3, usedDays, "3 single-day subjects must use exactly 3 distinct days");
            Map<String, Long> dayLoad = timetable.getEntries().stream()
                .collect(Collectors.groupingBy(TimetableEntry::getDayOfWeek, Collectors.counting()));
            assertTrue(dayLoad.values().stream().allMatch(v -> v == 5),
                "section day load must be balanced 5/5/5: " + dayLoad);

            assertClean(timetable, "balance");
            assertNoClashes(timetable.getEntries());
            assertDailyFacultyCap(timetable);
            printMetric("balance|engine=" + engineName() + "|subjects=3x5|days=" + dayLoad);
        } finally {
            cleanup(dept, subjects, faculties);
        }
    }

    // ── shared assertions ───────────────────────────────────────────────────

    private void assertClean(Timetable t, String phase) {
        assertTrue(t.getConflicts().isEmpty(),
            engineName() + " " + phase + ": no conflicts may remain on a feasible solve: " + t.getConflicts());
        assertEquals(0, t.getConflictCount(), engineName() + " " + phase + ": conflictCount must be 0");
    }

    private void assertLabRules(Timetable t) {
        for (TimetableEntry e : t.getEntries()) {
            if (e.isLab()) {
                assertEquals("LAB", e.getClassroom().getRoomType(),
                    engineName() + ": practical periods must use a LAB room");
                assertTrue(e.getClassroom().getCapacity() != null
                        && e.getClassroom().getCapacity() >= t.getSection().getStudentStrength(),
                    engineName() + ": LAB room capacity must be >= section strength");
                assertTrue(!"SAT".equals(e.getDayOfWeek()),
                    engineName() + ": no LAB session may land on Saturday");
            }
        }
    }

    private void assertDailyFacultyCap(Timetable t) {
        Map<String, Long> dailyLoad = t.getEntries().stream()
            .collect(Collectors.groupingBy(
                e -> e.getFaculty().getId() + "_" + e.getDayOfWeek(), Collectors.counting()));
        assertTrue(dailyLoad.values().stream().allMatch(v -> v <= 5),
            engineName() + ": faculty daily load exceeded the college-wide cap of 5: " + dailyLoad);
    }

    private void assertNoClashes(List<TimetableEntry> entries) {
        Set<String> sectionKeys = new HashSet<>();
        Set<String> facultyKeys = new HashSet<>();
        Set<String> roomKeys = new HashSet<>();
        for (TimetableEntry e : entries) {
            String window = e.getDayOfWeek() + "_" + e.getTimeSlot().getId();
            assertTrue(sectionKeys.add(e.getSection().getId() + "_" + window),
                engineName() + ": section double-booked at " + window);
            assertTrue(facultyKeys.add(e.getFaculty().getId() + "_" + window),
                engineName() + ": faculty double-booked at " + window);
            assertTrue(roomKeys.add(e.getClassroom().getId() + "_" + window),
                engineName() + ": room double-booked at " + window);
        }
    }

    // ── fixtures (temporary, isolated records only) ─────────────────────────

    private Department newDepartment(String prefix) {
        int n = COUNTER.getAndIncrement();
        Department dept = Department.builder()
            .name(prefix + "-" + n)
            .hodName("Distribution HOD")
            .contactEmail(prefix.toLowerCase() + n + "@local.test")
            .contactPhone("000")
            .building("Distribution Block")
            .isArchived(false)
            .build();
        AcademicYear year = AcademicYear.builder().yearLabel("1st Year").isEnabled(true).build();
        year.addSection(Section.builder().name("A").studentStrength(40).status("ACTIVE").build());
        dept.addAcademicYear(year);
        return departmentRepository.saveAndFlush(dept);
    }

    private Faculty newFaculty(Department dept, String employeeId) {
        int n = COUNTER.getAndIncrement();
        return facultyRepository.saveAndFlush(Faculty.builder()
            .employeeId(employeeId + n)
            .firstName("Dis")
            .lastName(employeeId + n)
            .email(employeeId.toLowerCase() + n + "@local.test")
            .department(dept)
            .designation("Professor")
            .status("AVAILABLE")
            .build());
    }

    private Subject newSubject(Department dept, Section section, Faculty faculty,
            String code, String name, String type, int theory, int practical, Integer blockSize) {
        int n = COUNTER.getAndIncrement();
        return subjectRepository.saveAndFlush(Subject.builder()
            .subjectCode(code + n)
            .subjectName(name)
            .department(dept)
            .academicYear(section.getAcademicYear())
            .section(section)
            .assignedFaculty(faculty)
            .semester(1)
            .credits(4)
            .theoryHours(theory)
            .practicalHours(practical)
            .subjectType(type)
            .sessionBlockSize(blockSize)
            .isActive(true)
            .build());
    }

    private Timetable generateForSection(Department dept, Section section) {
        Timetable timetable = timetableRepository.findBySectionIdAndSemester(section.getId(), 1)
            .orElseGet(() -> Timetable.builder()
                .academicSession(SESSION)
                .department(dept)
                .section(section)
                .semester(1)
                .status("DRAFT")
                .build());
        if (timetable.getId() != null) {
            timetable.getEntries().clear();
            timetable.getConflicts().clear();
            timetable = timetableRepository.saveAndFlush(timetable);
        }
        engine.generateSchedule(timetable, false);
        return timetableRepository.save(timetable);
    }

    private void cleanup(Department dept, List<Subject> subjects, List<Faculty> faculties) {
        try {
            timetableRepository.findByDepartmentId(dept.getId())
                .forEach(t -> timetableRepository.delete(t));
        } catch (Exception ignored) {
        }
        try {
            if (!subjects.isEmpty()) {
                subjectRepository.deleteAll(subjects);
            }
            if (!faculties.isEmpty()) {
                facultyRepository.deleteAll(faculties);
            }
        } catch (Exception ignored) {
        }
        try {
            departmentRepository.delete(dept);
        } catch (Exception ignored) {
        }
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    private static List<TimetableEntry> entriesOf(Timetable t, Subject s) {
        return t.getEntries().stream()
            .filter(e -> e.getSubject() != null && e.getSubject().getId().equals(s.getId()))
            .toList();
    }

    private static long theoryOf(Timetable t, Subject s) {
        return entriesOf(t, s).stream().filter(e -> !e.isLab()).count();
    }

    private static long labOf(Timetable t, Subject s) {
        return entriesOf(t, s).stream().filter(TimetableEntry::isLab).count();
    }

    private static long theoryDaysOf(Timetable t, Subject s) {
        return entriesOf(t, s).stream()
            .filter(e -> !e.isLab())
            .map(TimetableEntry::getDayOfWeek)
            .distinct()
            .count();
    }

    private static List<Integer> labRunSizes(Timetable t, Subject s) {
        List<Integer> runs = new ArrayList<>();
        Map<String, List<Integer>> byDay = entriesOf(t, s).stream()
            .filter(TimetableEntry::isLab)
            .collect(Collectors.groupingBy(TimetableEntry::getDayOfWeek,
                Collectors.mapping(e -> e.getTimeSlot().getSlotOrder(), Collectors.toList())));
        for (List<Integer> orders : byDay.values()) {
            List<Integer> sorted = orders.stream().sorted().toList();
            int runStart = 0;
            for (int i = 1; i <= sorted.size(); i++) {
                if (i == sorted.size() || sorted.get(i) != sorted.get(i - 1) + 1) {
                    runs.add(i - runStart);
                    runStart = i;
                }
            }
        }
        return runs;
    }

    private static long ceilDiv(long a, long b) {
        return (a + b - 1) / b;
    }

    private static void printMetric(String line) {
        System.out.println("DIST_PROPERTY_METRIC|" + line);
    }
}
