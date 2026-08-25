package com.erp.timetable.module.timetable.engine;

import com.erp.timetable.module.availability.entity.FacultyAvailability;
import com.erp.timetable.module.availability.entity.TimeSlot;
import com.erp.timetable.module.availability.repository.FacultyAvailabilityRepository;
import com.erp.timetable.module.availability.repository.TimeSlotRepository;
import com.erp.timetable.module.classroom.entity.Classroom;
import com.erp.timetable.module.classroom.repository.ClassroomRepository;
import com.erp.timetable.module.faculty.entity.Faculty;
import com.erp.timetable.module.faculty.repository.FacultyRepository;
import com.erp.timetable.module.subject.entity.Subject;
import com.erp.timetable.module.timetable.engine.constraint.*;
import com.erp.timetable.module.timetable.engine.shared.ConflictRecorderService;
import com.erp.timetable.module.timetable.engine.shared.CurriculumDataLoader;
import com.erp.timetable.module.timetable.engine.shared.LockPreservationService;
import com.erp.timetable.module.timetable.engine.shared.ReportingService;
import com.erp.timetable.module.timetable.engine.shared.SubjectDemandService;
import com.erp.timetable.module.timetable.engine.shared.TimetableEntryMapper;
import com.erp.timetable.module.timetable.entity.Timetable;
import com.erp.timetable.module.timetable.entity.TimetableEntry;
import com.erp.timetable.module.timetable.repository.TimetableEntryRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.stream.Collectors;

/**
 * =====================================================================
 * PROFESSIONAL RULE-BASED SCHEDULING ENGINE
 * College ERP Timetable Generator — 15-Step Algorithm
 * =====================================================================
 *
 * This engine implements a deterministic, rule-based scheduling algorithm
 * that produces a real engineering college timetable.
 *
 * SCHEDULE STRUCTURE:
 *   - 6 working days: Monday to Saturday
 *   - 7 teaching periods per day (P1–P7, 50 min each)
 *   - 1 short break (15 min) after P2
 *   - 1 lunch break (1 hour) after P4
 *
 * HARD CONSTRAINTS (never violated):
 *   1. Faculty clash: one faculty → one class at any given slot
 *   2. Room clash: one room → one class at any given slot
 *   3. Faculty daily limit: max 5 teaching periods per day (own cap may bind lower)
 *   4. Lab: labs require N consecutive non-break periods and are never on Saturday
 *   5. Lab block: labs require exactly 3 consecutive non-break periods
 *   6. Room type: labs only in lab rooms; theory only in non-lab rooms
 *   7. Faculty availability: respect marked-blocked slots
 *   8. Section isolation: subjects for Section A never appear in Section B
 *
 * SOFT CONSTRAINTS (optimised):
 *   - Subjects balanced across all 6 days
 *   - Faculty workload balanced
 *   - No unnecessary free periods
 *   - No repeated subject blocks on the same day
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class TimetableGeneratorEngine {

    // ── Repositories ─────────────────────────────────────────────────────────
    private final TimeSlotRepository timeSlotRepository;
    private final FacultyRepository facultyRepository;
    private final ClassroomRepository classroomRepository;
    private final TimetableEntryRepository entryRepository;
    private final FacultyAvailabilityRepository availabilityRepository;

    // ── Shared Engine Services ────────────────────────────────────────────────
    private final CurriculumDataLoader curriculumDataLoader;
    private final SubjectDemandService subjectDemandService;
    private final LockPreservationService lockPreservationService;
    private final ConflictRecorderService conflictRecorderService;
    private final ReportingService reportingService;
    private final TimetableEntryMapper entryMapper;

    // ── Constraint Pipeline ───────────────────────────────────────────────────
    private final FacultyDailyHoursConstraint dailyHoursConstraint;
    private final LabConsecutiveBlockConstraint labBlockConstraint;
    private final FacultyAssignedSubjectConstraint assignedSubjectConstraint;
    private final DepartmentPermissionConstraint departmentPermissionConstraint;
    private final FacultyClashConstraint facultyClashConstraint;
    private final RoomClashConstraint roomClashConstraint;
    private final RoomTypeConstraint roomTypeConstraint;
    private final FacultyAvailabilityConstraint availabilityConstraint;
    private final FacultyWeeklyHoursConstraint weeklyHoursConstraint;
    private final ConsecutiveTeachingConstraint consecutiveTeachingConstraint;
    private final SectionClashConstraint sectionClashConstraint;

    // ── Constants ─────────────────────────────────────────────────────────────
    private static final List<String> WORKING_DAYS =
        List.of("MON", "TUE", "WED", "THU", "FRI", "SAT");

    // LAB sessions are NEVER scheduled on Saturday (college policy). Practical
    // placement and diagnostics iterate only these five days.
    private static final List<String> LAB_DAYS =
        List.of("MON", "TUE", "WED", "THU", "FRI");

    /**
     * Outcome of a single practical-block placement attempt. The declaration
     * order doubles as the diagnostic severity order (0 = most severe resource
     * shortage), so the caller reports the clearest cause across all candidate
     * faculty rather than the generic "all windows conflict" message.
     */
    private enum PracticalBlockResult {
        NO_LAB_ROOM,
        LAB_CAPACITY_INSUFFICIENT,
        NO_CONSECUTIVE_WINDOW,
        PLACED
    }

    /**
     * Seeded RNG for controlled shuffling of candidate orderings. Seed is
     * derived from the section + semester so the same input always produces
     * the same timetable (reproducible for tests) while different sections
     * or regeneration runs produce varied distributions.
     */
    private Random rng;

    // =====================================================================
    // PUBLIC API
    // =====================================================================

    public void generateSchedule(Timetable timetable) {
        generateSchedule(timetable, false);
    }

    /**
     * Main entry point. Executes the 15-step scheduling algorithm.
     *
     * @param timetable             the Timetable entity to populate
     * @param regenerateOnlyUnlocked if true, preserves locked entries and only
     *                              regenerates unlocked slots
     */
    public void generateSchedule(Timetable timetable, boolean regenerateOnlyUnlocked) {
        // Seed RNG per generation: section ID + semester + timestamp jitter for
        // controlled randomness.  Same section/semester produces the same
        // timetable (test-reproducible); different invocations get varied layouts.
        long sectionId = timetable.getSection() != null ? timetable.getSection().getId() : 0L;
        int semester = timetable.getSemester() != null ? timetable.getSemester() : 0;
        this.rng = new Random(sectionId * 31 + semester ^ System.nanoTime());

        log.info("═══════════════════════════════════════════════════════════════");
        log.info("  PROFESSIONAL SCHEDULING ENGINE — Starting Generation");
        log.info("  Department : {}", timetable.getDepartment() != null ? timetable.getDepartment().getName() : "N/A");
        log.info("  Section    : {}", timetable.getSection() != null ? timetable.getSection().getName() : "N/A");
        log.info("  Semester   : {}", timetable.getSemester());
        log.info("═══════════════════════════════════════════════════════════════");

        // ─────────────────────────────────────────────────────────────────────
        // STEP 1: Read all college resources
        // ─────────────────────────────────────────────────────────────────────
        log.info("STEP 1 ▶ Loading college resources...");

        // Subjects: MUST be filtered by section_id AND semester — not just department.
        // Without section filtering, subjects for Section B appear in Section A's timetable.
        List<Subject> subjects = curriculumDataLoader.loadSubjectsForTimetable(timetable);

        if (subjects.isEmpty()) {
            log.warn("⚠ No subjects found for section '{}' semester {}. Timetable generation aborted.",
                timetable.getSection() != null ? timetable.getSection().getName() : "?",
                timetable.getSemester());
            conflictRecorderService.addConflict(timetable, "MISSING_CURRICULUM",
                "No subjects found for section '"
                    + (timetable.getSection() != null ? timetable.getSection().getName() : "?")
                    + "' semester " + timetable.getSemester()
                    + ". Please assign subjects to this section before generating.",
                "HIGH");
            timetable.setStatus("GENERATED");
            timetable.setConflictCount(1);
            timetable.setOptimizationScore(0);
            return;
        }

        // ─────────────────────────────────────────────────────────────────────
        // STEP 2: Read time slots — all slots including breaks, ordered
        // ─────────────────────────────────────────────────────────────────────
        log.info("STEP 2 ▶ Loading time slots...");
        // Full ordered list (including breaks) — needed for lab consecutive-window detection
        List<TimeSlot> allSlots = timeSlotRepository.findAllByOrderBySlotOrderAsc();
        // Teaching-only slots (breaks excluded) — used for theory scheduling
        List<TimeSlot> teachingSlots = allSlots.stream()
            .filter(s -> !Boolean.TRUE.equals(s.getIsBreak()))
            .toList();

        if (teachingSlots.isEmpty()) {
            log.error("No teaching slots configured. Aborting generation.");
            conflictRecorderService.addConflict(timetable, "NO_TIME_SLOTS",
                "No teaching time slots configured in the system. Please configure time slots.",
                "HIGH");
            timetable.setStatus("GENERATED");
            timetable.setConflictCount(1);
            timetable.setOptimizationScore(0);
            return;
        }

        // ─────────────────────────────────────────────────────────────────────
        // STEP 3: Read faculty
        // ─────────────────────────────────────────────────────────────────────
        log.info("STEP 3 ▶ Loading faculty...");
        List<Faculty> allFaculty = facultyRepository.findAll();

        // ─────────────────────────────────────────────────────────────────────
        // STEP 4: Read classrooms
        // ─────────────────────────────────────────────────────────────────────
        log.info("STEP 4 ▶ Loading classrooms...");
        List<Classroom> allRooms = classroomRepository.findByStatus("AVAILABLE");

        // ─────────────────────────────────────────────────────────────────────
        // STEP 5: Build availability map from FacultyAvailability records
        // ─────────────────────────────────────────────────────────────────────
        log.info("STEP 5 ▶ Building faculty availability map...");
        List<FacultyAvailability> availabilities = availabilityRepository.findAll();
        Map<String, String> availabilityMap = new HashMap<>();
        for (FacultyAvailability fa : availabilities) {
            String key = fa.getFaculty().getId() + "_" + fa.getDayOfWeek() + "_" + fa.getTimeSlot().getId();
            availabilityMap.put(key, fa.getSlotType());
        }

        // ─────────────────────────────────────────────────────────────────────
        // STEP 6: Pre-load ALL existing entries for cross-timetable clash detection.
        // This is one DB call — NOT one call per slot per subject per day.
        // Fixes the N+1 query problem in the old engine.
        // ─────────────────────────────────────────────────────────────────────
        log.info("STEP 6 ▶ Pre-loading existing entries for cross-timetable conflict tracking...");
        List<Long> allFacultyIds = allFaculty.stream().map(Faculty::getId).toList();
        List<TimetableEntry> existingEntries = allFacultyIds.isEmpty()
            ? Collections.emptyList()
            : entryRepository.findByFacultyIdIn(allFacultyIds);

        // Build occupancy context from all existing entries
        ConstraintContext context = buildContext(existingEntries, timetable, availabilityMap);

        // ─────────────────────────────────────────────────────────────────────
        // Handle locked entry preservation for partial regeneration
        // ─────────────────────────────────────────────────────────────────────
        List<TimetableEntry> lockedEntries = lockPreservationService
            .prepareForGeneration(timetable, regenerateOnlyUnlocked);
        for (TimetableEntry locked : lockedEntries) {
            registerEntryInContext(locked, context);
        }

        int generatedCount = 0;
        int conflictCount = 0;
        int offTargetPlacements = 0;

        // ─────────────────────────────────────────────────────────────────────
        // STEP 7: Calculate weekly hours for all subjects
        // ─────────────────────────────────────────────────────────────────────
        log.info("STEP 7 ▶ Calculating weekly hours per subject...");
        Map<Long, Integer> weeklyHoursMap = subjectDemandService.calculateWeeklyHours(subjects);
        subjectDemandService.logSubjectWeeklyHours(subjects, weeklyHoursMap);
        // Demand verification: theory + practical per subject must equal the
        // weekly demand the engines are about to create (42 for the live CSE data).
        subjectDemandService.logDemandBreakdown(subjects, null);

        // For partial regeneration, locked entries already contribute toward each
        // subject's weekly coverage. Reduce the required count so the engine never
        // double-schedules locked periods, and remember which days are covered so
        // the distribution plan can avoid them.
        Map<Long, Set<String>> lockedDaysBySubject = new HashMap<>();
        if (regenerateOnlyUnlocked) {
            lockedDaysBySubject = lockPreservationService.lockedDaysBySubject(timetable);
            lockPreservationService.reduceWeeklyHoursForLockedSubjects(
                timetable, subjects, weeklyHoursMap);
        }

        // ─────────────────────────────────────────────────────────────────────
        // STEP 8: Reserve practical sessions (consecutive non-break periods in a LAB room).
        // Practical lessons come from the practicalHours of ANY subject — not just
        // subjects typed LAB — so THEORY subjects like CS142/CS795 (2 practical
        // hours each) and CS850 (2 practical hours, 0 theory) get their practical
        // periods. They are scheduled first because LAB rooms and consecutive
        // windows are the most restrictive resources.
        // ─────────────────────────────────────────────────────────────────────
        log.info("STEP 8 ▶ Scheduling practical sessions (per-subject consecutive periods)...");
        List<Subject> practicalSubjects = new ArrayList<>(subjects.stream()
            .filter(s -> s.getPracticalHours() != null && s.getPracticalHours() > 0)
            .toList());
        Collections.shuffle(practicalSubjects, rng);

        int practicalBlockIndex = 0;
        for (Subject practicalSubject : practicalSubjects) {
            int practicalHours = practicalSubject.getPracticalHours();
            log.info("  Scheduling practical: {} ({}) → {} period(s)", practicalSubject.getSubjectCode(),
                practicalSubject.getSubjectName(), practicalHours);

            // Partial regeneration: locked practical entries already cover part of
            // this subject's demand, so only the uncovered remainder is re-placed.
            // Locked THEORY entries never reduce the practical demand and vice
            // versa — each component is subtracted separately.
            if (regenerateOnlyUnlocked) {
                long lockedPractical = timetable.getEntries().stream()
                    .filter(e -> Boolean.TRUE.equals(e.getIsLocked()) && Boolean.TRUE.equals(e.getIsLab())
                        && e.getSubject() != null && e.getSubject().getId().equals(practicalSubject.getId()))
                    .count();
                if (lockedPractical > 0) {
                    practicalHours = Math.max(0, practicalHours - (int) lockedPractical);
                    log.info("  Practical {} — {} period(s) remain after {} locked practical period(s)",
                        practicalSubject.getSubjectCode(), practicalHours, lockedPractical);
                    if (practicalHours == 0) {
                        log.info("  Skipping practical {} — locked practical periods cover the full demand",
                            practicalSubject.getSubjectCode());
                        continue;
                    }
                }
            }

            // Try the direct-assigned faculty first, then all other qualified
            // candidates (least-loaded first).
            List<Faculty> practicalCandidates = getQualifiedFacultyCandidates(
                practicalSubject, allFaculty, timetable.getDepartment().getId());

            if (practicalCandidates.isEmpty()) {
                String msg = "No qualified faculty available for practical: " + practicalSubject.getSubjectCode();
                log.warn("  ⚠ {}", msg);
                conflictRecorderService.addConflict(timetable, "UNASSIGNED_FACULTY", msg, "HIGH");
                conflictCount++;
                continue;
            }

            int placedForSubject = 0;
            // Per-subject practical block size: the subject's entire
            // practicalHoursPerWeek is always scheduled as ONE single
            // continuous back-to-back block on ONE randomly chosen day.
            // The "Consecutive Periods per Session" dropdown is IGNORED for
            // lab/practical scheduling — the full weekly practical hours are
            // placed as a single block.
            int blockSize = practicalHours;

            // One single consecutive block containing ALL practical hours.
            boolean placed = false;
            PracticalBlockResult worstResult = PracticalBlockResult.NO_CONSECUTIVE_WINDOW;
            for (Faculty practicalFaculty : practicalCandidates) {
                PracticalBlockResult result = schedulePracticalBlock(timetable, practicalSubject, practicalFaculty,
                    allRooms, allSlots, context, practicalBlockIndex++, blockSize);
                if (result == PracticalBlockResult.PLACED) {
                    placed = true;
                    placedForSubject += blockSize;
                    break;
                }
                if (result.ordinal() < worstResult.ordinal()) {
                    worstResult = result;
                }
            }
            if (!placed) {
                String[] conflict = practicalBlockConflict(timetable, practicalSubject, worstResult,
                    blockSize, allRooms, allSlots, practicalCandidates, context);
                log.warn("  ⚠ {}", conflict[1]);
                conflictRecorderService.addConflict(timetable, conflict[0], conflict[1], "HIGH");
                conflictCount++;
            }

            generatedCount += placedForSubject;
            if (placedForSubject == practicalHours) {
                log.info("  ✓ Practical {} placed successfully ({} period(s))",
                    practicalSubject.getSubjectCode(), placedForSubject);
            } else {
                log.warn("  ⚠ Practical {} placed {}/{} period(s)",
                    practicalSubject.getSubjectCode(), placedForSubject, practicalHours);
            }
        }

        // ─────────────────────────────────────────────────────────────────────
        // STEP 9: Distribute theory classes evenly across Monday–Saturday
        // Theory demand is the theoryHours component only; the practicalHours
        // component is already placed in STEP 8.
        // ─────────────────────────────────────────────────────────────────────
        log.info("STEP 9 ▶ Building weekly distribution plan for theory subjects...");
        List<Subject> theorySubjects = new ArrayList<>(subjects.stream()
            .filter(s -> s.getTheoryHours() != null && s.getTheoryHours() > 0)
            // Consecutive-block subjects first so they can claim the rare
            // multi-period windows while they are still available, then by
            // descending weekly hours for the rest.
            .sorted(Comparator
                .comparingInt((Subject s) -> -Math.min(subjectDemandService.getSessionBlockSize(s),
                    Math.max(1, s.getTheoryHours() != null ? s.getTheoryHours() : 0)))
                .thenComparingInt((Subject s) -> -(s.getTheoryHours() != null ? s.getTheoryHours() : 0)))
            .toList());
        // Shuffle within equal (blockSize, hours) groups so different subjects
        // get first pick of days while preserving the block-size-first strategy.
        Comparator<Subject> theoryKey = Comparator
            .comparingInt((Subject s) -> -Math.min(subjectDemandService.getSessionBlockSize(s),
                Math.max(1, s.getTheoryHours() != null ? s.getTheoryHours() : 0)))
            .thenComparingInt((Subject s) -> -(s.getTheoryHours() != null ? s.getTheoryHours() : 0));
        theorySubjects = shuffleWithinTies(theorySubjects, theoryKey);

        Map<Long, Integer> theoryHoursMap = new HashMap<>();
        for (Subject s : subjects) {
            int theory = s.getTheoryHours() != null ? s.getTheoryHours() : 0;
            // Partial regeneration: each locked THEORY entry already covers one of
            // this subject's theory periods, so place only the uncovered remainder.
            if (regenerateOnlyUnlocked) {
                long lockedTheory = lockedEntries.stream()
                    .filter(e -> !Boolean.TRUE.equals(e.getIsLab())
                        && e.getSubject() != null && e.getSubject().getId().equals(s.getId()))
                    .count();
                theory = Math.max(0, theory - (int) lockedTheory);
            }
            theoryHoursMap.put(s.getId(), theory);
        }

        // Per-day theory capacity: the section can hold one lesson per teaching
        // slot per day, minus the practical and locked periods already placed on
        // that day by STEP 8. The distribution plan uses this so it never plans
        // more theory onto a day than the day can physically hold.
        Map<String, Integer> dayCapacity = new HashMap<>();
        for (String day : WORKING_DAYS) {
            long placed = timetable.getEntries().stream()
                .filter(e -> day.equals(e.getDayOfWeek()) && e.getTimeSlot() != null)
                .count();
            dayCapacity.put(day, Math.max(0, teachingSlots.size() - (int) placed));
        }

        // Per-subject faculty daily capacity: the subject's assigned faculty may
        // hold at most 5 periods per day (college cap) or its own lower
        // maxDailyHours, minus the lab/locked periods already placed on that day.
        // A subject whose own practical session lands on the section's
        // least-loaded day must not have its theory planned onto that same day —
        // the placement would reject it at the faculty cap and the theory would
        // spill onto an extra day. Planning against the binding capacity (section
        // OR faculty) keeps each subject on its minimum teaching days.
        Map<Long, Map<String, Integer>> facultyDayCapacity = new HashMap<>();
        for (Subject s : theorySubjects) {
            Faculty owner = s.getAssignedFaculty();
            if (owner == null || "LEAVE".equalsIgnoreCase(owner.getStatus())) {
                continue;
            }
            Integer ownCap = owner.getMaxDailyHours();
            int effectiveCap = (ownCap != null && ownCap > 0) ? Math.min(5, ownCap) : 5;
            Map<String, Integer> remaining = new HashMap<>();
            for (String day : WORKING_DAYS) {
                long placed = timetable.getEntries().stream()
                    .filter(e -> day.equals(e.getDayOfWeek())
                        && e.getFaculty() != null && e.getFaculty().getId().equals(owner.getId())
                        && e.getTimeSlot() != null)
                    .count();
                remaining.put(day, Math.max(0, effectiveCap - (int) placed));
            }
            facultyDayCapacity.put(s.getId(), remaining);
        }

        Map<Long, List<SubjectDemandService.DistributionEntry>> theoryDistribution =
            subjectDemandService.buildTheoryDistributionPlan(
                theorySubjects, theoryHoursMap, lockedDaysBySubject, dayCapacity, facultyDayCapacity, rng);

        // Theory conflicts are deferred until after the STEP 10d mop-up pass:
        // an hour that the main per-day loop cannot place may still be repaired
        // by the mop-up, and recording it now would leave a stale conflict.
        Map<Long, List<String>> deferredTheoryConflicts = new HashMap<>();

        // ─────────────────────────────────────────────────────────────────────
        // STEP 10: Schedule theory periods
        // ─────────────────────────────────────────────────────────────────────
        log.info("STEP 10 ▶ Scheduling theory periods...");
        for (Subject subject : theorySubjects) {
            int weeklyHours = theoryHoursMap.getOrDefault(subject.getId(), 1);
            // Consecutive-period subjects: clamp block size to the subject's own
            // weekly hours so a block never exceeds its total weekly requirement.
            int blockSize = Math.min(subjectDemandService.getSessionBlockSize(subject), Math.max(1, weeklyHours));

            // Each planned entry is ONE session (a consecutive block of its
            // blockSize, or a single). The distribution plan clusters sessions onto
            // the minimum number of teaching days (back-to-back teaching allowed).
            List<SubjectDemandService.DistributionEntry> planEntries = theoryDistribution.get(subject.getId());
            if (planEntries == null) {
                planEntries = new ArrayList<>();
                int remaining = weeklyHours;
                for (String day : WORKING_DAYS) {
                    if (remaining <= 0) break;
                    int size = Math.min(blockSize, remaining);
                    planEntries.add(new SubjectDemandService.DistributionEntry(day, size));
                    remaining -= size;
                }
            }
            Set<String> plannedDays = planEntries.stream()
                .map(SubjectDemandService.DistributionEntry::day)
                .collect(Collectors.toSet());
            log.info("  Scheduling theory: {} ({}) → sessions: {}, blockSize: {}", subject.getSubjectCode(),
                subject.getSubjectName(), planEntries, blockSize);

            List<Faculty> candidates = getQualifiedFacultyCandidates(
                subject, allFaculty, timetable.getDepartment().getId());

            if (blockSize > 1) {
                // ─────────────────────────────────────────────────────────────
                // STEP 10c: Consecutive-period subjects.
                // Each planned session is placed as a `blockSize`-period
                // consecutive block (or a single for the weekly remainder), so
                // the total placed periods never exceed the subject's weekly
                // hours. Back-to-back teaching is allowed, so several sessions
                // may share the same day.
                // ─────────────────────────────────────────────────────────────
                for (SubjectDemandService.DistributionEntry session : planEntries) {
                    String sessionDay = session.day();
                    int sessionBlock = session.blockSize();

                    if (sessionBlock > 1) {
                        if (tryPlaceConsecutiveBlock(timetable, subject, candidates, allSlots,
                            allRooms, sessionDay, sessionBlock, context)) {
                            generatedCount += sessionBlock;
                            log.debug("  ✓ {} → {} ({} consecutive)", subject.getSubjectCode(), sessionDay, sessionBlock);
                            continue;
                        }

                        // Fallback: place the block on a non-planned day (soft-goal relaxation).
                        boolean fallbackPlaced = false;
                        for (String altDay : orderDaysBySectionLoad(timetable, WORKING_DAYS)) {
                            if (plannedDays.contains(altDay)) continue;
                            if (tryPlaceConsecutiveBlock(timetable, subject, candidates, allSlots,
                                allRooms, altDay, sessionBlock, context)) {
                                generatedCount += sessionBlock;
                                offTargetPlacements++;
                                fallbackPlaced = true;
                                log.debug("  ✓ {} → {} (fallback consecutive)", subject.getSubjectCode(), altDay);
                                break;
                            }
                        }

                        if (!fallbackPlaced) {
                            // Consecutive placement is a soft goal: relax it and
                            // place the block's periods as individual single
                            // sessions so the weekly theory demand is still met.
                            int placed = 0;
                            for (int i = 0; i < sessionBlock; i++) {
                                if (tryPlaceTheory(timetable, subject, candidates, teachingSlots,
                                    allRooms, sessionDay, context, false)) {
                                    placed++;
                                    generatedCount++;
                                    log.debug("  ✓ {} → {} (block relaxed to single)", subject.getSubjectCode(), sessionDay);
                                    continue;
                                }
                                boolean singleFallback = false;
                                for (String altDay : orderDaysBySectionLoad(timetable, WORKING_DAYS)) {
                                    if (plannedDays.contains(altDay)) continue;
                                    if (tryPlaceTheory(timetable, subject, candidates, teachingSlots,
                                        allRooms, altDay, context, false)) {
                                        placed++;
                                        generatedCount++;
                                        offTargetPlacements++;
                                        singleFallback = true;
                                        log.debug("  ✓ {} → {} (block relaxed to single)", subject.getSubjectCode(), altDay);
                                        break;
                                    }
                                }
                            }
                            if (placed == sessionBlock) {
                                log.debug("  ⚡ {} block relaxed to singles", subject.getSubjectCode());
                                continue;
                            }
                            String msg = "Could not find " + sessionBlock
                                + " consecutive free periods for " + subject.getSubjectCode()
                                + " on any day (all windows conflict with constraints)";
                            log.warn("  ⚠ {}", msg);
                            deferredTheoryConflicts.computeIfAbsent(subject.getId(), k -> new ArrayList<>()).add(msg);
                        }
                        continue;
                    }

                    // Remainder session: place as a single period (STEP 10b path).
                    if (tryPlaceTheory(timetable, subject, candidates, teachingSlots,
                        allRooms, sessionDay, context, false)) {
                        generatedCount++;
                        log.debug("  ✓ {} → {} (single)", subject.getSubjectCode(), sessionDay);
                        continue;
                    }

                    boolean fallbackPlaced = false;
                    for (String altDay : orderDaysBySectionLoad(timetable, WORKING_DAYS)) {
                        if (plannedDays.contains(altDay)) continue;
                        if (tryPlaceTheory(timetable, subject, candidates, teachingSlots,
                            allRooms, altDay, context, false)) {
                            generatedCount++;
                            offTargetPlacements++;
                            fallbackPlaced = true;
                            log.debug("  ✓ {} → {} (fallback)", subject.getSubjectCode(), altDay);
                            break;
                        }
                    }

                    if (!fallbackPlaced) {
                        String msg = "Could not place theory period for " + subject.getSubjectCode()
                            + " on " + sessionDay + " (all faculty, slots and rooms conflict with constraints)";
                        log.warn("  ⚠ {}", msg);
                        deferredTheoryConflicts.computeIfAbsent(subject.getId(), k -> new ArrayList<>()).add(msg);
                    }
                }
                continue;
            }

            // ─────────────────────────────────────────────────────────────────
            // STEP 10b: Find a valid (faculty, slot, room) on the target day.
            // Qualified faculty are tried in least-loaded order (load-balanced),
            // teaching slots are ordered preferred-first, and rooms are selected
            // per slot. If the exact target day is impossible we fall back to any
            // other working day before declaring a conflict — this is the
            // pragmatic backtracking step that removes the greedy dead-ends.
            // For blockSize=1, no two periods may share the same day — the
            // fallback loop skips days where this subject is already placed.
            // ─────────────────────────────────────────────────────────────────
            Set<String> subjectPlacedDays = new HashSet<>();
            for (TimetableEntry e : timetable.getEntries()) {
                if (e.getSubject() != null && e.getSubject().getId().equals(subject.getId())
                        && !Boolean.TRUE.equals(e.getIsLab()) && e.getDayOfWeek() != null) {
                    subjectPlacedDays.add(e.getDayOfWeek());
                }
            }

            for (SubjectDemandService.DistributionEntry session : planEntries) {
                String day = session.day();

                if (tryPlaceTheory(timetable, subject, candidates, teachingSlots,
                    allRooms, day, context, false)) {
                    generatedCount++;
                    subjectPlacedDays.add(day);
                    log.debug("  ✓ {} → {}", subject.getSubjectCode(), day);
                    continue;
                }

                // Fallback: place on a non-planned day (soft-goal relaxation).
                boolean fallbackPlaced = false;
                for (String altDay : orderDaysBySectionLoad(timetable, WORKING_DAYS)) {
                    if (blockSize <= 1 && subjectPlacedDays.contains(altDay)) continue;
                    if (plannedDays.contains(altDay)) continue;
                    if (tryPlaceTheory(timetable, subject, candidates, teachingSlots,
                        allRooms, altDay, context, false)) {
                        generatedCount++;
                        offTargetPlacements++;
                        fallbackPlaced = true;
                        if (blockSize <= 1) {
                            subjectPlacedDays.add(altDay);
                        }
                        log.debug("  ✓ {} → {} (fallback)", subject.getSubjectCode(), altDay);
                        break;
                    }
                }

                if (!fallbackPlaced) {
                    String msg = "Could not place theory period for " + subject.getSubjectCode()
                        + " on " + day + " (all faculty, slots and rooms conflict with constraints)";
                    log.warn("  ⚠ {}", msg);
                    deferredTheoryConflicts.computeIfAbsent(subject.getId(), k -> new ArrayList<>()).add(msg);
                }
            }
        }

        // ─────────────────────────────────────────────────────────────────────
        // STEP 10d: Mop-up / repair pass.
        // The per-target-day loop above places exactly one period per planned day,
        // so a subject that runs late (e.g. placed last among same-size subjects)
        // can find all its target days fully packed and lose an hour, leaving a
        // single stranded free slot elsewhere in the week. This pass retries every
        // under-placed theory subject across ALL days and slots, repairing the
        // greedy dead-end instead of recording a THEORY_SLOT_UNAVAILABLE conflict.
        // ─────────────────────────────────────────────────────────────────────
        Map<Long, Integer> placedTheoryBySubject = new HashMap<>();
        for (TimetableEntry e : timetable.getEntries()) {
            if (e.getSubject() == null) continue;
            if (!Boolean.TRUE.equals(e.getIsLab())) {
                placedTheoryBySubject.merge(e.getSubject().getId(), 1, Integer::sum);
            }
        }
        for (Subject subject : theorySubjects) {
            int placed = placedTheoryBySubject.getOrDefault(subject.getId(), 0);
            int missing = theoryHoursMap.getOrDefault(subject.getId(), 0) - placed;
            if (missing <= 0) continue;

            List<Faculty> candidates = getQualifiedFacultyCandidates(
                subject, allFaculty, timetable.getDepartment().getId());
            int subjectBlockSize = Math.min(
                subjectDemandService.getSessionBlockSize(subject), Math.max(1, theoryHoursMap.getOrDefault(subject.getId(), 0)));

            // For blockSize=1 subjects, track which days already hold a period
            // (including any placed during this mop-up pass) so we never place
            // two on the same day.
            Set<String> subjectDays = new HashSet<>();
            if (subjectBlockSize <= 1) {
                for (String day : WORKING_DAYS) {
                    if (subjectHasPeriodOnDay(timetable, subject.getId(), day)) {
                        subjectDays.add(day);
                    }
                }
            }

            int repaired = 0;
            for (int i = 0; i < missing; i++) {
                boolean placedAny = false;
                for (String day : orderDaysBySectionLoad(timetable, WORKING_DAYS)) {
                    if (subjectBlockSize <= 1 && subjectDays.contains(day)) {
                        continue;
                    }
                    if (tryPlaceTheory(timetable, subject, candidates, teachingSlots,
                        allRooms, day, context, false)) {
                        generatedCount++;
                        offTargetPlacements++;
                        repaired++;
                        placedAny = true;
                        if (subjectBlockSize <= 1) {
                            subjectDays.add(day);
                        }
                        log.debug("  ✓ {} → {} (mop-up)", subject.getSubjectCode(), day);
                        break;
                    }
                }
                if (!placedAny) {
                    String msg = "Mop-up: could not place remaining theory period for "
                        + subject.getSubjectCode() + " (all days conflict with constraints)";
                    log.warn("  ⚠ {}", msg);
                    deferredTheoryConflicts.computeIfAbsent(subject.getId(), k -> new ArrayList<>()).add(msg);
                }
            }
            if (repaired > 0) {
                log.info("  Mop-up placed {} missing period(s) for {}", repaired, subject.getSubjectCode());
            }
        }

        // Flush deferred theory conflicts: only subjects that are STILL
        // under-placed after the mop-up pass keep their recorded conflicts.
        for (Map.Entry<Long, List<String>> deferred : deferredTheoryConflicts.entrySet()) {
            Long subjectId = deferred.getKey();
            int placed = 0;
            for (TimetableEntry e : timetable.getEntries()) {
                if (e.getSubject() != null && e.getSubject().getId().equals(subjectId)
                        && !Boolean.TRUE.equals(e.getIsLab())) {
                    placed++;
                }
            }
            if (placed >= theoryHoursMap.getOrDefault(subjectId, 0)) {
                continue; // repaired by the mop-up — drop the stale conflicts
            }
            for (String msg : deferred.getValue()) {
                if (conflictRecorderService.addConflict(timetable, "THEORY_SLOT_UNAVAILABLE", msg, "MEDIUM")) {
                    conflictCount++;
                }
            }
        }

        // ─────────────────────────────────────────────────────────────────────
        // STEP 12–13: Allocate classrooms check (already done per-slot above)
        // STEP 14: Post-generation conflict validation
        // ─────────────────────────────────────────────────────────────────────
        log.info("STEP 14 ▶ Post-generation validation...");
        int validationConflicts = conflictRecorderService.runPostValidation(timetable);
        conflictCount += validationConflicts;

        // ─────────────────────────────────────────────────────────────────────
        // STEP 15: Save timetable (done by caller via timetableRepository.save)
        // ─────────────────────────────────────────────────────────────────────
        int score = reportingService.computeOptimizationScore(timetable, availabilityMap, offTargetPlacements);
        timetable.setConflictCount(conflictCount);
        timetable.setOptimizationScore(score);
        timetable.setStatus("GENERATED");

        log.info("═══════════════════════════════════════════════════════════════");
        log.info("  SCHEDULING COMPLETE");
        log.info("  Entries Generated : {}", generatedCount);
        log.info("  Conflicts         : {}", conflictCount);
        log.info("  Optimization Score: {}%", score);
        log.info("═══════════════════════════════════════════════════════════════");

        // Demand verification: expected = theory + practical per subject.
        int expectedTotal = subjects.stream()
            .mapToInt(s -> (s.getTheoryHours() != null ? s.getTheoryHours() : 0)
                + (s.getPracticalHours() != null ? s.getPracticalHours() : 0))
            .sum();
        log.info("  Demand check: expected {} entries vs generated {} entries",
            expectedTotal, generatedCount);
        if (generatedCount != expectedTotal) {
            log.warn("  ⚠ DEMAND MISMATCH — generated {} but expected {}",
                generatedCount, expectedTotal);
        }
    }

    // =====================================================================
    // STEP 6 — Context Initialization (single DB call, no per-slot queries)
    // =====================================================================

    /**
     * Builds the ConstraintContext from ALL existing timetable entries loaded in a
     * single batch DB call.  The old engine called findFacultyClashes() and
     * findRoomClashes() from inside the constraint pipeline — one DB query per
     * candidate slot, causing catastrophic N+1 query problems.
     *
     * This method pre-populates the in-memory occupancy maps so constraint checks
     * never need to hit the database during generation.
     */
    private ConstraintContext buildContext(List<TimetableEntry> existingEntries,
                                          Timetable currentTimetable,
                                          Map<String, String> availabilityMap) {
        Map<String, Set<Long>> facultyOccupancy  = new HashMap<>();
        Map<String, Set<Long>> roomOccupancy     = new HashMap<>();
        Map<String, Boolean>   sectionOccupancy  = new HashMap<>();
        Map<String, Integer>   facultyDailyHours = new HashMap<>();
        Map<Long, Integer>     facultyWeeklyHours= new HashMap<>();
        Map<Long, Integer>     roomUsageCount    = new HashMap<>();
        Map<String, List<Integer>> facultyDaySlots = new HashMap<>();

        for (TimetableEntry entry : existingEntries) {
            // Skip entries from the timetable currently being (re)generated —
            // those are managed by the locked-entry preservation logic separately.
            if (currentTimetable.getId() != null && entry.getTimetable() != null
                    && Objects.equals(entry.getTimetable().getId(), currentTimetable.getId())) {
                continue;
            }
            if (entry.getFaculty() == null || entry.getTimeSlot() == null) continue;

            registerEntryInContextMaps(entry.getFaculty().getId(), entry.getDayOfWeek(),
                entry.getTimeSlot(),
                entry.getSection() != null ? entry.getSection().getId() : null,
                entry.getClassroom() != null ? entry.getClassroom().getId() : null,
                facultyOccupancy, roomOccupancy, sectionOccupancy, facultyDailyHours, facultyWeeklyHours,
                roomUsageCount, facultyDaySlots);
        }

        return ConstraintContext.builder()
            .facultyOccupancy(facultyOccupancy)
            .roomOccupancy(roomOccupancy)
            .sectionOccupancy(sectionOccupancy)
            .facultyDailyHours(facultyDailyHours)
            .facultyWeeklyHours(facultyWeeklyHours)
            .roomUsageCount(roomUsageCount)
            .availabilityMap(availabilityMap)
            .facultyDaySlots(facultyDaySlots)
            .entryRepository(null)   // No DB queries from constraints — all handled in-memory
            .build();
    }

    /**
     * Registers a newly placed (or locked) entry into all context maps so subsequent
     * constraint checks reflect the updated state.
     */
    private void registerEntryInContext(TimetableEntry entry, ConstraintContext context) {
        if (entry.getFaculty() == null || entry.getTimeSlot() == null) return;
        Long facultyId = entry.getFaculty().getId();
        Long roomId    = entry.getClassroom() != null ? entry.getClassroom().getId() : null;
        Long sectionId = entry.getSection() != null ? entry.getSection().getId() : null;

        registerEntryInContextMaps(facultyId, entry.getDayOfWeek(), entry.getTimeSlot(), sectionId, roomId,
            context.getFacultyOccupancy(), context.getRoomOccupancy(), context.getSectionOccupancy(),
            context.getFacultyDailyHours(), context.getFacultyWeeklyHours(),
            context.getRoomUsageCount(), context.getFacultyDaySlots());
    }

    private void registerEntryInContextMaps(Long facultyId, String day, TimeSlot slot, Long sectionId, Long roomId,
            Map<String, Set<Long>> facultyOccupancy, Map<String, Set<Long>> roomOccupancy,
            Map<String, Boolean> sectionOccupancy, Map<String, Integer> facultyDailyHours,
            Map<Long, Integer> facultyWeeklyHours, Map<Long, Integer> roomUsageCount,
            Map<String, List<Integer>> facultyDaySlots) {

        String slotKey  = day + "_" + slot.getId();
        String fDayKey  = facultyId + "_" + day;
        String sectionKey = sectionId != null ? sectionId + "_" + day + "_" + slot.getId() : null;

        if (sectionKey != null) {
            sectionOccupancy.put(sectionKey, true);
        }
        facultyOccupancy.computeIfAbsent(slotKey, k -> new HashSet<>()).add(facultyId);
        if (roomId != null) {
            roomOccupancy.computeIfAbsent(slotKey, k -> new HashSet<>()).add(roomId);
            roomUsageCount.merge(roomId, 1, Integer::sum);
        }
        facultyDailyHours.merge(fDayKey, 1, Integer::sum);
        facultyWeeklyHours.merge(facultyId, 1, Integer::sum);

        // Track exact slot numbers for consecutive teaching rule
        if (slot.getSlotOrder() != null) {
            facultyDaySlots.computeIfAbsent(fDayKey, k -> new ArrayList<>()).add(slot.getSlotOrder());
            // Keep the list sorted so ConsecutiveTeachingConstraint can scan it linearly
            facultyDaySlots.get(fDayKey).sort(Integer::compareTo);
        }
    }

    // =====================================================================
    // STEP 8 — Practical Scheduling (consecutive non-break periods in LAB rooms)
    // =====================================================================

    /**
     * Attempts to place a practical block ({@code blockSize} consecutive
     * non-break periods) on any non-Saturday working day.
     *
     * <p>The day iteration is rotated by {@code practicalBlockIndex} so practicals
     * don't all gravitate to Monday. Saturday is NEVER offered to a LAB session.
     * The slot window is derived from the FULL day structure (including breaks) to correctly
     * detect when a {@code blockSize}-period window would span a break slot.
     *
     * <p>Only LAB rooms with capacity &gt;= the section's student strength are
     * eligible — capacity is a HARD requirement for practicals and is never
     * silently relaxed here; a shortage is reported truthfully by the caller.
     *
     * @return the outcome: {@link PracticalBlockResult#PLACED} on success, or the
     *         resource-level reason for the failure
     */
    private PracticalBlockResult schedulePracticalBlock(Timetable timetable, Subject subject, Faculty faculty,
            List<Classroom> allRooms, List<TimeSlot> allSlots,
            ConstraintContext context, int practicalBlockIndex, int blockSize) {

        int reqCapacity = getRequiredCapacity(timetable);

        // LAB-only: a practical may only be placed in a classroom typed LAB.
        List<Classroom> labRooms = allRooms.stream()
            .filter(r -> "LAB".equalsIgnoreCase(r.getRoomType()))
            .filter(r -> isRoomEligibleForTimetable(r, timetable))
            .toList();
        if (labRooms.isEmpty()) {
            log.warn("    No lab rooms available for {} practical", subject.getSubjectCode());
            return PracticalBlockResult.NO_LAB_ROOM;
        }

        // Capacity-valid: the LAB room must fit the section's student strength.
        List<Classroom> eligibleLabs = labRooms.stream()
            .filter(r -> r.getCapacity() != null && r.getCapacity() >= reqCapacity)
            .toList();
        if (eligibleLabs.isEmpty()) {
            log.warn("    No lab room with capacity >= {} for {} practical", reqCapacity, subject.getSubjectCode());
            return PracticalBlockResult.LAB_CAPACITY_INSUFFICIENT;
        }

        // LAB sessions are never scheduled on Saturday, so the rotation walks
        // only the five LAB_DAYS.
        int totalDays = LAB_DAYS.size();

        for (int d = 0; d < totalDays; d++) {
            String day = LAB_DAYS.get((practicalBlockIndex + d) % totalDays);

            // Build consecutive windows from the FULL slot list (including breaks).
            // A window is valid only if NONE of its slots is a break AND
            // slot numbers are strictly consecutive (gap of 1 each).
            List<List<TimeSlot>> windows = buildConsecutiveWindows(allSlots, blockSize);

            for (List<TimeSlot> window : windows) {
                // Ensure the entire window is free for faculty and room
                // Try each lab room until we find one that is free across all slots
                for (Classroom room : eligibleLabs) {
                    CandidatePlacement placement = CandidatePlacement.builder()
                        .subject(subject)
                        .faculty(faculty)
                        .classroom(room)
                        .dayOfWeek(day)
                        .slots(window)
                        .departmentId(timetable.getDepartment().getId())
                        .sectionId(timetable.getSection() != null ? timetable.getSection().getId() : null)
                        .isLab(true)
                        .build();

                    if (evaluateAllConstraints(placement, context)) {
                        for (TimeSlot slot : window) {
                            TimetableEntry entry = entryMapper.buildEntry(
                                day, slot, subject, faculty, room, timetable.getSection(), true);
                            timetable.addEntry(entry);
                            registerEntryInContext(entry, context);
                        }
                        return PracticalBlockResult.PLACED;
                    }
                }
            }
        }
        return PracticalBlockResult.NO_CONSECUTIVE_WINDOW;
    }

    /**
     * Builds the truthful conflict record for a failed practical block.
     *
     * <p>The message is fully structured — subject, practical demand, required
     * block size, required room type, required capacity, the largest available
     * LAB capacity, the assigned faculty and the exact blocking reason — so the
     * UI never has to guess why a practical was not scheduled.
     *
     * <p>Distinguishes the resource-level cause instead of always reporting the
     * generic "all candidate windows conflict" message:
     * <ul>
     *   <li>no LAB room configured at all → {@code NO_ELIGIBLE_LAB_ROOM};</li>
     *   <li>LAB rooms exist but none meets the section's strength → {@code LAB_CAPACITY_INSUFFICIENT};</li>
     *   <li>eligible LAB rooms exist but no consecutive window is free →
     *       {@code PRACTICAL_BLOCK_UNAVAILABLE} with the dominant blocking
     *       constraints named (see {@link #analyzePracticalBlockFailure}).</li>
     * </ul>
     *
     * @return {@code [conflictType, description]}
     */
    private String[] practicalBlockConflict(Timetable timetable, Subject subject, PracticalBlockResult result,
            int blockSize, List<Classroom> allRooms, List<TimeSlot> allSlots,
            List<Faculty> candidates, ConstraintContext context) {
        String code = subject.getSubjectCode();
        int practicalDemand = subject.getPracticalHours() != null ? subject.getPracticalHours() : 0;
        int reqCapacity = getRequiredCapacity(timetable);
        String facultyName = subject.getAssignedFaculty() != null
            ? subject.getAssignedFaculty().getFullName()
            : (candidates != null && !candidates.isEmpty() ? candidates.get(0).getFullName() : "none");
        String header = "Subject " + code + ": practical demand " + practicalDemand
            + ", required block " + blockSize + ", required room type LAB, required capacity " + reqCapacity
            + ", faculty " + facultyName + ".";
        switch (result) {
            case NO_LAB_ROOM:
                return new String[] { "NO_ELIGIBLE_LAB_ROOM",
                    header + " Reason: NO_ELIGIBLE_LAB_ROOM (no LAB room is configured)."
                        + " Add an AVAILABLE classroom typed LAB to schedule this practical." };
            case LAB_CAPACITY_INSUFFICIENT: {
                int maxLabCapacity = allRooms.stream()
                    .filter(r -> "LAB".equalsIgnoreCase(r.getRoomType()))
                    .map(Classroom::getCapacity)
                    .filter(Objects::nonNull)
                    .max(Integer::compareTo)
                    .orElse(0);
                return new String[] { "LAB_CAPACITY_INSUFFICIENT",
                    header + " Reason: LAB_CAPACITY_INSUFFICIENT (no LAB room with capacity >= " + reqCapacity
                        + "; largest available LAB capacity is " + maxLabCapacity + ")."
                        + " Increase the LAB room capacity or reduce the section strength." };
            }
            default:
                int windowsPerDay = buildConsecutiveWindows(allSlots, blockSize).size();
                return new String[] { "PRACTICAL_BLOCK_UNAVAILABLE",
                    header + " Candidate consecutive windows: " + windowsPerDay + " per day x " + LAB_DAYS.size()
                        + " day(s) (LAB is never scheduled on Saturday). "
                        + analyzePracticalBlockFailure(timetable, subject, blockSize, allRooms, allSlots,
                            candidates, context) };
        }
    }

    /**
     * Diagnoses why no consecutive window was found for a practical block. Using
     * the section's capacity-valid LAB rooms, every (day, consecutive-window)
     * candidate is re-evaluated and the FIRST failing hard constraint per candidate
     * is tallied, so the reported reason names the actual blocking resource (room
     * occupancy, faculty clash, faculty availability, daily/weekly hour limits,
     * section occupancy) instead of a generic message.
     */
    private String analyzePracticalBlockFailure(Timetable timetable, Subject subject, int blockSize,
            List<Classroom> allRooms, List<TimeSlot> allSlots,
            List<Faculty> candidates, ConstraintContext context) {

        int reqCapacity = getRequiredCapacity(timetable);
        List<Classroom> eligibleLabs = allRooms.stream()
            .filter(r -> "LAB".equalsIgnoreCase(r.getRoomType()))
            .filter(r -> isRoomEligibleForTimetable(r, timetable))
            .filter(r -> r.getCapacity() != null && r.getCapacity() >= reqCapacity)
            .toList();
        if (eligibleLabs.isEmpty()) {
            return "no eligible LAB room (capacity >= " + reqCapacity + ") exists";
        }

        Faculty diagnosticFaculty = subject.getAssignedFaculty() != null
            ? subject.getAssignedFaculty()
            : (candidates != null && !candidates.isEmpty() ? candidates.get(0) : null);

        Map<String, Integer> reasons = new LinkedHashMap<>();
        for (int d = 0; d < LAB_DAYS.size(); d++) {
            String day = LAB_DAYS.get(d);
            for (List<TimeSlot> window : buildConsecutiveWindows(allSlots, blockSize)) {
                for (Classroom room : eligibleLabs) {
                    CandidatePlacement placement = CandidatePlacement.builder()
                        .subject(subject)
                        .faculty(diagnosticFaculty)
                        .classroom(room)
                        .dayOfWeek(day)
                        .slots(window)
                        .departmentId(timetable.getDepartment().getId())
                        .sectionId(timetable.getSection() != null ? timetable.getSection().getId() : null)
                        .isLab(true)
                        .build();
                    SchedulingConstraint failure = firstFailingConstraint(placement, context);
                    if (failure == null) {
                        // A candidate actually passes every hard constraint — the
                        // block failure was caused by the specific faculty tried in
                        // the main loop, not by a global resource shortage.
                        return "at least one consecutive window in a capacity-valid LAB room is free "
                            + "for another qualified faculty, but none worked for the assigned faculty";
                    }
                    reasons.merge(failure.getConstraintName(), 1, Integer::sum);
                }
            }
        }

        List<Map.Entry<String, Integer>> top = reasons.entrySet().stream()
            .sorted(Map.Entry.<String, Integer>comparingByValue().reversed())
            .limit(3)
            .toList();
        if (top.isEmpty()) {
            return "no candidate window satisfied every hard constraint";
        }
        String joined = top.stream()
            .map(e -> reasonLabel(e.getKey()) + " in " + e.getValue() + " candidate window(s)")
            .collect(Collectors.joining("; "));
        return "Blocked by: " + joined + ". Eligible LAB rooms: "
            + eligibleLabs.stream().map(Classroom::getRoomNumber).collect(Collectors.joining(", "));
    }

    private static String reasonLabel(String constraintName) {
        switch (constraintName) {
            case "ROOM_CLASH": return "LAB room occupied";
            case "FACULTY_CLASH": return "faculty already teaching that window";
            case "FACULTY_AVAILABILITY": return "faculty unavailable (blocked/busy/leave)";
            case "FACULTY_DAILY_HOURS_LIMIT": return "faculty at the daily-hour limit";
            case "FACULTY_WEEKLY_HOURS_LIMIT": return "faculty at the weekly-hour limit";
            case "CONSECUTIVE_TEACHING_RULE": return "consecutive-teaching rule";
            case "SECTION_CLASH": return "section already occupied in that window";
            case "DEPARTMENT_PERMISSION": return "faculty lacks department permission";
            case "FACULTY_ASSIGNED_SUBJECT": return "faculty not assigned to the subject";
            case "ROOM_TYPE_MATCH": return "room type mismatch";
            case "LAB_CONSECUTIVE_BLOCK": return "lab consecutive-block rule";
            default: return constraintName;
        }
    }

    /**
     * Builds all possible consecutive windows of {@code windowSize} from {@code allSlots}.
     * A window is only returned if:
     *   - none of its slots is a break
     *   - slot numbers are strictly sequential (gap = 1)
     */
    private List<List<TimeSlot>> buildConsecutiveWindows(List<TimeSlot> allSlots, int windowSize) {
        List<List<TimeSlot>> windows = new ArrayList<>();
        for (int i = 0; i <= allSlots.size() - windowSize; i++) {
            List<TimeSlot> window = allSlots.subList(i, i + windowSize);
            boolean valid = true;
            for (int j = 0; j < window.size(); j++) {
                TimeSlot ts = window.get(j);
                if (Boolean.TRUE.equals(ts.getIsBreak())) { valid = false; break; }
                if (j > 0) {
                    TimeSlot prev = window.get(j - 1);
                    if (ts.getSlotOrder() == null || prev.getSlotOrder() == null
                            || ts.getSlotOrder() != prev.getSlotOrder() + 1) {
                        valid = false; break;
                    }
                }
            }
            if (valid) windows.add(new ArrayList<>(window));
        }
        return windows;
    }

    // =====================================================================
    // STEP 10 — Faculty Selection (load-balanced)
    // =====================================================================

    /**
     * Returns all qualified faculty for a subject, in preference order:
     *   1. Direct-assigned faculty (unless on LEAVE) — the primary owner of the subject
     *   2. Any other faculty passing department permission + subject eligibility,
     *      sorted later by live workload so the least-loaded is tried first
     *
     * "Qualified" means the faculty's department permission and subject eligibility
     * constraints pass. This replaces the old single-"best" selection so a stuck
     * direct-assigned faculty no longer produces a guaranteed conflict.
     */
    private List<Faculty> getQualifiedFacultyCandidates(Subject subject, List<Faculty> allFaculty,
            Long departmentId) {

        List<Faculty> candidates = new ArrayList<>();

        // Direct assignment takes precedence — include it first when eligible.
        if (subject.getAssignedFaculty() != null) {
            Faculty assigned = subject.getAssignedFaculty();
            if (!"LEAVE".equalsIgnoreCase(assigned.getStatus())) {
                CandidatePlacement probe = CandidatePlacement.builder()
                    .subject(subject)
                    .faculty(assigned)
                    .departmentId(departmentId)
                    .slots(Collections.emptyList())
                    .build();
                if (departmentPermissionConstraint.isSatisfied(probe, null)
                        && assignedSubjectConstraint.isSatisfied(probe, null)) {
                    candidates.add(assigned);
                }
            }
        }

        // Other qualified faculty (excluding the direct assignment).
        List<Faculty> others = allFaculty.stream()
            .filter(f -> !f.equals(subject.getAssignedFaculty()))
            .filter(f -> !"LEAVE".equalsIgnoreCase(f.getStatus()))
            .filter(f -> {
                CandidatePlacement probe = CandidatePlacement.builder()
                    .subject(subject)
                    .faculty(f)
                    .departmentId(departmentId)
                    .slots(Collections.emptyList())
                    .build();
                return departmentPermissionConstraint.isSatisfied(probe, null)
                    && assignedSubjectConstraint.isSatisfied(probe, null);
            })
            .toList();
        candidates.addAll(others);

        // Last resort: any faculty in the department, so a subject is never
        // permanently blocked by over-strict eligibility data.
        if (candidates.isEmpty()) {
            return allFaculty.stream()
                .filter(f -> f.getDepartment() != null && f.getDepartment().getId().equals(departmentId))
                .toList();
        }

        return candidates;
    }

    /**
     * Orders working days by how many entries are already placed on that day in
     * this timetable (fewest first). Fallback placements use this order so a
     * period that cannot land on its planned day goes to the LEAST-loaded day
     * instead of scattering onto an arbitrary day in a fixed sequence — keeping
     * the section's week balanced and the subject clustered.
     */
    private List<String> orderDaysBySectionLoad(Timetable timetable, List<String> days) {
        Map<String, Long> load = new HashMap<>();
        for (TimetableEntry e : timetable.getEntries()) {
            if (e.getTimeSlot() != null) {
                load.merge(e.getDayOfWeek(), 1L, Long::sum);
            }
        }
        return days.stream()
            .sorted(Comparator.comparingLong(d -> load.getOrDefault(d, 0L)))
            .toList();
    }

    /**
     * Returns {@code true} when the given subject already has at least one
     * non-lab theory entry on the specified day.  Used as a shared guard by
     * STEP 10b (primary + fallback) and STEP 10d (mop-up) so that
     * blockSize=1 subjects never receive two periods on the same day.
     */
    private boolean subjectHasPeriodOnDay(Timetable timetable, Long subjectId, String day) {
        for (TimetableEntry e : timetable.getEntries()) {
            if (e.getSubject() != null && e.getSubject().getId().equals(subjectId)
                    && !Boolean.TRUE.equals(e.getIsLab()) && day.equals(e.getDayOfWeek())) {
                return true;
            }
        }
        return false;
    }

    /**
     * Attempts to place a single theory period for {@code subject} on {@code day}.
     *
     * Faculty are tried in least-loaded-first order, teaching slots are ordered so
     * PREFERRED availability slots come first (soft goal), and the room is chosen
     * per (day, slot). The first combination satisfying the full hard-constraint
     * pipeline is placed and registered in the context.
     *
     * @return true if a period was placed
     */
    private boolean tryPlaceTheory(Timetable timetable, Subject subject, List<Faculty> candidates,
            List<TimeSlot> teachingSlots, List<Classroom> allRooms, String day,
            ConstraintContext context, boolean isLab) {

        Long deptId = timetable.getDepartment().getId();
        Long sectionId = timetable.getSection() != null ? timetable.getSection().getId() : null;
        int requiredCapacity = getRequiredCapacity(timetable);

        // Slot load = how many entries are already placed in each time slot of
        // this timetable. Used to spread theory classes across the full day
        // instead of always filling the earliest morning periods first.
        Map<Long, Integer> slotLoad = new HashMap<>();
        for (TimetableEntry e : timetable.getEntries()) {
            if (e.getTimeSlot() != null) {
                slotLoad.merge(e.getTimeSlot().getId(), 1, Integer::sum);
            }
        }

        // Least-loaded faculty first — balances daily workload across the team.
        List<Faculty> orderedCandidates = candidates.stream()
            .sorted(Comparator.comparingInt(f ->
                context.getFacultyDailyHours().getOrDefault(f.getId() + "_" + day, 0)))
            .toList();

        // Best valid candidate: the least-loaded free slot that passes every
        // constraint, falling back to ascending slot_order to break ties
        // (exact ties resolve to the least-loaded faculty via iteration order).
        CandidatePlacement bestPlacement = null;
        Classroom bestRoom = null;
        int bestSlotLoad = Integer.MAX_VALUE;
        int bestSlotOrder = Integer.MAX_VALUE;

        for (Faculty faculty : orderedCandidates) {
            List<TimeSlot> orderedSlots = orderSlotsByPreference(teachingSlots, faculty, day, context);
            for (TimeSlot slot : orderedSlots) {
                Classroom room = findAvailableRoom(subject, allRooms,
                    requiredCapacity, day, slot, context, isLab, timetable);
                if (room == null) continue;

                CandidatePlacement placement = CandidatePlacement.builder()
                    .subject(subject)
                    .faculty(faculty)
                    .classroom(room)
                    .dayOfWeek(day)
                    .slots(List.of(slot))
                    .departmentId(deptId)
                    .sectionId(sectionId)
                    .isLab(isLab)
                    .build();

                if (!evaluateAllConstraints(placement, context)) {
                    continue;
                }

                int load = slotLoad.getOrDefault(slot.getId(), 0);
                if (load < bestSlotLoad
                        || (load == bestSlotLoad && slot.getSlotOrder() < bestSlotOrder)) {
                    bestSlotLoad = load;
                    bestSlotOrder = slot.getSlotOrder();
                    bestPlacement = placement;
                    bestRoom = room;
                }
            }
        }

        if (bestPlacement == null) {
            return false;
        }

        TimeSlot slot = bestPlacement.getSlots().get(0);
        TimetableEntry entry = entryMapper.buildEntry(
            day, slot, subject, bestPlacement.getFaculty(), bestRoom, timetable.getSection(), false);
        if (isLab) {
            entry.setIsLab(true);
        }
        timetable.addEntry(entry);
        registerEntryInContext(entry, context);
        log.debug("    ✓ {} → {} P{} in {}", subject.getSubjectCode(), day,
            slot.getSlotOrder(), bestRoom.getRoomNumber());
        return true;
    }

    /**
     * Orders teaching slots so the faculty's PREFERRED availability slots are tried
     * first (soft goal S4), keeping the original period order otherwise.
     */
    private List<TimeSlot> orderSlotsByPreference(List<TimeSlot> slots, Faculty faculty,
            String day, ConstraintContext context) {
        return slots.stream()
            .sorted(Comparator.comparingInt((TimeSlot s) -> {
                String key = faculty.getId() + "_" + day + "_" + s.getId();
                String status = context.getAvailabilityMap().get(key);
                return "PREFERRED".equalsIgnoreCase(status) ? 0 : 1;
            }))
            .toList();
    }

    // =====================================================================
    // STEP 10c — Consecutive-Period Block Placement (sessionBlockSize > 1)
    // =====================================================================

    /**
     * Attempts to place a consecutive-period block of {@code blockSize} slots for a
     * theory subject on {@code day}. Mirrors {@link #schedulePracticalBlock}:
     * consecutive windows are built from the FULL slot list (breaks excluded and
     * slot numbers must be strictly sequential), then every (faculty, window, room)
     * combination is evaluated through the SAME hard-constraint pipeline used for
     * single periods — faculty/room/section clash per slot, availability per slot,
     * and daily/weekly hours counted as {@code placement.getSlots().size()}.
     *
     * @return true if all {@code blockSize} consecutive entries were placed
     */
    private boolean tryPlaceConsecutiveBlock(Timetable timetable, Subject subject,
            List<Faculty> candidates, List<TimeSlot> allSlots, List<Classroom> allRooms,
            String day, int blockSize, ConstraintContext context) {

        int requiredCapacity = getRequiredCapacity(timetable);
        Long deptId = timetable.getDepartment().getId();
        Long sectionId = timetable.getSection() != null ? timetable.getSection().getId() : null;

        // Theory blocks use non-lab rooms (same room type rule as single periods).
        List<Classroom> theoryRooms = allRooms.stream()
            .filter(r -> !"LAB".equalsIgnoreCase(r.getRoomType()))
            .filter(r -> isRoomEligibleForTimetable(r, timetable))
            .filter(r -> r.getCapacity() >= requiredCapacity)
            .toList();
        if (theoryRooms.isEmpty()) {
            // Relax capacity constraint as fallback
            theoryRooms = allRooms.stream()
                .filter(r -> !"LAB".equalsIgnoreCase(r.getRoomType()))
                .filter(r -> isRoomEligibleForTimetable(r, timetable))
                .toList();
        }
        if (theoryRooms.isEmpty()) return false;

        List<List<TimeSlot>> windows = buildConsecutiveWindows(allSlots, blockSize);
        if (windows.isEmpty()) return false;

        // Least-loaded faculty first — balances daily workload across the team.
        List<Faculty> orderedCandidates = candidates.stream()
            .sorted(Comparator.comparingInt(f ->
                context.getFacultyDailyHours().getOrDefault(f.getId() + "_" + day, 0)))
            .toList();

        for (Faculty faculty : orderedCandidates) {
            // Preferred-availability windows first (soft goal), original order otherwise.
            List<List<TimeSlot>> orderedWindows = orderWindowsByPreference(windows, faculty, day, context);
            for (List<TimeSlot> window : orderedWindows) {
                for (Classroom room : theoryRooms) {
                    CandidatePlacement placement = CandidatePlacement.builder()
                        .subject(subject)
                        .faculty(faculty)
                        .classroom(room)
                        .dayOfWeek(day)
                        .slots(window)
                        .departmentId(deptId)
                        .sectionId(sectionId)
                        .build();

                    if (evaluateAllConstraints(placement, context)) {
                        for (TimeSlot slot : window) {
                            TimetableEntry entry = entryMapper.buildEntry(
                                day, slot, subject, faculty, room, timetable.getSection(), false);
                            timetable.addEntry(entry);
                            registerEntryInContext(entry, context);
                        }
                        log.debug("    ✓ {} → {} P{}..P{} in {}", subject.getSubjectCode(), day,
                            window.get(0).getSlotOrder(),
                            window.get(window.size() - 1).getSlotOrder(),
                            room.getRoomNumber());
                        return true;
                    }
                }
            }
        }
        return false;
    }

    /**
     * Orders consecutive windows so windows whose slots ALL fall in the faculty's
     * PREFERRED availability are tried first (soft goal S4), keeping the original
     * window order otherwise.
     */
    private List<List<TimeSlot>> orderWindowsByPreference(List<List<TimeSlot>> windows,
            Faculty faculty, String day, ConstraintContext context) {
        return windows.stream()
            .sorted(Comparator.comparingInt((List<TimeSlot> window) -> {
                for (TimeSlot slot : window) {
                    String key = faculty.getId() + "_" + day + "_" + slot.getId();
                    String status = context.getAvailabilityMap().get(key);
                    if (!"PREFERRED".equalsIgnoreCase(status)) {
                        return 1 + slot.getSlotOrder(); // Non-preferred window
                    }
                }
                return 0; // All preferred
            }))
            .toList();
    }

    // =====================================================================
    // STEP 11 — Per-Slot Room Allocation
    // =====================================================================

    /**
     * Finds an available classroom for a specific (day, slot) combination.
     *
     * Room is selected PER SLOT, not globally for the subject.
     * This is the key fix for the old engine which pre-assigned a room and then
     * failed when that room happened to be busy for the chosen slot.
     *
     * Room selection criteria:
     *   1. Correct room type (LAB for labs, non-LAB for theory)
     *   2. Sufficient capacity
     *   3. Not occupied on this (day, slot)
     *   4. Among eligible rooms, pick the one with fewest total assignments (round-robin)
     */
    /**
     * Room scoping: a classroom owned by an academic year / section may only be
     * used by a timetable of the matching section (and its year). NULL scope
     * fields mean the room is global/shared and skip the corresponding check.
     * The classroom's department is organizational metadata, not a scheduling
     * filter, so a room remains usable by any department's timetable unless it
     * is explicitly tied to a year and/or section.
     */
    private boolean isRoomEligibleForTimetable(Classroom room, Timetable timetable) {
        if (room.getAcademicYear() != null) {
            Long sectionYearId = timetable.getSection() != null && timetable.getSection().getAcademicYear() != null
                ? timetable.getSection().getAcademicYear().getId()
                : null;
            if (sectionYearId == null || !room.getAcademicYear().getId().equals(sectionYearId)) {
                return false;
            }
        }
        if (room.getSection() != null) {
            Long sectionId = timetable.getSection() != null ? timetable.getSection().getId() : null;
            if (sectionId == null || !room.getSection().getId().equals(sectionId)) {
                return false;
            }
        }
        return true;
    }

    private Classroom findAvailableRoom(Subject subject, List<Classroom> allRooms,
            int requiredCapacity, String day, TimeSlot slot, ConstraintContext context,
            boolean isLab, Timetable timetable) {

        String slotKey = day + "_" + slot.getId();
        Set<Long> occupiedRooms = context.getRoomOccupancy().getOrDefault(slotKey, Collections.emptySet());

        List<Classroom> eligible = allRooms.stream()
            .filter(r -> isLab
                ? "LAB".equalsIgnoreCase(r.getRoomType())
                : !"LAB".equalsIgnoreCase(r.getRoomType()))
            .filter(r -> r.getCapacity() >= requiredCapacity)
            .filter(r -> isRoomEligibleForTimetable(r, timetable))
            .filter(r -> !occupiedRooms.contains(r.getId()))
            .toList();

        if (eligible.isEmpty() && !isLab) {
            // Relax capacity constraint as fallback — theory rooms only. A
            // practical placement must NEVER silently use an under-capacity room,
            // so the LAB branch returns null (the caller reports it truthfully).
            eligible = allRooms.stream()
                .filter(r -> !"LAB".equalsIgnoreCase(r.getRoomType()))
                .filter(r -> isRoomEligibleForTimetable(r, timetable))
                .filter(r -> !occupiedRooms.contains(r.getId()))
                .toList();
        }

        if (eligible.isEmpty()) return null;

        // Round-robin: pick least-used eligible room
        return eligible.stream()
            .min(Comparator.comparingInt(r -> context.getRoomUsageCount().getOrDefault(r.getId(), 0)))
            .orElse(eligible.get(0));
    }

    // =====================================================================
    // STEP 11 — Constraint Evaluation Pipeline
    // =====================================================================

    /**
     * The hard-constraint pipeline in evaluation order (cheapest O(1) lookups
     * first, more complex logic last) so candidates fail fast. Shared by the
     * placement path and the failure diagnosis.
     */
    private List<SchedulingConstraint> hardConstraintPipeline() {
        return List.of(
            sectionClashConstraint,         // Section not already occupied this slot
            availabilityConstraint,        // Faculty availability (marked blocked)
            departmentPermissionConstraint, // Faculty can teach this department
            assignedSubjectConstraint,      // Faculty is qualified for this subject
            dailyHoursConstraint,           // Faculty daily 4-period limit
            weeklyHoursConstraint,          // Faculty weekly hours limit
            consecutiveTeachingConstraint,  // Max 2 consecutive, then 2 free — NEW
            labBlockConstraint,             // Practical = N consecutive non-break periods
            roomTypeConstraint,             // LAB room for practicals, theory room for theory
            facultyClashConstraint,         // Faculty not already teaching this slot
            roomClashConstraint             // Room not already occupied this slot
        );
    }

    /**
     * Returns the FIRST hard constraint a candidate placement violates, or null
     * when every hard constraint is satisfied.
     */
    private SchedulingConstraint firstFailingConstraint(CandidatePlacement placement, ConstraintContext context) {
        if (placement.getSlots() == null || placement.getSlots().isEmpty()) return null;
        for (SchedulingConstraint constraint : hardConstraintPipeline()) {
            if (!constraint.isSatisfied(placement, context)) {
                return constraint;
            }
        }
        return null;
    }

    /**
     * Evaluates all hard constraints for a candidate placement.
     * Constraints are evaluated in order of cheapness (O(1) lookups first,
     * more complex logic last) to fail fast.
     *
     * NOTE: entryRepository is set to null in the context — all clash detection
     * uses in-memory maps only (no per-slot DB queries).
     */
    private boolean evaluateAllConstraints(CandidatePlacement placement, ConstraintContext context) {
        // Guard: slots must not be empty
        if (placement.getSlots() == null || placement.getSlots().isEmpty()) return false;

        for (SchedulingConstraint constraint : hardConstraintPipeline()) {
            if (!constraint.isSatisfied(placement, context)) {
                log.debug("  ✗ Constraint [{}]: {}",
                    constraint.getConstraintName(),
                    constraint.getViolationMessage(placement));
                return false;
            }
        }
        return true;
    }

    // =====================================================================
    // HELPERS
    // =====================================================================

    private int getRequiredCapacity(Timetable timetable) {
        if (timetable.getSection() != null && timetable.getSection().getStudentStrength() != null) {
            return timetable.getSection().getStudentStrength();
        }
        return 40; // Default minimum capacity
    }

    // =====================================================================
    // RANDOMISED SHUFFLING HELPERS
    // =====================================================================

    /**
     * Returns a new list with elements grouped by their sort key but shuffled
     * within each tie group. The comparator defines priority tiers (e.g. block
     * size first, hours second); within the same tier, elements are randomly
     * reordered so different subjects get first pick of scarce resources.
     */
    private <T> List<T> shuffleWithinTies(List<T> items, Comparator<? super T> comparator) {
        if (items.size() <= 1) return items;
        List<T> result = new ArrayList<>(items);
        int i = 0;
        while (i < result.size()) {
            int j = i + 1;
            while (j < result.size()
                    && comparator.compare(result.get(i), result.get(j)) == 0) {
                j++;
            }
            if (j - i > 1) {
                List<T> group = new ArrayList<>(result.subList(i, j));
                Collections.shuffle(group, rng);
                for (int k = 0; k < group.size(); k++) {
                    result.set(i + k, group.get(k));
                }
            }
            i = j;
        }
        return result;
    }
}
