package com.erp.timetable.module.timetable.engine.shared;

import com.erp.timetable.module.subject.entity.Subject;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.Set;

/**
 * Calculates subject demand — weekly hours per subject and session block sizes —
 * and builds the weekly distribution plan for theory subjects.
 *
 * All logic is deterministic and depends only on master data (no randomness).
 */
@Service
@Slf4j
public class SubjectDemandService {

    public static final List<String> WORKING_DAYS =
        List.of("MON", "TUE", "WED", "THU", "FRI", "SAT");

    /**
     * Global fallback practical block size
     * ({@code timetable.scheduler.practical-block-size}, default 2). Used ONLY
     * when a subject has no stored block configuration (null/absent value); it
     * never overrides an explicit per-subject sessionBlockSize of 1, 2 or 3.
     */
    @Value("${timetable.scheduler.practical-block-size:2}")
    private int globalPracticalBlockSize;

    /**
     * Calculates how many periods per week each subject requires: the sum of its
     * theory and practical hours, independent of the subject type. A subject with
     * zero theory and zero practical hours contributes nothing.
     */
    public Map<Long, Integer> calculateWeeklyHours(List<Subject> subjects) {
        Map<Long, Integer> map = new HashMap<>();
        for (Subject s : subjects) {
            int theory = s.getTheoryHours() != null ? s.getTheoryHours() : 0;
            int practical = s.getPracticalHours() != null ? s.getPracticalHours() : 0;
            map.put(s.getId(), theory + practical);
        }
        return map;
    }

    public void logSubjectWeeklyHours(List<Subject> subjects, Map<Long, Integer> weeklyMap) {
        for (Subject s : subjects) {
            log.info("  {} [{}] — {} period(s)/week", s.getSubjectCode(), s.getSubjectType(),
                weeklyMap.getOrDefault(s.getId(), 0));
        }
    }

    /**
     * Logs the per-subject demand breakdown used to verify 42/42 scheduling:
     * {@code Subject | Theory | Practical | Expected (= theory + practical) |
     * Created lessons}. When {@code createdLessonsBySubject} is null, the
     * "Created" column reports the expected count (the lesson plan every engine
     * must produce before solving).
     */
    public void logDemandBreakdown(List<Subject> subjects, Map<Long, Integer> createdLessonsBySubject) {
        log.info("  ── SUBJECT DEMAND BREAKDOWN ──────────────────────────────────────");
        log.info("  {:<12} {:<8} {:<10} {:<10} {:<12}", "Subject", "Theory", "Practical", "Expected", "Created");
        int expectedTotal = 0;
        int createdTotal = 0;
        for (Subject s : subjects) {
            int theory = s.getTheoryHours() != null ? s.getTheoryHours() : 0;
            int practical = s.getPracticalHours() != null ? s.getPracticalHours() : 0;
            int expected = theory + practical;
            int created = createdLessonsBySubject != null
                ? createdLessonsBySubject.getOrDefault(s.getId(), 0) : expected;
            expectedTotal += expected;
            createdTotal += created;
            log.info("  {:<12} {:<8} {:<10} {:<10} {:<12}",
                s.getSubjectCode(), theory, practical, expected, created);
        }
        log.info("  ──────────────────────────────────────────────────────────────────");
        log.info("  {:<12} {:<8} {:<10} {:<10} {:<12}", "TOTAL", "-", "-", expectedTotal, createdTotal);
        log.info("  DEMAND CHECK: expected={}, created={}", expectedTotal, createdTotal);
    }

    /**
     * Returns the configured consecutive-period block size for a theory subject,
     * clamped to the valid 1–3 range. LAB subjects always fall back to 1 here —
     * their practical sessions are blocked by the lab scheduler via
     * {@link #getPracticalBlockSize(Subject)}.
     */
    public int getSessionBlockSize(Subject subject) {
        if ("LAB".equalsIgnoreCase(subject.getSubjectType())) return 1;
        Integer blockSize = subject.getSessionBlockSize();
        if (blockSize == null || blockSize < 1) return 1;
        return Math.min(blockSize, 2);
    }

    /**
     * Returns the consecutive-period block size for a subject's PRACTICAL
     * component (the size of a single practical session in a LAB room).
     *
     * <p>The Subject Creator's configured {@code sessionBlockSize} is the source
     * of truth and is honored verbatim:
     * <ul>
     *   <li>1 → each practical session occupies ONE consecutive period,</li>
     *   <li>2 → TWO consecutive periods,</li>
     *   <li>3 → THREE consecutive periods.</li>
     * </ul>
     * The global {@code timetable.scheduler.practical-block-size} (default 2) is
     * used ONLY when the stored value is null/absent (detached planning models
     * without a mapped value); it never overrides an explicit 1.
     */
    public int getPracticalBlockSize(Subject subject) {
        Integer blockSize = subject.getSessionBlockSize();
        if (blockSize == null) {
            return globalPracticalBlockSize;
        }
        return Math.min(Math.max(blockSize, 1), 2);
    }

    /**
     * One theory session: a run of {@code blockSize} consecutive periods (or a
     * single period when {@code blockSize == 1}) to be placed on {@code day}.
     */
    public record DistributionEntry(String day, int blockSize) {
    }

    /**
     * Builds the weekly theory distribution plan. Each subject's periods are
     * placed on distinct working days whenever possible:
     *
     * <ul>
     *   <li>{@code blockSize == 1} (single periods): {@code H} days of 1 period
     *       each (e.g. 5/wk → Mon=1, Tue=1, Wed=1, Thu=1, Fri=1).</li>
     *   <li>{@code blockSize == 2} (double periods): a mix of back-to-back
     *       double-period days and single-period days that sums to {@code H}:
     *       {@code doubleDays = max(0, H - 5)}, {@code singleDays = H - doubleDays*2},
     *       yielding e.g. 8/wk → 2+2+2+1+1 across 5 days.</li>
     * </ul>
     *
     * <p>The target days are chosen to keep the WHOLE-CLASS week balanced and
     * never plan more periods onto a day than the section can physically hold:
     * each preferred day-size is assigned to the LEAST-LOADED day that still has
     * enough free capacity, and the planned load is tracked across subjects so
     * two subjects never over-plan the same day. When no day can hold a
     * preferred block, the subject's remaining periods spill onto the days with
     * the MOST remaining capacity (spreading is a soft goal; hard constraints rule).
     *
     * <p>The returned list contains one {@link DistributionEntry} per SESSION (a
     * block of the subject's block size, or a single for the remainder), so a
     * subject's periods cluster onto the target days while the sessions still
     * follow the per-subject sessionBlockSize. Days repeat when one day must
     * hold several sessions. Locked days (partial regeneration) are excluded.
     *
     * @param occupiedDays days already covered by locked entries (partial regeneration)
     * @param dayCapacity  free teaching periods the section can still hold per day
     *                     (per-day teaching-slot count minus the practical and
     *                     locked periods already placed on that day)
     * @param facultyDayCapacity  per subject, the remaining daily teaching periods
     *                     of the subject's assigned faculty per day (its own daily
     *                     cap minus the lab/locked periods already placed on that
     *                     day). A subject is never planned onto a day where its
     *                     faculty is already at the daily limit — otherwise the
     *                     section's least-loaded day could still reject the plan
     *                     at placement time and the theory would spill onto extra
     *                     days (the own-lab faculty-cap trap). Missing keys mean
     *                     no faculty constraint (no assigned faculty).
     */
    public Map<Long, List<DistributionEntry>> buildTheoryDistributionPlan(List<Subject> theorySubjects,
            Map<Long, Integer> weeklyHoursMap, Map<Long, Set<String>> occupiedDays,
            Map<String, Integer> dayCapacity, Map<Long, Map<String, Integer>> facultyDayCapacity) {
        return buildTheoryDistributionPlan(theorySubjects, weeklyHoursMap, occupiedDays, dayCapacity, facultyDayCapacity, null);
    }

    /**
     * Overload accepting a seeded {@link Random} for controlled day shuffling.
     * When non-null, the list of candidate days passed to
     * {@link #leastLoadedFittingDay} and {@link #mostFreeDay} is shuffled
     * before evaluation so different subjects claim different days while still
     * respecting capacity. When null, behaviour is fully deterministic.
     */
    public Map<Long, List<DistributionEntry>> buildTheoryDistributionPlan(List<Subject> theorySubjects,
            Map<Long, Integer> weeklyHoursMap, Map<Long, Set<String>> occupiedDays,
            Map<String, Integer> dayCapacity, Map<Long, Map<String, Integer>> facultyDayCapacity,
            Random rng) {
        Map<Long, List<DistributionEntry>> plan = new HashMap<>();
        Map<String, Integer> plannedLoad = new HashMap<>();

        for (int subjectIndex = 0; subjectIndex < theorySubjects.size(); subjectIndex++) {
            Subject subject = theorySubjects.get(subjectIndex);
            int weeklyHours = weeklyHoursMap.getOrDefault(subject.getId(), 0);

            if (weeklyHours <= 0) {
                plan.put(subject.getId(), List.of());
                continue;
            }

            int blockSize = Math.min(getSessionBlockSize(subject), Math.max(1, weeklyHours));

            List<String> availableDays = new ArrayList<>(WORKING_DAYS.stream()
                .filter(d -> !occupiedDays.getOrDefault(subject.getId(), Set.of()).contains(d))
                .toList());
            if (rng != null) {
                Collections.shuffle(availableDays, rng);
            }
            if (availableDays.isEmpty()) {
                plan.put(subject.getId(), List.of());
                continue;
            }

            // Preferred pattern: each preferred day-size goes to the least-loaded
            // day that still has enough free capacity (whole-class balance) and
            // room for the subject's faculty (own-lab faculty-cap trap).
            Map<String, Integer> facultyCap = facultyDayCapacity.getOrDefault(subject.getId(), Map.of());
            Map<String, Integer> assigned = new LinkedHashMap<>();
            for (int size : idealDaySizes(weeklyHours, blockSize)) {
                List<String> mainLoopCandidates = blockSize <= 1
                    ? availableDays.stream().filter(d -> !assigned.containsKey(d)).toList()
                    : availableDays;
                String bestDay = leastLoadedFittingDay(mainLoopCandidates, plannedLoad, dayCapacity, facultyCap, size);
                if (bestDay == null) {
                    break;
                }
                plannedLoad.merge(bestDay, size, Integer::sum);
                assigned.merge(bestDay, size, Integer::sum);
            }

            // Spill the remainder onto the days with the most remaining capacity
            // so the subject still keeps the minimum number of teaching days.
            // For blockSize=1, each period must land on its OWN day — never more
            // than 1 per day — so only UNASSIGNED days are considered.
            int remaining = weeklyHours
                - assigned.values().stream().mapToInt(Integer::intValue).sum();
            while (remaining > 0) {
                List<String> spillCandidates = blockSize <= 1
                    ? availableDays.stream().filter(d -> !assigned.containsKey(d)).toList()
                    : availableDays;
                String bestDay = mostFreeDay(spillCandidates, plannedLoad, dayCapacity, facultyCap);
                if (bestDay == null) {
                    break;
                }
                int free = Math.min(
                    dayCapacity.getOrDefault(bestDay, Integer.MAX_VALUE)
                        - plannedLoad.getOrDefault(bestDay, 0),
                    facultyCap.getOrDefault(bestDay, Integer.MAX_VALUE));
                int chunk = Math.min(remaining, Math.max(0, free));
                if (blockSize <= 1) {
                    chunk = Math.min(chunk, 1);
                }
                if (chunk <= 0) {
                    chunk = 1; // every day fully planned — degrade onto the least-loaded day
                }
                plannedLoad.merge(bestDay, chunk, Integer::sum);
                assigned.merge(bestDay, chunk, Integer::sum);
                remaining -= chunk;
            }

            // Last resort: spread any still-unplaced remainder one-per-day across
            // the least-loaded days.  For blockSize=1 each remaining period must
            // land on its OWN day; for blockSize>1 the full remainder is placed on
            // the single least-loaded day (backward-compatible clustering).
            if (remaining > 0) {
                if (blockSize <= 1) {
                    // Phase 1: fill unused days first (one period per day).
                    List<String> unassignedDays = availableDays.stream()
                        .filter(d -> !assigned.containsKey(d))
                        .sorted(Comparator.comparingInt(d -> plannedLoad.getOrDefault(d, 0)))
                        .toList();
                    for (String day : unassignedDays) {
                        if (remaining <= 0) break;
                        plannedLoad.merge(day, 1, Integer::sum);
                        assigned.merge(day, 1, Integer::sum);
                        remaining--;
                    }
                    // Phase 2: if still remaining, genuinely forced — place on the
                    // least-loaded already-used day(s) and log it clearly.
                    if (remaining > 0) {
                        List<String> alreadyUsedDays = availableDays.stream()
                            .filter(d -> assigned.containsKey(d))
                            .sorted(Comparator.comparingInt(d -> plannedLoad.getOrDefault(d, 0)))
                            .toList();
                        for (String day : alreadyUsedDays) {
                            if (remaining <= 0) break;
                            log.warn("  ⚠ Last resort: forced 2nd period on {} — only {} unassigned day(s) available for {} required",
                                day, unassignedDays.size(),
                                unassignedDays.size() + alreadyUsedDays.size());
                            plannedLoad.merge(day, 1, Integer::sum);
                            assigned.merge(day, 1, Integer::sum);
                            remaining--;
                        }
                    }
                } else {
                    String lastDay = availableDays.stream()
                        .min(Comparator.comparingInt(d -> plannedLoad.getOrDefault(d, 0)))
                        .orElse(availableDays.get(0));
                    plannedLoad.merge(lastDay, remaining, Integer::sum);
                    assigned.merge(lastDay, remaining, Integer::sum);
                }
            }

            // Decompose each target day's size into blockSize sessions + singles.
            // A day smaller than blockSize becomes singles only; the total always
            // equals the subject's weekly hours (block placement is a soft goal).
            List<DistributionEntry> entries = new ArrayList<>();
            for (Map.Entry<String, Integer> dayEntry : assigned.entrySet()) {
                String day = dayEntry.getKey();
                int daySize = dayEntry.getValue();
                int blocks = daySize / blockSize;
                int singles = daySize % blockSize;
                for (int k = 0; k < blocks; k++) {
                    entries.add(new DistributionEntry(day, blockSize));
                }
                for (int k = 0; k < singles; k++) {
                    entries.add(new DistributionEntry(day, 1));
                }
            }

            plan.put(subject.getId(), entries);
        }
        return plan;
    }

    /**
     * The least-loaded day whose planned load plus {@code size} still fits within
     * its section capacity AND whose assigned-faculty daily capacity can hold
     * {@code size}, or {@code null} when no day qualifies. Days tied on load are
     * resolved by the most remaining free capacity (the binding one — section or
     * faculty, whichever is tighter), so a day already holding a practical/locked
     * block (or a faculty already near its daily cap) is skipped in favour of an
     * emptier day — keeping the subject's sessions on its minimum teaching days
     * instead of spilling over a boundary the section or faculty cap creates.
     */
    private String leastLoadedFittingDay(List<String> days, Map<String, Integer> load,
            Map<String, Integer> capacity, Map<String, Integer> facultyCapacity, int size) {
        String best = null;
        int bestLoad = Integer.MAX_VALUE;
        int bestFree = -1;
        for (String day : days) {
            int dayLoad = load.getOrDefault(day, 0);
            int dayCapacity = capacity.getOrDefault(day, Integer.MAX_VALUE);
            int facultyFree = facultyCapacity.getOrDefault(day, Integer.MAX_VALUE);
            if (dayLoad + size > dayCapacity || size > facultyFree) {
                continue;
            }
            int free = Math.min(dayCapacity - dayLoad, facultyFree);
            if (dayLoad < bestLoad || (dayLoad == bestLoad && free > bestFree)) {
                bestLoad = dayLoad;
                bestFree = free;
                best = day;
            }
        }
        return best;
    }

    /**
     * The day with the most unused capacity — the binding one (section or
     * faculty) — tie-broken by the working-day order so results stay
     * deterministic, or {@code null} when every day is full.
     */
    private String mostFreeDay(List<String> days, Map<String, Integer> load,
            Map<String, Integer> capacity, Map<String, Integer> facultyCapacity) {
        String best = null;
        int bestFree = 0;
        for (String day : days) {
            int free = Math.min(
                capacity.getOrDefault(day, Integer.MAX_VALUE) - load.getOrDefault(day, 0),
                facultyCapacity.getOrDefault(day, Integer.MAX_VALUE));
            if (free > bestFree) {
                bestFree = free;
                best = day;
            }
        }
        return bestFree > 0 ? best : null;
    }

    /**
     * Ideal periods-per-day pattern for {@code H} weekly theory periods.
     *
     * <p>When {@code blockSize == 1} (single-period sessions), each period
     * lands on its own day — {@code H} days of size 1 (e.g. 5/wk →
     * Mon=1, Tue=1, Wed=1, Thu=1, Fri=1).
     *
     * <p>When {@code blockSize == 2} (double-period sessions), the pattern
     * is derived from the formula:
     * <pre>
     *   doubleDays = max(0, H - 5)
     *   singleDays = H - (doubleDays * 2)
     * </pre>
     * This yields {@code doubleDays} days carrying 2 consecutive periods and
     * {@code singleDays} days carrying 1 period each.  The total number of
     * days used is {@code doubleDays + singleDays}; if that exceeds the
     * available working days the caller reports a scheduling conflict.
     *
     * <p>For {@code blockSize >= 3} (legacy, no longer settable via UI) the
     * old minimum-day clustering is retained for backward compatibility.
     */
    private List<Integer> idealDaySizes(int weeklyHours, int blockSize) {
        if (weeklyHours <= 0) return List.of();
        List<Integer> sizes = new ArrayList<>();

        if (blockSize <= 1) {
            // Each period lands on its own day — one session per day.
            for (int i = 0; i < weeklyHours; i++) {
                sizes.add(1);
            }
            return sizes;
        }

        if (blockSize == 2) {
            // When all periods fit as complete double blocks within one day,
            // cluster them (e.g. H=4 → [4] → decomposes to [2,2]).
            if (weeklyHours <= 5 && weeklyHours % blockSize == 0) {
                sizes.add(weeklyHours);
                return sizes;
            }
            int doubleDays = Math.max(0, weeklyHours - 5);
            int singleDays = weeklyHours - (doubleDays * 2);
            if (singleDays < 0) {
                doubleDays = weeklyHours / 2;
                singleDays = weeklyHours - (doubleDays * 2);
            }
            for (int i = 0; i < doubleDays; i++) {
                sizes.add(2);
            }
            for (int i = 0; i < singleDays; i++) {
                sizes.add(1);
            }
            return sizes;
        }

        // Legacy blockSize >= 3: cluster onto minimum days (ceil(H / 5)).
        int remaining = weeklyHours;
        while (remaining > 5) {
            sizes.add(5);
            remaining -= 5;
        }
        if (remaining > 0) sizes.add(remaining);
        return sizes;
    }
}
