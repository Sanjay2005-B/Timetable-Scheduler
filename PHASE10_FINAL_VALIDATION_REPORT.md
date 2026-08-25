# Phase 10 Final Validation Report — Subject Creator → AI Timetable Generator

**Status:** PASS — 10 Aug 2026
**Scope:** Prove the real Subject Creator → AI Timetable Generator connection end-to-end for BOTH engines (Greedy, Timefold), with truthful structured practical diagnostics, on isolated temporary data — then clean up and verify nothing else was touched.
**Acceptance criterion:** Schedules are driven **dynamically** by `theoryHours + practicalHours + sessionBlockSize` from the database, never by fixed totals.

---

## 1. Mandated answers

| Question | Answer | Evidence |
|---|---|---|
| Existing data modified/deleted? | **NO** | Only temporary `VAL*`-prefixed records (fresh department → year → section → subject → faculty → availability per test) were created; each test is `@Transactional` (auto-rollback) plus an explicit `finally` cleanup. No mentor-created subject, faculty, classroom, availability, department, section or timetable was touched. Runtime scratch (exploded `org/`, `ai/`, `.bugrepro-token.txt`, `.repro-dept.txt`, `*.log`) was deleted after validation. |
| Temporary data created? | **YES** | Isolated H2 in-memory hierarchy per scenario (prefixes `VALDYN`, `VALCAP`, `VALAVL`, `VALBLK`, `VALREG`). Verified gone after the run (rollback + cleanup). |
| Fake LAB created? | **NO** | Practicals use only the real seeded LAB room `CS-LAB1` (capacity 40). A practical is never placed in `LECTURE_HALL` and never in an undersized LAB. `practicalHours=0` → zero lab lessons. |
| Hard constraints weakened? | **NO** | Capacity, room-type, availability, daily/weekly caps, faculty/section/room clash, consecutive-teaching and lab-block rules are all hard for both engines. Infeasible cases are reported truthfully (never "SOLVER_INFEASIBLE" soft-rollback). |
| Demand hard-coded? | **NO** | Same subjects re-generated after DB mutations: 7 → 8 → 6 entries. `sessionBlockSize` 1/2/3 drives exact session shapes. No fixed 36/6/42 totals anywhere. |

## 2. Scenario results (exact observed values)

Engine = Greedy and Timefold both; metrics identical unless noted. `FINAL_VALIDATION_METRIC` lines captured from the test run.

### Scenario 1 — dynamic demand reacts to database changes (`subjectCreator_dynamicDemand_reactsToDatabaseChanges`)
Temp hierarchy: fresh Department → 1st Year → Section A (strength 40) → Semester 1. Faculty `VALFAC*`, subjects `VALA` (theory), `VALB` (lab-only).

| Gen | DB values | Expected demand | Entries | Theory (VALA) | Lab (VALB) | Session shape | Conflicts | Unassigned |
|---|---|---|---|---|---|---|---|---|
| 1 | A theory=5; B practical=2, block=2 | 5+2=**7** | 7 | 5 | 2 | `[2]` | 0 | 0 |
| 2 | B practical=3, block=3 | 5+3=**8** | 8 | 5 | 3 | `[3]` | 0 | 0 |
| 3 | A theory=3 | 3+3=**6** | 6 | 3 | 3 | `[3]` | 0 | 0 |

`metrics: dynamic\|gen1=7, gen2=8, gen3=6 (both engines)`. All lab entries `roomType=LAB`, capacity ≥ 40. A (practical 0) created zero lab rows.

### Scenario 2 — infeasible LAB capacity (`infeasibleLabCapacity_reportsStructuredDiagnostic`)
Section strength **100**, largest LAB capacity **40** (`CS-LAB1`). Lab-only subject `VALC`, practical=2, block=2.

| Engine | Entries | Conflicts | Conflict type | Key diagnostic text (verified) |
|---|---|---|---|---|
| Greedy | 0 | 1 | `LAB_CAPACITY_INSUFFICIENT` | `Subject VALC…: practical demand 2, required block 2, required room type LAB, required capacity 100… no LAB room with capacity >= 100; largest available LAB capacity is 40` |
| Timefold | 0 | 1 | `PRACTICAL_UNAVAILABLE` | `VALC…: requested 2 practical period(s), assigned 0, unassigned 2. No eligible LAB room: required capacity is 100 but the largest LAB room holds 40` |

No `SOLVER_INFEASIBLE` weakening. Section strength untouched (stayed 100). No LECTURE_HALL/undersized-LAB placement.

### Scenario 3 — faculty availability (`facultyAvailability_failureNamesAvailabilityNotCapacity`)
Lab fits capacity (strength 40), but the assigned faculty is `BLOCKED` in every teaching slot. Subject `VALD` practical=2, block=1.

| Engine | Entries | Conflict type | Reason (verified) |
|---|---|---|---|
| Greedy | 0 | `PRACTICAL_BLOCK_UNAVAILABLE` | `Blocked by: faculty unavailable (blocked/busy/leave) in N candidate window(s). Eligible LAB rooms: CS-LAB1` |
| Timefold | 0 | `PRACTICAL_UNAVAILABLE` | `…assigned 0, unassigned 2… the faculty is blocked/busy during that window` |

Diagnostic names **availability**, never capacity (`assertFalse` on `LAB_CAPACITY_INSUFFICIENT` / `capacity >=`).

### Scenario 4 — block sizes 1 / 2 / 3 (`blockSizes_1_2_3_produceExactSessionsAndEnginesAgree`)
Three lab-only subjects `VAL1/VAL2/VAL3`, each practical=3, block sizes 1 / 2 / 3. Section strength 40.

| Subject | Block | Sessions observed | Both engines |
|---|---|---|---|
| VAL1 | 1 | `[1, 1, 1]` | agree |
| VAL2 | 2 | `[1, 2]` | agree |
| VAL3 | 3 | `[3]` | agree |

All 3×3 = 9 practical periods placed, all `isLab`, all LAB rooms, capacity ≥ 40, no run exceeds the block size, 0 conflicts.

### Scenario 5 — partial regeneration (`partialRegeneration_preservesLocked_backfillsExactRemainder`)
Subject `VALR` theory=3, practical=2, block=2. Generate → 5 entries. Lock **2 theory** entries. Delete unlocked rows (`deleteUnlockedByTimetableId`), reload, regenerate unlocked only.

| Engine | Total after | Theory | Practical | Locked preserved (day/slot/room/subject/faculty) | Clashes | Conflicts |
|---|---|---|---|---|---|---|
| Greedy | **5** | 3 | 2 | 2/2 intact | 0 | 0 |
| Timefold | **5** | 3 | 2 | 2/2 intact | 0 | 0 |

Locked THEORY demand subtracted only from theory demand; no double-scheduling; exact remainder backfilled.

## 3. Test matrix

| Test class | Engine | Tests | Result |
|---|---|---|---|
| `GreedyFinalValidationE2ETest` | greedy (`timetable.scheduler.engine=greedy`) | 5 | 5/5 PASS |
| `TimefoldFinalValidationE2ETest` | timefold (`@TestPropertySource` override) | 5 | 5/5 PASS |
| **Both-engine validation subtotal** | | **10** | **10/10 PASS** |

Each scenario runs on `@ActiveProfiles("h2")` (`jdbc:h2:mem:timetabledb`, `ddl-auto: update`, flyway off), `@Transactional` rollback + explicit `finally` cleanup of the `VAL*` hierarchy.

## 4. Full regression (post-changes)

| Suite | Result |
|---|---|
| Backend `mvn test` (full) | **209 tests, 0 failures, 0 errors** — BUILD SUCCESS |
| Frontend `tsc -b` | PASS |
| Frontend `vite build` | PASS |

## 5. Frontend grid (chore re-verified)

- Grid renders the configured TimeSlot master in `slotOrder` (fetched from `/availability/time-slots`, breaks excluded, sorted by `slotOrder`) — `TimetablePage.tsx:116-120,257`.
- LAB identified exclusively by `TimetableEntryDto.isLab` (`TimetablePage.tsx:280`); removed the `?? subjectType === 'LAB'` fallback so no LAB inference from subject/room metadata remains. Backend always populates `isLab` non-null (`TimetableService.java:184`).
- Unscheduled demand is never hidden as "Free Period" — empty cells render empty (`TimetablePage.tsx:272-277`); unscheduled demand surfaces as truthful conflict records.

## 6. Files added for this phase

- `backend/src/test/java/.../engine/AbstractFinalValidationE2ETest.java`
- `backend/src/test/java/.../engine/GreedyFinalValidationE2ETest.java`
- `backend/src/test/java/.../engine/TimefoldFinalValidationE2ETest.java`
- `frontend/src/pages/timetable/TimetablePage.tsx` (isLab-only LAB identification)
- `PHASE10_FINAL_VALIDATION_REPORT.md` (this file)

No production engine/schema code changed in this phase; the Greedy/Timefold structured diagnostics (`practicalBlockConflict`, `reportUnassignedLessons`, `diagnoseLabPlacementFailure`) were completed in the prior phase and are validated here.
