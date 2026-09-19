# Phase 9 Report — Real Dataset Validation

**Status:** PASS — 08 Aug 2026
**Scope:** Validate both scheduling engines (Greedy, Timefold) against the real ERP dataset (`backend\src\test\resources\dataset\tt1-dump.sql`) through the production REST path.
**Constraint honored:** No production code, REST contract, schema, or data was modified. Only 3 new test/harness classes and this report were added.

---

## 1. Dataset under test

Real H2 export of the live ERP DB (dumped 2026-08-06). Auto-loaded by `AbstractTimetableApiE2E`.

| Fact | Value |
|---|---|
| Departments | 1 (id 4, CSE) |
| Academic years | 4 |
| Sections | 4 (ids 25, 26, 27, 28) |
| Faculty | 9 (all available, no leaves) |
| Faculty availability rows | 0 |
| Subjects | 10 (9 theory, 1 lab; all department-level) |
| Classrooms | 1 (CS-265 LECTURE_HALL; 0 lab rooms) |
| Time slots | 8 (1 break) |
| Pre-existing timetables | 1 (timetableId=1, 34 entries, 2 conflicts, stored optimization 85) |
| Users / roles | 4 / 4 |

Requested weekly demand per section = **39 periods** (36 theory + 3 CS471 lab). Session `2025-2026 EVEN`, semester 1.

## 2. Integrity checks (12 classes, SQL-based)

`P9_INTEGRITY` — **violations = 0** for both engines (orphan FKs, break-slot usage, duplicate windows, real double-bookings, curriculum membership, daily/weekly caps, room capacity, conflict-row consistency, stored-vs-actual conflict_count, disabled academic years).

## 3. Methodology

1. Baseline fingerprint: SHA-256 + row count of all 11 master tables, captured before any generation.
2. 1 warm-up + 3 measured runs per engine; each run resets only `TIMETABLES` / `TIMETABLE_ENTRIES` / `TIMETABLE_CONFLICTS`.
3. Per-section generation in order 25 → 26 → 27 → 28 (later sections contend for the shared faculty and the single classroom).
4. Per run: completeness (`requested == assigned + unassigned`), zero within-timetable clashes, independent cross-timetable recount (`faculty|room|section × day × slot` across all timetables).
5. Lock preservation on the last run: 2 entries locked via `PATCH /timetable/entries/{id}/lock`, then `POST /timetable/{id}/regenerate-unlocked`; locked entries must survive intact and the DB must remain clash-free.
6. Master-table fingerprint must be byte-identical afterwards (no-mutation check).

## 4. Results

### Greedy (deterministic across all 3 runs)

| Section | Requested | Assigned | Unassigned | Conflicts | Infeasible | Occupancy facts | Api ms |
|---|---|---|---|---|---|---|---|
| 25 | 39 | 34 | 5 | 2 | 0 | 0 | 62–75 (avg 70) |
| 26 | 39 | 8 | 31 | 25 | 0 | 34 | 54–72 (avg 61) |
| 27 | 39 | 0 | 39 | 33 | 0 | 42 | 44–60 (avg 51) |
| 28 | 39 | 0 | 39 | 33 | 0 | 42 | 46–69 (avg 57) |

Cross-timetable clash recount: **0 faculty / 0 room / 0 section clashes** on every run. Lock preservation: **2/2 preserved**, 0 clashes. Master tables: **unchanged (11/11)**.

### Timefold (deterministic across all 3 runs; all hard 0)

| Section | Requested | Assigned | Unassigned | Hard | Soft | Conflicts | Occupancy facts | Api ms |
|---|---|---|---|---|---|---|---|---|
| 25 | 39 | 36 | 3 | 0 | −7 | 0 | 0 | 3080–3101 (avg 3093) |
| 26 | 39 | 6 | 33 | 0 | −66 | 0 | 36 | 3062–3081 (avg 3071) |
| 27 | 39 | 0 | 39 | 0 | −78 | 0 | 42 | 3041–3065 (avg 3054) |
| 28 | 39 | 0 | 39 | 0 | −78 | 0 | 42 | 3039–3069 (avg 3051) |

Cross-timetable clash recount: **0 faculty / 0 room / 0 section clashes** on every run. Lock preservation: **2/2 preserved**, 0 clashes. Master tables: **unchanged (11/11)**.

## 5. Findings

1. **Hard feasibility holds on the real dataset for both engines** — every timetable generated with hard = 0 and zero `SOLVER_INFEASIBLE` conflicts. Where resources are exhausted, lessons are left *unassigned* (soft penalty), never double-booked.
2. **Resource starvation is the dominant factor.** The dataset has 1 classroom and 9 faculty shared by 4 sections. As timetables accumulate, occupancy facts grow 0 → 34/36 → 42, and sections 27/28 receive zero placements under **both** engines. This is a capacity gap in the data (no LAB room exists for the 3-period CS471 lab block), not an engine defect.
3. **Engine comparison.** Timefold schedules the primary section fully (36/36 theory; soft −7 from the 3 unassigned lab periods) and keeps conflicts at 0 everywhere. Greedy matches its documented Phase 8 behavior (34 assigned, the known 2 CS471 placement-conflict records, no real overlaps). Timefold's api cost is ~3.0 s/section vs Greedy's ~0.05–0.08 s/section.
4. **Correctness contracts reproduce on real data:** completeness (`requested == assigned + unassigned`), zero clash recounts, 2/2 lock preservation, and byte-identical master data all hold for every run of both engines.
5. **No correctness problem was exposed** that would require touching production scheduling, constraints, or scoring. The two placement-conflict records on section 25 (Greedy) are the known CS471 lab-block failures that the conflict journal records and the recount API verifies as non-overlapping.

## 6. Regression

Full suite: **`mvn -o test` → Tests run: 186, Failures: 0, Errors: 0, Skipped: 0, BUILD SUCCESS** (includes the 2 new Phase 9 validation classes; all prior constraint, engine, and E2E tests remain green).

## 7. Artifacts

- `backend\src\test\java\com\erp\timetable\module\timetable\benchmark\AbstractPhase9RealDataValidation.java` — shared harness (discovery, integrity, baseline, per-section runs, clash recount, lock/no-mutation checks, P9_* logging).
- `backend\src\test\java\com\erp\timetable\module\timetable\benchmark\Phase9RealDataGreedyValidation.java` — engine=greedy, H2 `mem:p9_real_greedy`; asserts 34 assigned / 2 conflicts / determinism.
- `backend\src\test\java\com\erp\timetable\module\timetable\benchmark\Phase9RealDataTimefoldValidation.java` — engine=timefold, H2 `mem:p9_real_timefold`; asserts 36/3/hard 0/soft −7 primary + per-section hard 0, no infeasible, determinism.
- This report.
