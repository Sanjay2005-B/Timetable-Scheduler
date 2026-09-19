# Project Memory — Timetable Scheduler

Shared known-facts for anyone working in this repo. Update freely; keep entries
short and factual.

## 42-slot capacity requirement — CONFIRMED COMPLETE + FROZEN (18-09-2026)

- The user audited the implementation (read-only) and CONFIRMED the 42-slot
  capacity rule is satisfied. NO further changes are permitted for this
  requirement; treat it as FROZEN. Keep: 6 working days (MON–SAT) × 7 periods
  per day = 42 max slots per class/section/week; never a 43rd slot, never an
  8th period, never a 7th working day, never overbook an existing slot;
  workload > 42 → `CAPACITY_EXCEEDED` conflict (entries stay ≤ capacity);
  workload < 42 → Free Periods fill the remainder.
- Do NOT modify: Greedy engine, Timefold engine, frontend timetable grid,
  time-slot master, database, migrations, RBAC, tenant isolation.
- Required next behavior: mark COMPLETE, wait for the next instruction. Do NOT
  invent new work for this requirement.

## Greedy engine 3-defect fix on the live 42-demand curriculum — 19-09-2026 (greedy-only, minimal)

- TARGET (user-directed, NEW, supersedes the FROZEN "do not modify the engine" note — the FROZEN
  42-slot CAPACITY SEMANTICS themselves are untouched and re-verified): the live CSE Section 662 /
  sem 1 dataset had three scheduling defects on the exact-42 curriculum — (1) 41/42: the last
  theory period of CS876 was stranded (mop-up skipped any day where the blockSize≤1 subject already
  had a period, and the ONLY free slot left was SAT s8 where CS876 already owned SAT s7);
  (2) all 3 labs clustered MON/TUE/WED; (3) all 3 labs started P1+P2.
- FIX (3 minimal edits in `TimetableGeneratorEngine.java`, ZERO constraint weakening, ZERO service/
  schema/RBAC/Timefold/frontend changes):
  1. STEP 8 DAY ROTATION: replaced the fixed `LAB_DAYS.get((practicalBlockIndex + d) % totalDays)`
     (always restarts at MON) with a deterministic, per-timetable base + stride rotation
     (`baseDay = section.getId() % totalDays`, `dayStride = max(1, totalDays/2)`). 3 labs on the
     5 non-SAT days now land on 3 DISTINCT, NON-CONSECUTIVE days (e.g. MON/WED/FRI or TUE/THU/MON
     depending on the section id) instead of MON/TUE/WED. Never SAT (LAB_DAYS excludes it).
  2. STEP 8 START-PERIOD ROTATION: the consecutive-window scan used to start at the first free
     window (always P1+P2). Now `windowStart = (baseWindow + practicalBlockIndex * windowStride)
     % windows.size()` with `windowStride = max(1, windows.size()/2)` — the 3 labs start at
     DIFFERENT periods. Each candidate window is STILL a strict consecutive non-break run
     (buildConsecutiveWindows unchanged → P3+P4 always valid, P3+P5 impossible), so lab
     consecutiveness (Requirement 5) is preserved by construction; `windows` is now built once
     and an empty-window guard returns NO_CONSECUTIVE_WINDOW (same semantics as before).
  3. STEP 10d MOP-UP LAST RESORT: after the existing guarded per-day sweep fails for a blockSize≤1
     subject's missing period, a second sweep WITHOUT the one-period-per-day guard runs (only for
     blockSize≤1, only when the guarded pass failed). This fills the stranded 42nd slot (SAT s8 for
     CS876) instead of leaving a gap + THEORY_SLOT_UNAVAILABLE. The one-period-per-day rule remains
     the normal spread; the repeat is the last-resort repair only.
- NEW TEST `TimetableGeneratorEngineCapacityAndLabDistributionTest` (2 tests, GREEN, isolated fresh
  department rolled back by @Transactional — no shared-seed pollution): (a) user's exact 42-demand
  curriculum (CS115 Physics 5T+2L, CS472 C 6T+2L, CS505 Tamil 5T, CS749 PT 2T, CS765 English 5T,
  CS864 Maths 8T, CS876 EVS 5T+2L; 3 subjectType=THEORY + practicalHours=2 exactly like the real DB)
  → **42 entries, every subject exactly at demand (Difference=0 everywhere), no conflicts, no
  double-book, no break slot, faculty ≤5/day**; (b) **shuffle-proof**: over 5 fresh generation runs
  the 3 labs ALWAYS land on 3 distinct non-consecutive days with ≥2 distinct start periods and stay
  one strict 2-period consecutive block each. Observed placements: CS115 TUE P2+P3, CS472 THU P6+P7,
  CS876 MON P1+P2 (day/period varies per shuffle; invariants hold).
- REGRESSION GATE (full `mvn -q clean test` 19-09): **356 tests, 14 failures, 0 errors** — the 14
  are EXACTLY the pre-change documented baseline (byte-identical names vs BOTH
  `runA-baseline` and `audit_step4_before`): GreedyDistribution 3, GreedyFinalValidation 3,
  TimefoldDistribution 2, TimefoldFinalValidation 3, TimefoldScheduleEngineIntegration 1,
  TimetableApiTimefoldFeasible 1, TimetableGeneratorEngineIntegration 1. **ZERO new failures**;
  `WeeklyCapacityValidationApiE2ETest` 3/3 GREEN (frozen capacity semantics intact); the flaky
  `TimetableApiGreedyE2ETest#regenerateUnlocked_tt1_preservesLockedEntries` (the 42↔41 same-family
  member) PASSED this run — the mop-up last-resort may be repairing it. FROZEN rule re-checked:
  42 demand == 42 capacity → no CAPACITY_EXCEEDED; entries never exceed 7/day → the 42-slot rule
  is untouched; below-42 (Free Periods) & above-42 (CAPACITY_EXCEEDED) tests unchanged.

## "Browser still shows 41/42" post-fix — LIVE investigation + regeneration (19-09-2026)

- USER REPORT: after "restarting the backend", the browser STILL showed 41/42, 1 Free Period, CS876
  THEORY_SLOT_UNAVAILABLE ×2, labs MON/TUE/WED P1+P2. VERDICT — all four of the user's hypotheses were
  partially right, and the decisive one was #2/#5: THE TIMETABLE IS PERSISTED. Restarting a backend does
  NOT regenerate an existing timetable.
- EVIDENCE (API, live): `GET /timetable/section/662/semester/1` BEFORE regen → id=316, `created_at
  2026-09-12 08:23:52` (7 days BEFORE the 19-09 engine fix), status GENERATED, **41 entries, conflictCount 2**,
  labs CS115→MON P1+P2 / CS472→TUE P1+P2 / CS876→WED P1+P2 — byte-exact what the browser rendered.
- BUILD-ARTIFACT FINDING (Part 8): `mvn clean test` DELETES the JAR; only `target/classes` is rebuilt, and
  no `mvn package` had been run since 15-09 → `backend/target/timetable-scheduler-1.0.0.jar` did **NOT exist**
  on disk (verified: no jar anywhere under D:\Timetable-Scheduler-main or C:\Users\Sanja). The .bat launchers
  (`start_server.bat`, `start_server4.bat`) run that jar → they could NOT have served the browser. Whatever
  backend was used, it either ran a stale build or — regardless of code — served the OLD PERSISTED row 316.
  FIX for the artifact gap: `mvn -q clean package -DskipTests` (rebuilds the missing jar); verified the new jar's
  `TimetableGeneratorEngine.class` contains the new markers ("mop-up same-day last resort", "section already has
  a lab block", "windowStride").
- NEW (user-specified) RULE ENFORCED in this phase — **One section + one day = AT MOST one lab block** (Part 3):
  added `sectionAlreadyHostsLabOnDay(timetable, day)` and a day-skip guard at the top of the STEP 8 day loop. Without
  it, two labs could share a day at DISJOINT slots (P3+P4 and P5+P6) — the clash checks only prevent same-(day,slot)
  collisions, not a second lab-block on the same day. Also re-confirmed: a 2-hour lab stays ONE strict consecutive
  block of 2 periods (buildConsecutiveWindows unchanged), break respected, no SAT lab, no P1+P2 bias (window rotation),
  no MON→TUE→WED cluster (day rotation, max-spread on the 5 non-SAT days).
- REGENERATED THROUGH THE EXISTING WORKFLOW (NOT a new mechanism, NOT row deletion): `POST /api/v1/timetable/generate`
  with `{"departmentId":510,"sectionId":662,"semester":1}` as admin — `TimetableService.generateTimetable` reuses row
  316 (findBySectionIdAndSemester → clears entries+conflicts → WeeklyCapacityValidator → engine → save). RESULT:
  **id=316, status GENERATED, 42 entries, conflictCount 0, 0 Free Periods, no duplicate (day,slot) cell (42 unique)**.
  Per subject EXACT demand: CS115 5T+2L, CS472 6T+2L, CS505 5T, CS749 2T, CS765 5T, CS864 8T, CS876 5T+2L.
  Lab blocks (one per day, all strict consecutive): CS472→TUE P2+P3, CS876→WED P3+P4, CS115→FRI P6+P7
  (orders 7+8); start periods P2/P3/P6 — no P1+P2.
- MATH NOTE (why 3 lab days always show one adjacent pair): labs may not use SAT (hard rule, assertLabRules), so
  the day pool is the 5-day cycle MON–FRI whose independence number is 2 — three labs can never be pairwise
  non-consecutive; the stride-2 rotation always picks a MAXIMALLY-spread 3-subset (never a 3-consecutive MON→TUE→WED
  run; exactly one unavoidable adjacent pair, e.g. {MON,WED,FRI} wraps FRI→MON). The user's "TUE+THU+SAT" example
  would require SAT labs, which the app forbids.
- RUN BOOK (fresh start on the dev DB): `mvn -q clean package -DskipTests` → `start_server4.bat` (jar, h2 profile →
  `${user.home}/.timetable-scheduler/data/timetabledb`, port 8080) → regenerate selected section via the Generate
  button (POST /timetable/generate). The grep/strings hygiene for a suspected-stale backend: java process list +
  listener check, jar mtime + jar-embedded class string scan, DB row created_at vs engine-fix timestamp, THEN
  regenerate — never judge the fix from a persisted timetable. PS 5.1 note: `cmd /c start ... java ... >> log` fails
  on the redirect ("filename, directory name... is incorrect"); a small `start_backend.cmd` wrapper worked and was
  removed after use.

## Runtime trace of the "browser still shows old timetable" report — 19-09-2026 (NO code change)

- VERDICT: the running backend (jar built 19-09 11:48, PID 12128, h2 profile, :8080) executes the FIXED
  TimetableGeneratorEngine; row 316 already holds the NEW 42-entry/0-conflict timetable. The browser showed
  old data because a running backend does NOT push changes to the browser: react-query caches
  `['sectionTimetable', collegeId, deptId, yearId, sectionId, semester]` from the last fetch, so a backend
  restart alone never updates the UI. The page refetches on mount (useQuery) — a refresh, or one click of
  "Run AI Generator" (onSuccess → invalidateQueries(sectionQueryKey)), renders the fresh 42/42 result.
- FULL CHAIN (verified): TimetablePage "Run AI Generator" → handleGenerate → timetableApi.generateTimetable
  → POST /timetable/generate → TimetableController.generateTimetable (@PreAuthorize rbacGuard.canGenerateTimetable)
  → TimetableService.generateTimetable (findBySectionIdAndSemester → REUSES row 316, clears
  entries+conflicts → WeeklyCapacityValidator.validate → generatorEngine.generateSchedule(timetable,false)
  → recordCapacityExceededConflict → save). generatorEngine = GreedyScheduleEngine bean
  (`timetable.scheduler.engine: greedy`, @ConditionalOnProperty matchIfMissing → TimetableGeneratorEngine).
  Browser path: Vite :5173 proxies /api → http://localhost:8080 (confirmed in vite.config.ts).
- LIVE EVIDENCE (API, all POST /timetable/generate {deptId:510, sectionId:662, semester:1}): BEFORE id=316
  42 entries c=0; 3 consecutive fresh generations ALWAYS id=316 (row reused, never a new row) n=42 c=0,
  every subject exact (CS115 5T+2L, CS472 6T+2L, CS505 5T, CS749 2T, CS765 5T, CS864 8T, CS876 5T+2L),
  42 unique day+slot cells, all days loaded 7/7, no second lab on any day. Per-run lab starts
  P2/P3/P6-style varied; subject→day mapping VARIES run to run (CS115: TUE→FRI→WED;
  CS472: FRI→TUE→TUE; CS876: WED→WED→FRI).
- MATH FACT for section 662: the day SET is deterministic {TUE,WED,FRI} every run
  (baseDay = 662 % 5 = 2, dayStride = 2 → blocks land on {2,4,1} mod 5 over LAB_DAYS). It is a
  maximally-spread 3-subset of the 5 non-SAT days — never MON/TUE/WED, never 3 consecutive; exactly one
  unavoidable adjacent pair (TUE/WED here; e.g. {MON,WED,FRI} has FRI→MON wrap adjacent). Only the
  subject-per-day assignment rotates. Making the DAY SET itself vary per generation (e.g. sometimes
  {MON,WED,FRI}, {TUE,THU,FRI}) would require randomizing/rotating baseDay per run — NOT done; the current
  result already satisfies "different days, not MON/TUE/WED".
- TEST GOTCHAS when a server is running: (a) `mvn clean` FAILS — it cannot delete the jar PID holds open
  ("Failed to delete target\timetable-scheduler-1.0.0.jar"); run plain `mvn test`. (b) @ActiveProfiles("h2")
  @SpringBootTest contexts open the DEV file DB → "Database may be already in use" while a server runs.
  Workaround used 19-09: run targeted tests on an isolated MEMORY h2 via
  `mvn test -Dtest=... -Dspring.datasource.url="jdbc:h2:mem:capfocus;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE"`.
  This does NOT touch the locked dev DB and does NOT require stopping the server. Focused engine test 2/2,
  WeeklyCapacityValidationApiE2ETest 3/3 (both green under the override). Full `mvn -q clean test` is only
  practical with the server stopped; the 19-09 full run (source unchanged since) stands at 356/14 baseline.
- Files changed this phase: NONE (runtime trace + verification only).

## Weekly-capacity validation (CAPACITY_EXCEEDED) — 18-09-2026 (backend-only)

- GAP FIXED: nothing previously verified that a class's curriculum could fit
  its weekly capacity; the greedy engine simply scheduled whatever it could and
  silently marked over-capacity work as normal (the invalid/no-data symptom the
  user chased was NOT the rendering phase — it was the missing capacity rule).
- NEW `engine/shared/WeeklyCapacityValidator.java`: `totalDemand` = Σ
  (theoryHours + practicalHours) over every subject `CurriculumDataLoader`
  returns for the timetable's section+semester; `weeklyCapacity` = `WORKING_DAYS`
  (MON–SAT, 6) × non-break `time_slots` master count (7 on the standard config)
  = **42**, BUT computed from master data at runtime — never hardcoded.
- `TimetableService` (the sole production caller of `ScheduleEngine` for both
  greedy AND timefold) now validates in `generateTimetable` and
  `regenerateUnlockedSlots`: the report is COMPUTED up front (before the engine
  runs), and when exceeded a `CAPACITY_EXCEEDED` conflict is ATTACHED AFTER the
  engine returns — attaching before the engine is futile because
  `LockPreservationService.prepareForGeneration` CLEARS `timetable.conflicts`
  at the start of generation (both full and unlocked-regen paths). conflictCount
  is re-accounted +1 to stay in sync with the row.
- Message: "Weekly workload exceeds available capacity: {demand} required
  periods for {capacity} available slots." Recorded via the existing
  `ConflictRecorderService.addConflict` severity HIGH — the conflict model
  already had `CAPACITY_EXCEEDED` in its allowed set, no schema change.
- Behavior matrix: demand < capacity → continue (Free Periods fill the
  remainder); demand == capacity → continue; demand > capacity → marked with
  the conflict AND the engine's day/window/cap constraints still forbid
  double-booking (slots are never overbooked; entries stay ≤ capacity).
- Tests `WeeklyCapacityValidationApiE2ETest` (3, green): demand 35 / 42 / 43 —
  below/equal continue without CAPACITY_EXCEEDED, above produces the conflict
  with the exact message and conflictCount ≥ 1, never overbooked. Uses arbitrary
  names/codes (CAPV*) to prove genericity; asserts deterministic capacity
  semantics only, NOT engine placement (avoid the flaky family).
- A/B VERIFIED on 18-09-2026: the only full-batch failures
  (`regenerateUnlocked_tt1_preservesLockedEntries` 42↔41 off-by-one,
  `TimetableApiTimefoldFeasibleE2ETest#generate_feasibleSeed...` [3] vs [1,1,1])
  reproduce BYTE-IDENTICALLY with the capacity code reverted — both are the
  documented pre-existing baseline, NOT caused by this phase. Clean-build green
  set: capacity 3, greedy-contract 1, timefold 2, cross-timetable 3, MultiCollege
  7, FacultyRole 9, CollegeRegistration 5, RoleBasedAccess 11 = 41/41.
- TOOLING GOTCHA (backend): PowerShell `Copy-Item` can restore a file with an
  mtime OLDER than the existing compiled `.class`, so a subsequent incremental
  `mvn test` silently runs the PREVIOUS (baseline) class bytecode — symptoms:
  code "exists in source" but its logs/behavior are absent. After any restore,
  do `mvn -q clean test ...` (or `mvn clean`) to force recompilation. The
  passing run and the failing run had IDENTICAL source; only the stale compiled
  class differed.
- ZERO engine/algorithm changes (both engines' placement untouched), zero DB
  schema/seed changes, zero frontend/RBAC/tenant changes.

## "No timetable available" for College Admin — FIXED 17-09-2026 (RbacGuard LazyInitialization)

- SYMPTOM: College Admin logs in, selects CSD → 1st Year → Section A → Semester
  1, and the page shows "No timetable available for this selection." even though
  a generated timetable EXISTS (e.g. timetable id 316, section 662, sem 1, 41
  entries on the dev H2 DB).
- ROOT CAUSE: `GET /timetable/section/{sectionId}/semester/{semester}` is
  guarded by `@PreAuthorize("@rbacGuard.canViewSectionTimetable(...)")`. That
  guard loads `Section`, then dereferences LAZY `Section.academicYear` → LAZY
  `AcademicYear.department` OUTSIDE any transaction (`open-in-view: false`) →
  `LazyInitializationException` → HTTP 500. The frontend `TimetablePage`
  `try/catch` swallows the error and returns null → renders the empty-state
  text. SUPER_ADMIN (`admin`) never hit it because its guard branch
  short-circuits BEFORE the lazy deref. Verified in server log: user 40
  (`esecac.in`, college 2 College Admin) → section 662 → 500 LazyInit on
  `AcademicYear#573`.
- FIX: `@Transactional(readOnly = true)` on the `RbacGuard` class
  (`config/security/RbacGuard.java`) so every guard check runs inside a
  read-only tx and lazy associations initialize. Single annotation; also covers
  `canManageTimetableEntry` (`TimetableEntry.timetable` is LAZY) and
  availability/faculty-report guards. ZERO engine/RBAC/isolation logic changes.
- VERIFIED: rebuilt jar 17-09 11:17, restarted on :8080. `esecac.in`
  (pw reset to `Verify@1234` on a TEMP COPY of the dev DB only — live dev DB
  password untouched) → `GET /timetable/section/662/semester/1` → 200, 41
  entries, conflictCount 2, session "2026-2027 ODD". `cse_admin` (HOD, CSE
  dept 228) reading section 250 (CSD dept 189) → clean 403 (legit: different
  dept), NOT 500. admin → 200 (unchanged). Frontend unchanged — the
  empty-state text only appears now for genuine 404/no-data.
- REGRESSION GATE: auth/RBAC suites green after the change: AuthFlow 18,
  RoleBasedAccess 11, MultiCollege 7, FacultyRole 9, CollegeRegistration 5
  (50 tests, 0 failures).
- LESSON: a "frontend looks wrong" report on this app may be a backend 500
  masked by a `try/catch { return null }`. Check the server log for
  `LazyInitializationException` before touching the frontend.

## Timetable VIEW generified for ALL selections — 18-09-2026 (frontend-only)

- SYMPTOM (reported): College Admin timetable view "shows a full/large grid
  (42/42)" and was feared to be hardcoded to CSD → 1st Year → Section A →
  Semester 1. INVESTIGATION: backend was already correct and generic (verified
  via live API: only timetable in the dev DB is id 316 = CSD dept 510 /
  section 662 / sem 1, 41 real entries, conflictCount 2, session "2026-2027
  ODD"; all other dept/year/section/sem combos → 404). The grid columns were
  previously derived ONLY from the selected timetable's own entries'
  `timeSlotTime` values → a packed timetable could only ever look "full"
  (every non-break teaching slot present → 6 days × 7 slots = 42 cells), and
  there was NO scheduled-count indicator, so 41/42 looked like "42/42".
- ROOT CAUSE (frontend rendering/count, NOT data, NOT RBAC): TimetablePage.tsx
  built columns from entries and showed no real count; the query key was a
  bare `['timetable', sectionId, semester]` (no college/dept/year ids → switch
  between two sections sharing semester could theoretically cache-collide).
- FIX (frontend only, backend/RBAC/engines untouched): `TimetablePage.tsx`
  now (1) fetches the time-slot MASTER via `availabilityApi.getTimeSlots()`
  (same source as MyTimetablePage/ReportsPage), filters `!isBreak`, sorts by
  `slotOrder`, and renders ALL configured teaching periods as grid columns —
  unscheduled periods fall back to the existing "Free Period" cell; (2) keys
  `entryMap` by `dayOfWeek + '_' + timeSlotId` when master slots are present,
  so cells line up with the master grid regardless of which periods a
  timetable actually uses; (3) adds a REAL count badge
  `{scheduledCount} / {availableSlots} Slots Scheduled` where scheduledCount =
  `timetable.entries.length` (41 in this DB) and availableSlots =
  non-break master slots × `DAYS` (7 × 6 = 42 here, but computed, NOT
  hardcoded), so a sparse/partial timetable reports e.g. 30/42, never a fake
  42/42; (4) scopes the query key to
  `['sectionTimetable', collegeId, departmentId, academicYearId, sectionId, semester]`
  (all real selected identifiers; department `collegeId` was added to the
  frontend `DepartmentResponse` type — backend already sends it); (5)
  generation invalidation now targets the exact per-selection key instead of
  a broad `['timetable']` prefix; NO `removeQueries` anywhere. Empty-state
  text "No timetable available for this selection." unchanged verbatim.
- Unchanged on purpose: DAYS (MON-SAT, matches engine WORKING_DAYS +
  MyTimetable/Reports convention), design/colors, `canGenerate` gating (HOD /
  EXAM_COORDINATOR / SUPER_ADMIN), RbacGuard `@Transactional(readOnly=true)`,
  ProfilePage.tsx, all engines/RBAC/tenant isolation.
- VERIFIED 18-09-2026: `npm run build` green (tsc + vite). Regression suites
  green (auth/RBAC only — backend untouched this phase): AuthFlow 18,
  RoleBasedAccess 11, MultiCollege 7, FacultyRole 9, CollegeRegistration 5 =
  50/50. Live API checks on :8080: master slots = 7 teaching × 6 days = 42
  available; section 662/sem1 → 200/41 entries (slot ids 1,2,3,4,6,7,8 —
  exactly the non-break master set); sections 663/sem3, 662/sem2, 250/sem1,
  306/sem1 → 404 (empty state). `lva092150` (COLLEGE_ADMIN col 34): sees only
  own CSE dept, own section 514 → 404 (genuine no-data, NOT 500), cross-college
  section 662 → 403. Browser verification NOT performed (API-level only).
- LESSON: "the view is hardcoded to one selection / shows 42/42" on this app is
  a FRONTEND RENDERING/COUNT issue (columns built from entries + no count
  badge), not a backend data problem — audit the grid column derivation and the
  count indicator before touching the backend or the cache layer.

## Known flaky / non-deterministic tests

- **`TimetableApiGreedyE2ETest#regenerateUnlocked_tt1_preservesLockedEntries`**
  is a PRE-EXISTING flaky test in the Greedy lock-preserving regenerate path
  (`POST /timetable/{id}/regenerate-unlocked` on the TT1 dataset). Off-by-one
  entry count: `expected: <42> but was: <41>` (or the reverse). Fails roughly
  1-in-8 runs; reports vary per authorizer. UNRELATED to auth/report/profile
  changes — when any timetable test shows an unexpected off-by-one, check if
  this one is the cause before treating it as a new regression.
- **Root mechanism of the flakiness family:** the engine places lessons by
  iterating HashMaps/HashSets (`module/timetable` Greedy + Timefold sources),
  and JVM iteration order for those collections is not guaranteed — it varies
  run to run and under different heap layouts. That is why the SAME full-suite
  run can deterministically pass a given engine test solo yet fail it in the
  suite, and why a "failing" method can vanish on the next identical run. Known
  members of this family: `regenerateUnlocked_tt1_preservesLockedEntries`
  (above) and
  `TimetableGeneratorEngineIntegrationTest#generateSchedule_placesConfiguredDoublePeriodAsConsecutiveBlock`
  (asserts `4 weekly hours must cluster onto a single day`; passes 3/3 solo,
  fails some full-suite runs). VERDICT (falsified by a revert experiment): NOT
  a deterministic regression — re-running clears it; do not chase it, do not
  patch the engine for it.
- **CURRENT `mvn test` baseline (post-RBAC 07-09-2026): 322 tests, 13
  failing** = ALL are members of the documented flaky engine family
  (Greedy/Timefold distribution-days, final-validation, engine integration,
  `generate_feasibleSeed_throughApi_isFullyFeasible`) with `regenerateUnlocked_tt1_preservesLockedEntries`
  present this run (±1; a given run shows 13–15). The new
  `RoleBasedAccessE2ETest` (11 tests) is green; all auth/department suites
  green; ZERO non-baseline failures introduced by RBAC. For any run that
  looks different: back up `target/surefire-reports` before re-running and
  diff failure names against the runA-baseline backup under
  `C:\Users\Sanja\AppData\Local\Temp\opencode\runA-baseline`.
- The API E2E suites (`ProfileApiE2ETest`, `InstitutionApiE2ETest`,
  `AbstractTimetableApiE2E` subclasses) authenticate via real logins or
  `@WithMockUser` — real logins exercise `JwtAuthenticationFilter`; the
  timetable API E2Es use `@WithMockUser` so the JWT filter is bypassed there.
- **`@WithMockUser` principal ≠ `UserPrincipal` (RBAC caveat):** engine API
  E2Es use `@WithMockUser(roles="HOD")` → principal is a Spring `MockUser`, so
  `RbacGuard.currentUser()` returns null → guard-wrapped endpoints would 403
  for them. Fixed by `RbacGuard.fallbackRoleAllowed(...)`: when the principal
  is NOT a `UserPrincipal`, guards fall back to coarse role-only checks from
  `authentication.getAuthorities()`. Real JWT logins always produce
  `UserPrincipal` → strict scoped checks. Production posture unchanged.
- **`@Valid` runs BEFORE method security (RBAC test-design caveat):** bean
  validation executes during argument resolution, i.e. before the
  `@PreAuthorize` interceptor — an invalid body (`{}`) yields 400, not 403.
  Authorization-denial tests must send VALID bodies so the guard actually runs.
- **`mvn test` re-confirmed 07-09-2026 (STEP 4 audit): 311 tests / 14
  failures, failing-method names byte-identical to runA-baseline (both diff
  directions zero).** 45 auth E2Es + `DepartmentServiceTest`(9)/`DepartmentPersistenceE2ETest`(1)
  all green. Backup at `C:\Users\Sanja\AppData\Local\Temp\opencode\audit_step4_before`.
- **"Department is broken" audit (Steps 1–5, 07-09-2026) verdict: NOT
  reproducible on current source/jar.** Full live department CRUD green
  (create w/ 4-year sections, faculty/subject/classroom attach, dependencies,
  archive/restore, delete-cascade), same on fresh H2. All dept/faculty/
  subject/classroom/availability source files untouched since 06-09-2026
  10:50 (last clean build). Root-cause candidates: the repo-root `*.bat`
  launchers (`start_server.bat`, `start_server4.bat`, `start_dept_test.bat`)
  all `cd` into a NON-EXISTENT `D:\Timetable Scheduling\backend` — any server
  started through them (or a stale deployed jar from that folder, now gone)
  does not represent this source tree. Evidence logs/scripts under
  `C:\Users\Sanja\AppData\Local\Temp\opencode\run_step3*.ps1` +
  `audit_step3*.log`. **FIXED 07-09-2026 (login audit):** all three `*.bat`
  launchers now `cd` to `D:\Timetable-Scheduler-main\backend` and log inside
  `backend/`.
- **Login/auth audit (07-09-2026) verdict: current source already uses real
  backend auth end-to-end — ZERO source code fixes needed.** Verified live
  against the default h2 DB (user home, real `admin/Admin@1234` with BCrypt-12)
  through the Vite proxy: `POST /api/v1/auth/login` 200, `GET /auth/me` 200,
  `POST /auth/refresh` 200 (rotates session), `POST /auth/logout` 200 (with
  Bearer; logout is NOT public — 401 without token), protected
  `/api/v1/departments` 200. Frontend base URL is `VITE_API_URL ?? '/api/v1'`
  (no `.env*` files exist → default). `LoginPage.tsx`/`authApi.ts`/
  `axiosClient.ts`/`authStore.ts` contain no demo-token/demo-refresh/fake
  auth; there is NO `/api/auth/*` literal and NO `/api/auth/session/status`
  anywhere in source. The user-reported `POST /api/auth/login 401` +
  `/api/auth/session/status` errors came from a STALE served build/old
  backend from the deleted `D:\Timetable Scheduling\backend` folder — not
  current code. One backend fact: root `.bat` launchers + stale build were
  the practical login blockers.
- **`SecurityConfig` PUBLIC_ENDPOINTS literal bug, FIXED 07-09-2026:**
  source had `/api/auth/login`, `/api/auth/refresh`,
  `/api/auth/forgot-password` — those patterns NEVER match because Spring
  Security matches the servlet path (`/auth/login`) once the context path
  `/api/v1` is stripped, so login/refresh were NOT public IN SOURCE and
  `AuthFlowE2ETest` failed 14/18 (401 entry point at `loginBody:86`).
  The deployed `target/*.jar` masked this because it was an OLD build whose
  patterns were `/auth/login` etc., so the running server accepted logins.
  FIX: changed the three literals back to `/auth/login`, `/auth/refresh`,
  `/auth/forgot-password` (same 3 lines as the known-good deployed jar;
  controller/SecurityConfig structure untouched). Rebuilt
  `mvn -q -DskipTests package` (LEAVE JAVA SERVERS STOPPED for the rebuild —
  jar file-lock). After rebuild + restart on 8080: live login 200 /
  wrong-pw 401 / me-protected 401-no-token / departments 200 / refresh 200 /
  logout 200 / `/api/auth/login` 404 / `/auth/session/status` 404; auth E2Es
  re-run GREEN: AuthFlow 18, Profile 10, Photo 9, Institution 8.

## Commands ~3–4 min. Surefire XML in
  `backend/target/surefire-reports/` (back these up before re-running if you
  need to diff results).
- Backend build: `mvn -q -DskipTests package` (kill any running java first —
  the jar is file-locked).
- Single test class: `mvn test -Dtest=<ClassName>`.
- Frontend build/typecheck: `npm.cmd run build` (frontend/). No lint script.
  `noUnusedLocals: true` — unused imports break the build.

## Role-based access control (RBAC, 07-09-2026)

- Roles: SUPER_ADMIN (global), HOD (own department only), EXAM_COORDINATOR
  (timetable generation/lock, not dept data), FACULTY (self-scoped),
  STUDENT (new — view-only own-class timetable). `RoleName.ROLE_STUDENT`
  added; `User` gained nullable `academicYearId`/`sectionId` (Postgres
  migration `V11__add_student_class_columns.sql`; h2 uses `ddl-auto: update`
  so no h2 migration). Seeded student: `student` / `Student@1234` (CSE /
  1st Year / Sec A). `DataInitializerConfig` resolves student's
  year/section via `AcademicYearRepository`/`SectionRepository` (NOT lazy
  `Department.academicYears` — runner is outside a transaction → LazyInit).
- Enforced by Spring method security calling SpEL `@rbacGuard.<method>(authentication, ...)`
  (`config/security/RbacGuard.java`). Writes are department/self-scoped;
  deletes/POST /departments SUPER_ADMIN-only; reads (GET) are
  `hasAnyRole('SUPER_ADMIN','HOD','FACULTY','EXAM_COORDINATOR')` (STUDENT
  blocked) with cross-dept read preserved. `pom.xml` needs
  `<parameters>true</parameters>` for SpEL param names.
- `GET /timetable/my` (any authenticated): STUDENT → own section's
  timetables; FACULTY → timetables containing their lessons
  (`TimetableRepository.findByFacultyId`); HOD/ADMIN/COORDINATOR → their
  department's. Frontend `MyTimetablePage` at `/my-timetable` (read-only
  grid), smart redirect: student/faculty home = `/my-timetable`, staff =
  `/dashboard`; sidebar items role-gated (`STAFF_ROLES`, `SCHEDULING_ROLES`,
  etc.).
- **Login page 4-type selector (09-09-2026):** `LoginPage` has a
  ADMIN / HOD-Department / FACULTY / STUDENT login-type selector. Frontend
  ONLY: the type is matched against the real `roles` returned by
  `POST /auth/login`; mismatch → "Selected login type does not match your
  account role." and NO session is persisted (`setAuth` not called). Backend
  AuthController/AuthService/DTOs/tokens are UNTOUCHED — the backend stays
  the authority for the actual role + permissions (RBAC guards). Do not
  "harden" this by adding a loginType field to the backend login API without
  a strong reason.
- **h2 file DB regeneration note:** the dev file DB
  (`${user.home}/.timetable-scheduler/data/timetabledb`) keeps its
  roles-table CHECK constraint from the first generation — `ddl-auto: update`
  never alters it. When adding a NEW role, existing dev DBs crash on startup
  (`Value not permitted ... ROLE_STUDENT`). Fix: delete the `.mv.db` file
  (schema regenerates, DataInitializer reseeds). Any future role addition
  must call this out. Stale copy for this session:
  `C:\Users\Sanja\AppData\Local\Temp\opencode\stale_timetabledb_20260909_073216`.

## Dev server (H2, isolated file DB)

```
java -jar target\timetable-scheduler-1.0.0.jar --spring.profiles.active=h2
  --spring.datasource.url="jdbc:h2:file:<TEMP>\crud-audit-db;MODE=PostgreSQL;DB_CLOSE_DELAY=-1"
  --server.port=8086
```
- Boot takes ~60–90 s on a fresh DB (heavy seeding). Poll `/api/v1/auth/login`
  (admin/Admin@1234) until 200.
- Login body field is `usernameOrEmail`, NOT `username`.
- Seeded accounts: `admin` (SUPER_ADMIN), `cse_admin`/`ece_admin`/`me_admin`
  (HODs) — all password `Admin@1234`.
- Business rule violations throw `BusinessException` → **422**. Wrong current
  password on change-password is a `BusinessException` → 422.

## Profile plan phases (see .plan/profile-account-management.md)

Phase 4 Change Password — DONE (POST /me/change-password, current-password
verified). Phase 5 Multi-device sessions — DONE (user_sessions table,
V10 migration; login creates a session row, refresh rotates in-place, logout
revokes one-or-all, GET/DELETE /me/sessions). Phase 6 File upload — DONE
(POST /me/photo multipart, FileStorageService, `app.upload.dir`, `/uploads/**`
static serving, missing-file → letter-avatar fallback). Phase 7 Frontend
profile page — DONE (see Phase 7 section; no new backend tests needed — the
only backend change was additive LoginResponse fields, covered by the existing
45 auth End-to-End tests). Remaining: 8 Forgot/Reset password (needs SMTP).
Sequencing decision (approved): finish Profile phases 4–8 fully BEFORE
starting Item 1 (multi-tenancy / collegeId on User) — shared User entity +
migration versioning collision risk.

## Decision needed before Item 1 starts (multi-tenancy / institution singleton)

- Current design: `institution` is a SINGLE GLOBAL ROW with fixed `id=1`, and
  `ProfileService.toResponse` (plus the Phase 7 frontend College section)
  hard-assumes that singleton. This is INCOMPATIBLE with true multi-college
  support.
- Therefore Item 1 CANNOT just add `college_id` to User and call it done —
  the `institution` table's own shape needs a decision BEFORE (or as part of)
  Item 1's first phase. Open option: make institution per-college with a
  `college_id` key instead of a fixed `id=1`.
- This is the one piece of the Phase 4–7 data model that genuinely conflicts
  with multi-tenancy (unlike `phone`/`profile_photo_url`, which are purely
  additive). Settlement of this shape decision + the `id=1` assumption in
  `ProfileService.toResponse` is the hard gate for Item 1. Resolve it when
  work resumes; do not rediscover it.

Phase 5 deliberate behavior changes (covered by AuthFlowE2ETest 18 tests +
ProfileApiE2ETest): login no longer writes `users.refresh_token`; refresh
rotates within the same session row; a second login keeps the first token
(multi-device); `POST /auth/logout` optionally takes `{refreshToken}` — present
revokes only that device, absent revokes all; expired refresh token → 422
"Refresh token has expired. Please login again." with NO cleanup (cleanup
before throwing in the same tx rolls back — verify before attempting).
`suite after Phase 5: 15 failing = the same 14 engine baseline + the documented
flaky member (see CURRENT baseline above); zero non-timetable failures.`
- **Known gap (Phase 5):** expired `user_sessions` rows are NOT deleted — they
  are only excluded from active lists/counts in queries. By design (cleanup
  before throwing in the same tx rolls back). A future cleanup job/cron may
  be needed if the table grows large; do not rediscover this as a mystery.

Phase 6 (covered by PhotoUploadApiE2ETest 9 tests): upload contract =
files stored under `app.upload.dir` (`${UPLOAD_DIR:./uploads}`), DB stores the
URL path `/uploads/photos/<uuid>.<ext>` only; JPG/PNG/WebP, ≤5 MB (service
check → 422). `POST /me/photo` is JWT-only; `/uploads/**` is PUBLIC (browsers
fetch images without a Bearer header). Missing file at response time →
`profilePhotoUrl` omitted (letter-avatar fallback) — the explicit
`missingFile_degradesToLetterAvatarFallback` test deletes the file and asserts
GET /me stays 200. Photo replace deletes the old file.
`suite after Phase 6: baseline per the CURRENT number above (the flaky member
passed that run). Added in this phase: the 2 adversarial photo-security tests
(`uploadPhoto_renamedHtml_withImageContentType_isRejected_neverStored`,
`uploadPhoto_extensionIsDerivedFromFileContent_notFilenameOrContentType`).`
NOTE: MockMvc does NOT apply the servlet-container multipart limit — the 413
`MaxUploadSizeExceededException` handler is a real-container safety net; the
E2E covers the service-level 422 guard instead.
- **Known gap (Phase 6):** a `profile_photo_url` can survive the deletion of
  its file from disk (upload dir cleared/redeployed) — there is NO cleanup
  that removes the stale DB row; it is only MASKED at response time by the
  letter-avatar fallback. Harmless while the fallback holds; a future
  reconciling job could null URLs whose files are gone. Do not rediscover
  this as a mystery. SECURITY: the stored format decision is magic-byte
  based only (never client Content-Type/filename) — see FileStorageService
  `sniffFormat`.

Phase 7 (frontend profile page): `/profile` route under MainLayout +
RoleProtectedRoute; Topbar avatar-dropdown "My Profile" and Sidebar bottom user
section both navigate there; ProfilePage renders Personal / College /
Account / Security sections. College section reads the single global
Institution row (PUT /institution SUPER_ADMIN-only edit modal). Employee
ID / Designation show styled italic grey "N/A" when no linked Faculty
(Decision #4). Avatar upload → POST /me/photo. Security section: change
password modal, sessions table (device/IP/signed-in/expires, per-session
Revoke, "Logout from Other Devices" which keeps the current refresh
token's session), Sign Out. Frontend sessions API in profileApi
(getMySessions / revokeSession / revokeAllOtherSessions; DELETE body
`{ refreshToken }`). NEW in this phase: LoginResponse (and refresh)
now also carry phone/profilePhotoUrl/employeeId/designation →
authStore.setAuth persists them (plan §4.11); these are pure additive DTO
fields on a per-JWT-identity response (no client-supplied ID). Frontend
build green; auth suites still green (45 E2E).
`suite after Phase 7: equals the CURRENT baseline above — 14 engine + the
flaky member ±1; zero non-timetable failures by exact-name check.`

## Admin creates HOD login with Department; HOD creates Faculty login with Faculty (10-09-2026)

- `DepartmentRequest` gained optional `hodUsername`/`hodPassword`
  (`@Size(min=6,max=72)` on the password; bcrypt limit). `DepartmentService.createDepartment`
  provisions a ROLE_HOD `User` bound to the new department when `hodUsername` is present
  (email = `contactEmail`, fallback `<user>@college.edu`; fullName = `hodName`).
  UPDATE ignores credentials; blank username = no account. Missing password with a
  username → BusinessException 422; existing username/email → 422 (never reused/overwritten).
- `FacultyRequest` gained optional `username`/`password`. `FacultyService.createFaculty`
  provisions a ROLE_FACULTY `User` (email = faculty email, dept = faculty's dept) and sets
  `Faculty.userId` when `username` is present — this is what powers `/timetable/my` for the
  new faculty user (via `findByFacultyId`). UPDATE ignores credentials.
- Frontend: `DepartmentsPage` create-modal + `FacultyPage` create-modal render the
  credential fields ONLY when not editing (backend ignores them on update anyway).
  `departmentApi.ts`/`facultyApi.ts` request types extended accordingly.
- Verified live on a fresh temp H2 (not the dev DB): admin→`POST /departments` "CSE" w/
  Tamil123/12345678 → 201 + HOD login works (dept-link check: role=ROLE_HOD, dept 4,
  own-dept GET ok, `POST /departments` 403); HOD→`POST /faculty` FAC100 w/ rajesh login →
  201 + ROLE_FACULTY login works (employeeId resolved in LoginResponse), `/timetable/my` 200;
  HOD cannot create/modify ECE-dept faculty (403), faculty cannot modify another faculty (403),
  duplicate login "rajesh" → 422, student→faculty mgmt + `/timetable/generate` → 403.
- `mvn test` after this change: 322 tests / 12 failures — all 12 are the documented flaky
  Greedy/Timefold engine family; zero auth/department/faculty/workflow failures. Frontend
  `npm run build` green. Real dev DB (users: admin, 3 HODs, student, faculty) untouched.
- New accounts created this way exist only in the environment where created (e.g. a temp
  validation DB); no seed changes were made.

## Multi-college tenants (10-09-2026, in progress)

- Real `College` tenant entity: colleges table (`name`, unique `code`, address/phone/email,
  is_active), `ROLE_COLLEGE_ADMIN`, per-college data isolation for GET AND writes.
- Runtime backfill in `DataInitializerConfig.migrateLegacyDataIntoDefaultCollege()`: creates
  default tenant `DEV001` (named after the id=1 Institution row), backfills every
  null-college department/faculty/user into it, and grants ROLE_COLLEGE_ADMIN to every
  SUPER_ADMIN. Idempotent at every startup.
- `college_id` columns added to `departments`, `faculty`, `users` ONLY (not subjects —
  they reach their college through the department). Postgres migration:
  `db/migration/V12__create_colleges_and_backfill.sql` (same SQL + explicit-id setval).
- h2 dev file DB migrated additively via H2 Shell (NOT Flyway): the old `roles.name` was an
  H2 native ENUM (`ExtTypeInfoEnum`) with the old 5 literals, so ANY bind for the new role
  failed even on SELECT. Fix: `ALTER TABLE ROLES ALTER COLUMN NAME SET DATA TYPE VARCHAR(50)`.
  Backup before migration: `C:\Users\Sanja\AppData\Local\Temp\opencode\timetabledb_legacy_backup_20260910_184412.mv.db`.
- `mvn test` 10-09-2026 (post seed-repair): **324 tests / 12 failures / 0 errors**.
  The 20 deterministic engine ERRORS (stale tt1 dump + missing seeded CSE on the polluted
  dev DB) are gone; remaining 12 = 10 documented-flaky engine members of this run + 2
  DETERMINISTIC pre-existing test/engine [3]-block divergences, see below.
- **Deterministic lab [3]-block divergence (do not chase):** both engines place a lab's
  full `practicalHours` as ONE consecutive block and IGNORE per-subject `sessionBlockSize`
  for labs (`TimetableGeneratorEngine` STEP 8 comment; Timefold matches). The two tests
  `TimetableGeneratorEngineIntegrationTest#generateSchedule_producesValidConflictFreeTimetable`
  (line 690) and `TimefoldScheduleEngineIntegrationTest#generateSchedule_buildsFeasibleConflictFreeTimetable`
  (line 153) assert sessionBlockSize-1 labs split as `[1,1,1]`. Proven to fail identically
  (`[3]` vs `[1,1,1]`) on a FRESH H2 with the ORIGINAL seed — a stale test expectation, NOT
  caused by multi-college or the seed repair. They will fail on EVERY full run;
  do not patch the engines for it.
- **Seed repair `restoreMissingCseSeed()`:** `DataInitializerConfig` seeds departments only
  when `departmentRepository.count()==0`. On the polluted dev DB (only dept was `CSD` id 189)
  the engine integration tests died with `NoSuchElementException` in the
  `findByName("Computer Science & Engineering").orElseThrow()` seed dependency. Repair branch:
  when count>0 but CSE is absent it recreates CSE + 1st–4th years + A/B sections,
  `cse_admin` (Admin@1234), FAC001/FAC002, classrooms CS-101/CS-LAB1, subjects
  CS201/CS202/CS205L — each guarded by unique key (username/employeeId/roomNumber/
  subjectCode) so it is additive and never duplicates. Requires
  `ClassroomRepository.findByRoomNumber` (added). It runs after the college backfill, so the
  recreated rows are college-scoped to DEV001.
- **tt1 fixture regenerated:** `src/test/resources/dataset/tt1-dump.sql` (28,752 bytes) was
  re-generated via H2 Shell to include `COLLEGES` (id 1 DEV001) + `college_id` columns on
  DEPARTMENTS/FACULTY/USERS. Without this, the tt1 mem-DB planning tests
  (`PlanningLessonUnassignedTest`, `SolverIntegrationTest`, `TimetablePlanningSolutionIntegrityTest`)
  failed deterministically with `Table "COLLEGES" not found`. All three now green.
- H2 Shell gotcha: PowerShell silently drops empty-string args (e.g. `-password ""`) → the
  arg shifts; omit `-password`. Plain `jdbc:h2:file:<path>` (no `;MODE=...`) works for Shell.
- GET-list `@PreAuthorize` on Department/Faculty/Subject/Classroom controllers now includes
  `'COLLEGE_ADMIN'`; PUT hijack E2Es send VALID bodies (`@Valid` runs BEFORE method security,
  so an invalid body yields 400 not 403); `MultiCollegeE2ETest` green 2/2;
  `DepartmentServiceTest` needs `@Mock TenantContext` (9/9).
- **Live temp-H2 A/B E2E (09-10-2026, green end-to-end):** fresh file DB, rebuilt jar,
  port 8086. Admin login 200 w/ roles [+COLLEGE_ADMIN]; GET /colleges = [DEV001] only;
  POST /colleges "ABC" → abcadmin; abcadmin roles = COLLEGE_ADMIN only, POST/GET /colleges
  403 (SUPER_ADMIN-only); dept list paginated (`data.content[]`); abcadmin sees ONLY own
  dept (1) vs admin sees all (4); cross-college GET/PUT /departments/{dev-id} → **403**,
  POST /subjects into dev dept → **403**, all for abcadmin/hod/faculty; HOD create dept 403,
  own-dept UPDATE 200, foreign-dept UPDATE 403; faculty own-college list only, `/timetable/my`
  200; student login → **422** blocked. PowerShell 5.1 notes: `Invoke-WebRequest` in
  `-NonInteractive` mode needs `-UseBasicParsing` (else "Read and Prompt functionality is not
  available"); do not `Start-Process java` then poll in the same command — the tool waits on
  the child and respawns; use a fixed JDK path (`...\Microsoft\jdk-21.0.11.10-hotspot\bin\java.exe`)
  to avoid javapath/jdk-23 doubles.
- **Frontend (10-09-2026, final per product requirement):** LoginPage shows ONLY
  3 login types — **College Admin / HOD / Department / Faculty**. The "Admin"
  and "Student" types are REMOVED (backend 422 still blocks student logins;
  `ROLE_SUPER_ADMIN` remains internal bootstrap-only, never a login option).
  The "Login Types & Test Accounts" card is GONE — no real credentials shown.
  Default selector = College Admin; field label = "Username / Login ID".
  Frontend College-profile edit (`ProfilePage`) is now available to
  `ROLE_COLLEGE_ADMIN` + `ROLE_SUPER_ADMIN` (matches backend
  `RbacGuard.canManageInstitution`); wording says "College Admin".
- **Final real-DB read-only verify (10-09-2026, on a backup copy):** colleges = 1 row
  DEV001 (id 1, named from Institution); 0 null-college departments/faculty/users; all
  8 user accounts preserved with college_id=1; only `admin` holds ROLE_COLLEGE_ADMIN
  (SUPER_ADMINs only); institution row intact; subjects 3 / classrooms 3 / timetables 0
  (unchanged). Report: `PHASE14_MULTI_COLLEGE_REPORT.md` (13-point checklist).

## College Admin registration flow (10-09-2026)

- **Public first-time registration:** `POST /api/v1/auth/register-college` is PUBLIC
  (added to `SecurityConfig.PUBLIC_ENDPOINTS`) — NO existing account / SUPER_ADMIN needed.
  Request DTO `CollegeRegistrationRequest` (extends `CollegeRequest`, adds
  `confirmPassword`). `CollegeService.registerCollege(...)` reuses the existing
  `createCollege(...)` transaction → college + ROLE_COLLEGE_ADMIN user + college binding
  created ATOMICALLY. Mismatched password/confirmPassword → BusinessException **422**
  (checked before creation); duplicate college code / duplicate admin login ID / duplicate
  email → **422**; blank required fields → **400**. Response: 201 `CollegeResponse`
  (includes `adminUsername`). Reuses ALL existing logic — no duplicated creation paths.
- **Backend `createCollegeAdminAccount` (existing-college variant) is unchanged:** still
  `POST /colleges/{id}/admin-account`, SUPER_ADMIN-only. The two functions are siblings;
  registration is the no-account-needed entry point.
- **Frontend `RegisterCollegePage` (`/register-college`):** LoginPage College Admin section
  shows "Create College Admin Account →" link (only when loginType == ROLE_COLLEGE_ADMIN).
  Page mirrors LoginPage split layout; collects College Name/Code/Email/Phone/Address +
  Admin Login ID/Password/Confirm; client-side validation (required, code charset, email
  format, login ID 3-50, password ≥6, confirm match); success panel shows the created
  admin login ID and auto-redirects to `/login` after 4 s; "← Back to College Admin Login"
  always available. `authApi.registerCollege()`. Route is public in `AppRouter`.
- **E2E `CollegeRegistrationE2ETest` (5 tests, green):** public registration w/o auth +
  login + ROLE_COLLEGE_ADMIN in JWT + own-college isolation + cross-college 403 + HOD flow
  under a registered college; duplicate code/login/email → 422; password-confirm mismatch →
  422, blank fields/short pk → 400; failed registration leaves NO partial data (a college
  code from a failed attempt can still be registered afterwards); a **stale/expired Bearer
  token on the public path is ignored** and anonymous `/auth/me` stays 401 (auth unchanged).
  Full auth suite re-run green 64/64 (Registration 5 + MultiCollege 3 + AuthFlow 18 +
  RoleBasedAccess 11 + ProfileApi 10 + InstitutionApi 8 + PhotoUpload 9).
- **Public-endpoint JWT exclusion:** `JwtAuthenticationFilter.shouldNotFilter` skips
  `/auth/register-college` (added to the existing login/refresh/forgot-password list) so the
  filter literally never runs for it — a stale/expired token in the header cannot affect it.
- **Frontend `skipAuth` opt-out:** `axiosClient` supports per-request `{ skipAuth: true }`
  (via the `skipAuth` AxiosRequestConfig module-augmentation) — the request interceptor does
  NOT attach the stored JWT, and the 401 auto-refresh retry is bypassed. Used ONLY by
  `authApi.registerCollege()`. Normal authenticated calls are untouched (they omit the flag
  and still attach the JWT + auto-refresh on 401). Fixes the browser "Unauthorized: invalid
  or expired token" on `/register-college` when an old token sits in localStorage.

## Per-college department name uniqueness (12-09-2026)

- FIXED: department names are now unique PER COLLEGE (two colleges may each create "CSE").
  Previously `DepartmentService` used GLOBAL checks (`existsByName` / `existsByNameAndIdNot`)
  and `Department.name` had `unique = true` → a second college could never create a dept
  sharing a name.
- Entity: `unique=true` dropped; table-level composite
  `@UniqueConstraint(name="uk_departments_college_name", columnNames={"college_id","name"})`.
  Prod migration `V13__college_scoped_department_uniqueness.sql`:
  `DROP CONSTRAINT IF EXISTS departments_name_key` + `ADD CONSTRAINT
  uk_departments_college_name UNIQUE (college_id, name)` (V12 backfilled college_id=1 and
  names were globally unique, so the composite is satisfiable with data untouched).
- Repository: `existsByNameForCollege(name, collegeId)` and
  `existsByNameAndIdNotForCollege(name, id, collegeId)` replace the global pair; JPQL uses
  `((:collegeId IS NULL AND d.college IS NULL) OR d.college.id = :collegeId)` (mirrors
  `searchDepartmentsByCollege` null-college semantics). `findByName` kept (engine/seed use).
- Service: `createDepartment` resolves `User caller = tenantContext.currentUser()` FIRST,
  computes `effectiveCollegeId` (caller college id or null for MockUser/global admin), and
  rejects with 422 "already exists in this college"; `updateDepartment` scopes to the
  department's OWN college.
- `DepartmentResponse` gained `collegeId` (null-safe) so E2Es can assert the tenant anchor.
- `tt1-dump.sql`: DEPARTMENTS constraint changed from `CONSTRAINT_9 UNIQUE("NAME")` to
  `UK_DEPT_COLLEGE_NAME UNIQUE("COLLEGE_ID","NAME")`.
- Tests: `MultiCollegeE2ETest#departmentNameUniqueness_isScopedPerCollege_andDataStaysWithCorrectTenant`
  (A creates CSE 201, B creates CSE 201, same-college dup 422 both ways, list isolation,
  cross-college PUT/DELETE 403 both directions, HOD ops, faculty isolation, `collegeId`
  anchor, cross-college get-by-id 403) + `countName` helper; `DepartmentServiceTest`
  mocks updated to `existsByNameForCollege(eq(...), isNull())` etc.
- Verified 12-09-2026: targeted suites green (MultiCollege 4, DepartmentService 9,
  DepartmentPersistence 1, CollegeRegistration 5). Full `mvn test`: 331 tests / 13 failures
  — all 13 are the documented flaky engine family + known [3]-block divergences
  (zero new/reproducible). Frontend `npm run build` green (DepartmentsPage displays the
  backend message verbatim — no frontend change needed).
- CAVEAT (same pattern as the roles-ENUM fix): DONE 12-09-2026 on the dev FILE DB — the stale
  Hibernate-generated `UNIQUE(NAME)` (`UKJ6CWKS7XECS5JOV19RO8GE3QK`) was dropped in place via
  H2 Shell (`ALTER TABLE DEPARTMENTS DROP CONSTRAINT ...`); only
  `uk_departments_college_name (COLLEGE_ID, NAME)` remains. Verified live on that DB: CSE
  insertable under both college 1 and college 2, same-college duplicate rejected with
  `23505` on `UK_DEPARTMENTS_COLLEGE_NAME_INDEX_9`, all data preserved (2 colleges, 2 depts,
  3 faculty, 9 users, 3 subjects, 3 classrooms, 8 academic years, 12 sections, 0 timetables).
  Backup: `C:\Users\Sanja\AppData\Local\Temp\opencode\timetabledb_before_dept_unique_fix_20260912_082204.mv.db`.
  Note for OTHER existing H2 FILE DBs (e.g. temp copies created before 12-09-2026): the same
  H2-Shell drop is still needed if they predate the fix. `DepartmentPersistenceE2ETest`
  (h2 profile, file DB) also needs java servers stopped (timetabledb.mv.db lock).

## College-scoped Login ID uniqueness + tenant-aware login (12-09-2026)

- FIXED: HOD / College Admin / Faculty Login IDs (usernames) are now unique PER COLLEGE
  (each college may create `CSDTamil`, same college cannot). Email is scoped the same way
  (HOD fallback email `<user>@college.edu` would otherwise collide globally).
- Entity: `User.username`/`User.email` dropped `unique=true`; table-level composites
  `uk_users_college_username (college_id, username)` and `uk_users_college_email (college_id, email)`.
  Prod migration `V14__college_scoped_user_uniqueness.sql`: drops `users_username_key` /
  `users_email_key` (V1 auto-names) + adds both composites (safe: V12 backfilled college_id=1 and
  old uniques were globally unique).
- Repository: `findAllByUsername`, `findAllByUsernameOrEmail` (JPQL `WHERE u.username=:key OR u.email=:key`
  returning a LEADING-EDGE-WRONG-Ok List), scoped `existsByUsernameForCollege` /
  `existsByEmailForCollege` with null-college semantics (same pattern as dept). Global
  `findByEmail`, `findByUsernameOrEmail`, `existsByUsername`, `existsByEmail` REMOVED;
  `findByUsername` kept (PhotoUploadE2ETest uses it). **Two colleges can now hold the same
  username — anything resolving a user by username alone (old `findByUsername`) will crash
  if both exist; route through the scoped finders or `findAllByUsernameOrEmail`.**
- Tenant-aware login: `LoginRequest` gained optional `collegeCode`. `AuthService` no longer
  uses `AuthenticationManager` — it resolves ALL candidates by `findAllByUsernameOrEmail`,
  filters by college code (case-insensitive) when given, and verifies with `PasswordEncoder`.
  Semantics: no candidates / wrong code / wrong password / inactive user → **401**; no code
  provided with >1 candidates → **422** "Multiple accounts use this login identifier. Please
  provide your College Code to sign in."; success → 200 with the tenant's `collegeId`.
- JWT loads by userId: `JwtAuthenticationFilter` now uses `getUserIdFromToken` +
  `UserDetailsServiceImpl.loadUserById` (loading by username would break on duplicates);
  `loadUserByUsername` kept only for interface compliance (resolves `min(by id)`).
- Provisioning checks scoped: `DepartmentService.createDepartment` (HOD) and
  `FacultyService.createFaculty` use `existsByUsernameForCollege`/`existsByEmailForCollege`
  with the department's/faculty's college; `CollegeService.createCollege` no longer does global
  username/email checks (brand-new college has no users; composite UK guards);
  `createCollegeAdminAccount` checks within the target college.
- `DataInitializerConfig`: seed lookups (`admin`, `student`, `faculty`, `cse_admin`) go through
  `findSeedUser(username)` — prefers a null-college / DEV001 account, falls back to first match.
- Frontend: `LoginPage` shows a **College Code** input ONLY for the HOD login type; sent in
  the payload only when non-blank. College Admin / Faculty login flows unchanged.
- Tests (all green): `MultiCollegeE2ETest#hodLoginIds_areScopedPerCollege_andSharedId_logsInToBothTenants`
  (same HOD login in 2 colleges 201, same-college dup 422 both directions, no-code shared login 422,
  wrong code / wrong password 401, each HOD sees only own dept + 403 on the other's read/update);
  `CollegeRegistrationE2ETest#duplicateCollegeCode_isRejected_butSharedLoginId_isScopedPerCollege`
  (dup code 422, shared login across colleges 201, coded login lands in the right tenant, coded
  wrong-password 401, admin-account same-college dup 422 via SUPER_ADMIN token — that endpoint is
  SUPER_ADMIN-only so a COLLEGE_ADMIN token gets 403).
- **Dev H2 file DB (12-09-2026):** Hibernate `ddl-auto:update` added the two composites but
  never drops the old single-column uniques — dropped in place via H2 Shell:
  `ALTER TABLE USERS DROP CONSTRAINT IF EXISTS UKR43AF9AP4EDM43MMTQ01ODDJ6;` (USERNAME) and
  `ALTER TABLE USERS DROP CONSTRAINT IF EXISTS UK6DOTKOTT2KJSP8VW4D0M25FB7;` (EMAIL); only
  `UK_USERS_COLLEGE_USERNAME`/`UK_USERS_COLLEGE_EMAIL` remain. Data preserved (9 users, 2 colleges,
  2 depts). Backup: `C:\Users\Sanja\AppData\Local\Temp\opencode\timetabledb_before_user_unique_fix_20260912_085905.mv.db`.
  OTHER pre-existing H2 file DBs need the same drop after pulling this change.
- Verified 12-09-2026: auth/department/profile suites green — MultiCollege 5, CollegeRegistration 5,
  AuthFlow 18, RoleBasedAccess 11, ProfileApi 10, InstitutionApi 8, PhotoUpload 9,
  DepartmentService 9, DepartmentPersistence 1. Frontend `npm run build` green.
- Survived 12-09-2026 targetted run: an earlier full `mvn test` showed the same documented flaky
  engine-family baseline (13 failures); after this change the affected suites were re-verified green,
  so any future full-suite diff should be diffed against the flaky names per the baseline entry above.

## Browser "HOD Login ID already in use by another user" — root cause = STALE deployed jar (12-09-2026)

- The user's browser error `HOD Login ID 'CSDTamil' is already in use by another user` was the
  OLD GLOBAL-uniqueness message. The string existed in source/classes only in
  `backend/target/timetable-scheduler-1.0.0.jar` built **10-09-2026 19:26:04** (predates BOTH the
  12-09 college-scoped dept-name fix AND the college-scoped login fix; its `DepartmentService.class`
  contains `existsByUsername`, `existsByEmail`, `existsByName`, `existsByNameAndIdNot` + the old
  message). All three repo-root `.bat` launchers run that jar with `--spring.profiles.active=h2` on
  port 8080; Vite (5173) proxies `/api` -> `http://localhost:8080`; context-path `/api/v1`. **The
  browser was talking to the stale jar, not current source.** No non-jar backend was running at
  diagnosis (no java.exe).
- FIX = rebuild/restart only, ZERO source changes: `mvn -q clean package -DskipTests`
  (rebuild 12-09 09:17; deny java running during package — jar file-lock), restarted backend on 8080.
  New jar verified to contain `existsByUsernameForCollege`, `existsByEmailForCollege`,
  `effectiveCollegeId`, `existsByNameForCollege` + message `HOD Login ID 'X' is already in use in this
  college`. Dev DB (`.timetable-scheduler/data/timetabledb`) was ALREADY correct (constraints
  `UK_USERS_COLLEGE_USERNAME (college_id,username)` + `UK_USERS_COLLEGE_EMAIL`; no global unique) —
  NO DB change needed this time.
- After any UI-behavior change, DIAGNOSE THE RUNNING BUILD FIRST: process list, jar mtime + jar-class
  string scan (H2 SchemaExport/openjdk `javap`/string grep of the extracted .class), Vite proxy
  target, then rebuild clean. Do NOT start patching source on the strength of a browser-visible error
  string — it may come from a stale jar (this time the target jar predated even the dept-name fix and
  pre-dated the login fix).
- Live-verified 12-09-2026 against the restarted backend + dev H2 DB (identical checks run in
  `MultiCollegeE2ETest`/`CollegeRegistrationE2ETest`): admin seed login 200 (ROLE_COLLEGE_ADMIN +
  SUPER_ADMIN), cse_admin 200, faculty 200; public register-college created fresh College A (id 34
  `LVALPHA092150`) + College B (id 35 `LVBETA092150`); each college's College Admin created dept CSE
  with **the SAME HOD Login ID `CSDTamil` -> BOTH 201** (deptId 379 college 34, 380 college 35);
  same-college duplicate -> 422 `already in use in this college` (both colleges); HOD `CSDTamil` mode
  login with A's code -> userId 74 college 34, with B's code -> userId 75 college 35; each HOD sees
  only own dept, cross-college GET dept -> 403 both ways, own dept 200; bare (no-code) login for a
  shared ID -> 422 `Multiple accounts use this login identifier. Please provide your College Code to
  sign in.`; legacy CSDTamil (userId 38, college 1), dept 189, college 2 esecac.in admin all intact.
  Targeted suites re-run green after restart (MultiCollege 5, CollegeRegistration 5, DepartmentService
  9, DepartmentPersistence 1); full `mvn test` 332/12 (12 = documented flaky engine family) and
  `npm run build` green.
- Live-test artifact notes: the two test colleges `LVALPHA092150`/`LVBETA092150` + their 4 users
(admins `lva092150`/`lvb092150` pw `A@12345x`; HODs `CSDTamil` pw `Cse@1234`, college 34/35) now
  persist in the dev DB — used them intentionally to prove the browser-facing backend; harmless
  additive rows. Script: `C:\Users\Sanja\AppData\Local\Temp\opencode\live_verify.ps1`.

## HOD login = Login ID + password ONLY — password-based disambiguation (12-09-2026)

- CHANGE: the College Code input is REMOVED from the HOD login form and `collegeCode` is REMOVED
  from the login flow entirely. `LoginRequest` is now just `usernameOrEmail` + `password`
  (collegeCode field deleted; a stale client that still sends it is silently ignored by Jackson).
- Backend rule in `AuthService.login`: resolve ALL accounts matching the identifier, keep only
  ACTIVE accounts, then `passwordEncoder.matches` the supplied password against each. Zero matches
  → 401 (identical generic message — never reveals that another college holds the same Login ID).
  ONE match → authenticate THAT user (JWT built from the matched user's actual userId + collegeId).
  MORE THAN ONE match → 422 `Multiple accounts match these credentials. Please contact your college
  administrator.` (never an arbitrary pick). College-scoped DB uniques
  `uk_users_college_username`/`uk_users_college_email` untouched; usernames remain NOT globally unique.
- Tests: `MultiCollegeE2ETest` (now 6 tests) — `hodLoginIds_areScopedPerCollege_passwordIsTheDisambiguator`
  (A/B create same `CSDTamil` → both 201, different passwords; login by Login ID+password resolves to
  correct userId/collegeId; wrong pass 401; same-college dup 422 both ways; cross-college 403;
  existing unique HOD/admin/faculty logins still work) + `sharedLogin_withSamePassword_isRejectedRequiringDisambiguation`
  (same login + same password in two colleges → 422 disambiguation error, wrong pw still 401).
  `CollegeRegistrationE2ETest.duplicateCollegeCode_isRejected_butSharedLoginId_isScopedPerCollege`
  rewritten to password disambiguation (shared admin Login ID, different passwords → each logs into
  its own college; dup college code 422; same-college admin-account dup 422).
- Verified: targeted suites green (AuthFlow 18, MultiCollege 6, CollegeRegistration 5, RoleBasedAccess 11,
  ProfileApi 10, InstitutionApi 8, PhotoUpload 9, DepartmentService 9, DepartmentPersistence 1 = 77 tests,
  0 failures); frontend `npm run build` green. Live on the browser-facing backend (:8080, dev H2 DB,
  rebuilt jar 12-09 11:05): admin 200; legacy same-password `CSDTamil` pair (colleges 34/35) now 422
  disambiguation; fresh colleges 66/67 each created CSE+`CSDTamil` (different pws) → 201; `CSDTamil`+each
  pw → 200 with correct userId/collegeId; wrong pw 401; stale `collegeCode` field ignored; HOD cross-college
  reads 403; cse_admin/faculty/admin logins 200. Stale build note: rebuild the deployed jar after pulling
  this change or the running backend keeps the old code path.
## Department "Permanent Delete" fix � College Admin own-college delete (12-09-2026)

- BUG (browser-facing): DEPARTMENT management page showed "Permanently Delete" for College Admins, but the backend
  endpoint was @PreAuthorize("hasRole('SUPER_ADMIN')") -> College Admin click returned 403, nothing deleted.
- ROOT CAUSE: stale authorization in DepartmentController.java DELETE /departments/{id} � SUPER_ADMIN-only while
  the modal's dependency endpoint (GET /departments/{id}/dependencies) and update/archive/restore all use the
  tenant-aware @rbacGuard.canManageDepartment. NOT a stale jar (the 11:05 jar already had the SUPER_ADMIN-only rule).
- FIX (source): added RbacGuard.canDeleteDepartment(authentication, id) � SUPER_ADMIN any; COLLEGE_ADMIN own college
  only; HOD excluded (destructive). For a NON-EXISTENT id the guard PASSES so the service reports a truthful 404
  (ResourceNotFoundException) instead of a misleading 403; reads of a gone department still 403 per canViewDepartment.
  DELETE mapping changed to @PreAuthorize("@rbacGuard.canDeleteDepartment(authentication, #id)").
- deleteDepartment service logic was ALREADY correct (timetables+subjects deleted, faculty/classrooms/HOD users
  unlinked-not-deleted, department cascade -> AcademicYear -> Section). No service/entity/DB change needed.
- Tests: new MultiCollegeE2ETest#collegeAdmin_permanentlyDeletesOwnDepartment_keepsHodUser_crossCollegeBlocked
  (own-college delete 200, HOD linked before / kept+unlinked after via login departmentId null, B's dept+faculty
  untouched, cross-college delete 403 both ways, re-delete 404, read of gone dept 403). Targeted suites green:
  MultiCollege 7, CollegeRegistration 5, AuthFlow 18, RoleBasedAccess 11, DepartmentService 9 = 50/50.
- 25-check live verify on 12-09 11:33 jar + dev H2 DB, all PASS:
  colleges 98-101 created via SUPER_ADMIN (admins plva/plvb, pw Pass@1234), depts 477/479 "PK-CSE" w/ HOD
  plvhod<ts> (kept+unlinked after delete, users 170/173), B depts 478/480 "PK-ME" kept (list total 1 each),
  A list 0 after delete, cross-college DELETE + dependencies 403, deps own 200, re-delete 404.
- H2 DB post-delete verification (stopped server): DEPARTMENTS id=479 0 rows, its ACADEMIC_YEARS 0, its SECTIONS 0,
  HOD stored w/ DEPARTMENT_ID null (account kept), COLLEGES 100/101 + dept 480 intact, 0 orphan academic_years/sections.
- Frontend needed NO change (button already disables while pending, closes modal, success toast, refreshes list);
  
pm run build green. New jar built 12-09 11:29, backend restarted on 8080 (PID 19336).
- H2 Shell gotcha: CHECK is a reserved word (alias AS check fails); use quoted/other aliases. Shell -sql only
  prints update counts � pipe the script via stdin to see result tables. PowerShell 5.1: Invoke-WebRequest -Method GET
  -Body  throws ProtocolViolationException (DELETE tolerates it) � omit -Body for body-less verbs.

## Faculty role = self-service only + Forgot/Reset password (15-09-2026)

- **Faculty scope:** ROLE_FACULTY can now only reach Timetable, My Subjects (new) and Profile. Everything else is
  backend-enforced 403 for a REAL faculty JWT (RbacGuard uses currentUser() scoped checks; `fallbackRoleAllowed`
  still contains FACULTY but ONLY applies when currentUser()==null i.e. MockUser — real faculty logins get the 403).
  - RbacGuard denied for FACULTY: canViewDepartment/Faculty/Subject/Classroom/Timetable/SectionTimetable,
    canReadAvailability/canSaveAvailability, canViewFacultyReport (NO self-allow for faculty).
  - `'FACULTY'` REMOVED from list endpoints: GET /departments, /faculty, /subjects, /classrooms,
    /reports/rooms/utilization, /dashboard/stats. No change to HOD/COLLEGE_ADMIN/EXAM_COORDINATOR behavior.
  - NEW `GET /subjects/my` (`@PreAuthorize hasRole('ROLE_FACULTY')`) -> SubjectService.getMySubjects returns only
    the faculty's own assigned subjects (by faculty id from the User->Faculty link). Frontend MySubjectsPage cards.
  - Tests: `FacultyRoleE2ETest` (7 tests) — real faculty JWT; 403s on all master-data lists + single-resource reads
    (own dept/faculty/subject/classroom, /timetable/department/{id}, /timetable/section/{id}/semester/1,
    /timetable/999999) + writes + POST /timetable/generate; /subjects/my + /timetable/my self-scoped 200;
    /auth/me + /me 200.
- **Forgot/Reset password (no SMTP):** `POST /auth/forgot-password` + `POST /auth/reset-password` PUBLIC
  (SecurityConfig PUBLIC_ENDPOINTS + JwtAuthenticationFilter.shouldNotFilter). Flow: request by usernameOrEmail →
  AuthService finds ACTIVE candidates; 0 → 200 w/ `data.resetToken: null` (no enumeration); >1 (cross-college
  shared login) → BusinessException 422; exactly 1 → SHA-256-hashed token stored on User (`reset_password_token`,
  `reset_password_expiry`, `reset_password_used`; V15 migration) + RAW token returned ONCE in `data.resetToken`
  (dev-mode delivery until SMTP). 15-min TTL. Single use (replay → 422 "Reset token has expired..."). Successful
  reset DELETES all user_sessions rows for that user (old refresh tokens die) and re-encodes the new password
  (default and same-bcrypt as change-password). Password `@Size(min=8,max=128)` → 400 when short.
  Map.of null-value NPE trap: `Map.of("resetToken", null)` throws — build a HashMap instead.
- **Tests:** `PasswordResetE2ETest` (8 tests) — happy path rotate (old pw 401 after, new pw 200); single-use replay
  422; invalid token 422; expired (expiry set to past via repo) 422 + old pw still works; unknown identifier 200 no
  token; shared username in 2 colleges 422; short password 400; refresh revoked after reset (422). Batched green
  with the other auth suites: AuthFlow 18, CollegeRegistration 5, FacultyRole 7, InstitutionApi 8, MultiCollege 7,
  PasswordReset 8, PhotoUpload 9, ProfileApi 10, RoleBasedAccess 11, DepartmentService 9, DepartmentPersistence 1
  = **93 tests / 0 failures.**
- **Frontend (build green):** ForgotPasswordPage (/forgot-password, shows one-time code box + copy when
  `data.resetToken` present, generic message when null) and ResetPasswordPage (/reset-password?token=..., manual
  token field + new/confirm password, 422 message shows "invalid or expired", success → /login after 2.5s). Both
  use `authApi.forgotPassword`/`resetPassword` with `{ skipAuth: true }` (axiosClient skips JWT + auto-refresh —
  stale tokens can't break the public flow). Sidebar: FACULTY no longer gets Dashboard/Faculty/Subjects/Classrooms/
  Availability/Reports; gains "My Subjects". HomeRedirect: faculty/student → /my-timetable, staff → /dashboard.
  ProfilePage: Active Sessions block + query hidden for FACULTY (`enabled: !isFaculty`); "Forgot / Reset Password"
  button is now LIVE (was disabled placeholder) → navigates to /forgot-password. Management (staff) role sets:
  `MANAGEMENT_STAFF_ROLES` = SUPER_ADMIN, COLLEGE_ADMIN, HOD, EXAM_COORDINATOR (used in AppRouter + Sidebar).
- **`@Valid` runs BEFORE method security`** again: POST /timetable/generate with body `{}` returns 400, not 403 —
  faculty-403 tests must send a structurally VALID body (live verify confirmed 403 with a real payload). Same trap
  as @WithMockUser PUT hijack tests.
- **Live-verified 15-09-2026** on the dev H2 DB + rebuilt jar (11:31, server PID 10920 :8080): 25 checks PASS —
  admin + faculty login; faculty 403s on all six list endpoints + valid-body generate; /subjects/my 200 (len 0 on
  dev faculty — no assignment), /timetable/my + /auth/me + /me 200; forgot 200 w/ 36-char UUID resetToken; unknown
  identifier 200 null token; reset sets a temp password → old pw 401, temp pw 200; replay 422; restore original
  password round-trip works; admin depts list count 9 intact. Script:
  `C:\Users\Sanja\AppData\Local\Temp\opencode\live_verify_faculty_reset.ps1` (PS 5.1: NO ternary `?:` operator).
- Dev H2 DB: `users.reset_password_*` columns added via ddl-auto:update automatically. Faculty password ends
  unchanged (Faculty@1234). Backend server on :8080 runs the 15-09 11:31 jar; other branches of the repo (if any)
  need the standard stop-java → `mvn -q clean package -DskipTests` → restart before the browser sees the change.
