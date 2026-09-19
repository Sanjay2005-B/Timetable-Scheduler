# Phase 13 — Department Create/Update Save Investigation & Verification Report

**Status:** VERIFIED — 15 Aug 2026
**Scope:** Investigate the reported blocker ("When I create a Department from the UI, the department is not being stored successfully"), identify the ROOT CAUSE, apply the smallest possible fix if a defect exists, and verify create/update persistence plus the exact regression chain — without touching the scheduler/timetable engine, DB schema, migrations, or existing data.

---

## Mandated answers

| Question | Answer | Evidence |
|---|---|---|
| **ROOT CAUSE** | **No reproducible defect in the current source.** The full create/update → save → cascade → DB → readback → list chain is verified working end-to-end. Every layer of the flow (DTO validation, `@Transactional` save, `CascadeType.ALL` + `orphanRemoval` with both-sides linking, unique constraints, GET filtering, dropdown selectability) is internally consistent and behaves correctly against a fresh database built from the current data export. | Live UI + live API + DB round trips (below) |
| **FIX** | **None required** — no production code change was necessary. The existing Phase-12 regression guard (`DepartmentPersistenceE2ETest`) and the unit suite (`DepartmentServiceTest`) already lock down the create→cascade→DB→readback→list contract and both pass. No fix was fabricated for a non-existent defect. | `DepartmentPersistenceE2ETest` 1/1, `DepartmentServiceTest` 4/4 |
| **FILES CHANGED** | **None in this phase.** Only this report was added. No `src` file was modified. | `git` unavailable (no repo); file timestamps confirm no `src` writes |
| **DEPARTMENT CREATE / UPDATE / DATABASE PERSISTENCE** | **Works — verified end-to-end.** Create `201` with full nested 4-year × 8-section payload persisted as real rows; duplicate name `422`; update `PUT` `200` with changes visible in the DB and after browser reload; delete `200` with orphan-removal cleanup; archive/restore `200`. | Live HTTP + real-browser Playwright + direct readback (below) |
| **EXISTING DATA MODIFIED** | **No.** Only the temporary verification departments were created and then removed. CSD (id 4, 4 years × 1 section), 19 faculty rows, and timetable id 1 remain byte-intact. | Live GET readbacks + counts |
| **TIMETABLE / SCHEDULER MODIFIED** | **No.** No scheduler, greedy, Timefold, constraint, or timetable code was touched. | File diff sweep of module timestamps |
| **BACKEND TEST** | **221 tests, 0 failures, 0 errors, 0 skipped — BUILD SUCCESS.** | `mvn test` full suite |
| **FRONTEND BUILD** | **PASS** (`tsc -b` + `vite build`, 1.42 s). | `npm run build` |

---

## 1. Investigation method

The reported symptom was reproduced through the exact scenario the user described, using the app's isolated H2 profile (this environment has no PostgreSQL/docker; the app's own `application-h2.yml` is used, `application.yml` untouched) with a fresh file DB rebuilt from the current data export `backend/src/test/resources/dataset/tt1-dump.sql`:

1. **Full source trace** — read the complete save path line-by-line:
   - `DepartmentsPage.tsx` (create/edit modal, section toggles, `saveMutation`), `departmentApi.ts`, `axiosClient.ts`
   - `DepartmentController` (POST/GET/PUT/PATCH/DELETE), `DepartmentService` (all 466 lines: `createDepartment`, `updateDepartment`, `normalizeYearSections`, `deleteDepartment`, `mapToResponse`), `DepartmentRepository` / `AcademicYearRepository` / `SectionRepository`
   - Entities `Department`, `AcademicYear`, `Section`, `AuditableEntity`; DTOs `DepartmentRequest`, `YearSectionsRequest`, `DepartmentResponse`, `AcademicYearDto`, `SectionDto`
   - `GlobalExceptionHandler`, `SecurityConfig`, `application.yml` / `application-h2.yml`, `vite.config`, Flyway migrations `V1`–`V7`
2. **Packaged-artifact check** — extracted `DepartmentService.class` from `target/timetable-scheduler-1.0.0.jar` and confirmed its method structure matches the current source (the running artifact is not stale).
3. **Live API round trips** against the real running app (H2 file DB, Flyway off, `ddl-auto: update`):
   - `POST /api/v1/departments` (full UI payload) → **201** with id, 4 `academicYears`, 8 `sections`, each with generated DB ids.
   - `POST` same name again → **422** `Department with name 'Test Department' already exists` (unique-name guard fires — the save path is reachable and validates).
   - `POST` minimal `{"name":"Minimal Dept"}` → **201** with default 4 years × A/B (strength 60, ACTIVE).
   - `PUT /departments/{id}` with changed HOD + section selection → **200**, persisted (verified by GET).
   - `PUT /departments/4` (CSD) with unchanged data → **200**, data intact.
   - `PATCH archive` → **200** (appears under `?archived=true`); `PATCH restore` → **200**; `DELETE` → **200**; orphan rows removed.
4. **Real-browser verification** (Playwright + system Chrome against the live UI on :5173 proxying to the app):
   - Create `Verification Department` through the real modal → modal closed, toast shown, **appears in the list after a full browser reload** (`RELOAD PERSISTENCE IN UI: true`).
   - Edit the same department through the real Edit modal (HOD → `VDEPT-UPDATED-HOD`) → `PUT` **200**, updated HOD visible after reload and via API readback.
   - The created department is **selectable in the Faculty and Subject create-form dropdowns**.
   - Zero page/console errors during the department flow.
5. **Regression suite** — full `mvn test` (221 tests) + `npm run build`, both green.
6. **Cleanup** — removed only the temporary departments; verified all pre-existing data intact.

## 2. Why no failure reproduces

- **Request shape is consistent.** The UI sends `name, hodName, contactEmail, contactPhone, building, description, years[{yearLabel, enabled, sections[]}]`. `DepartmentRequest`/`YearSectionsRequest` map it field-for-field; `@NotBlank` + `@Size` validate it.
- **The save is one transaction.** `DepartmentService.createDepartment`/`updateDepartment` are `@Transactional`; `Department.academicYears` and `AcademicYear.sections` use `CascadeType.ALL` + `orphanRemoval`, and the helper `addAcademicYear`/`addSection` set both sides of each relation, so a single `save(department)` persists the aggregate (1 + 4 + 8 rows).
- **Update is order-safe.** `updateDepartment` removes deselected sections first (after deleting their timetables and detaching their subjects so FK constraints cannot break), then updates/creates the four standard years and adds new sections — `DepartmentService.java:147-246`.
- **Schema is consistent.** `V1__create_core_schema.sql` `departments` / `academic_years` / `sections` DDL matches the entities field-for-field (`name` unique 150, `uk_dept_year`, `uk_year_section`, `ON DELETE CASCADE` FKs). The H2 dev profile uses `ddl-auto: update`; production uses Flyway with the same shape.
- **Readback/filtering is consistent.** `getDepartmentById`/`getDepartments` map the same persisted structure back; the archived filter (`isArchived`) is a real persisted flag, so newly created active departments always appear in the active list the Faculty/Subject/Timetable dropdowns are built from.

## 3. Files changed this phase

- **Added** `PHASE13_DEPARTMENT_SAVE_REPORT.md` — this report.
- **No production or test source files were changed.** The investigation found the persistence chain correct; the existing `DepartmentPersistenceE2ETest` is the durable regression guard and passes.

## 4. Regression (current source)

| Suite | Result |
|---|---|
| Backend `mvn test` (full) | **221 tests, 0 failures, 0 errors, 0 skipped — BUILD SUCCESS** |
| — `DepartmentPersistenceE2ETest` | 1 run, 0 failures (create → cascade → DB rows → readback → list) |
| — `DepartmentServiceTest` | 4 runs, 0 failures |
| Frontend `npm run build` (`tsc -b` + `vite build`) | **PASS** (1.42 s) |

## 5. Cleanup verification (isolated DB only)

`DELETE /api/v1/departments/{5,8,9}` → **200** each for the temporary `Test Department`, `Proxy Test Dept`, and `Verification Department`. Post-cleanup state — only pre-existing records remain:

```
DEPARTMENTS:  4 | CSD | HOD Tamil | archived=FALSE | 4 years × 1 section (A)
FACULTY:      19
TIMETABLES:   1 (id 1, section 25, semester 1)
```

CSD's full structure, faculty count, and the existing timetable are unchanged.

## 6. Notes

- This conclusion is consistent with `PHASE12_REPORT.md` (11 Aug), which also traced the same chain end-to-end and found it working; the current source still matches that documented behaviour.
- Verification used the app's isolated H2 file profile because this environment has no PostgreSQL/docker; production config remains untouched.
