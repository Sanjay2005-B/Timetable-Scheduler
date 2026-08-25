# Phase 12 — Department Persistence Full-Chain Investigation & Regression Guard (Live UI, No Guessing)

**Status:** VERIFIED — 11 Aug 2026
**Scope:** Trace the complete Department-creation chain UI → API → Controller → DTO → Service → Entity → Repository → DB → GET → selectable-by-Faculty/Subject/Timetable, reproduce it through the real browser UI with a temporary department (`Verification Department`, identifier `VDEPT`), verify persistence at every layer, add a regression test that proves the chain, run the full backend/frontend suites, re-verify the timetable grid fix, then remove only the temporary record.
**Runtime:** Backend `java -jar target/timetable-scheduler-1.0.0.jar --spring.profiles.active=h2` on 8080 (isolated H2 file DB `C:\Users\Sanja\AppData\Local\Temp\opencode\verifydb.mv.db`, `AUTO_SERVER=TRUE`, flyway off, ddl-auto update); frontend vite on 5173 proxying `/api` → 8080. PostgreSQL/docker unavailable → the app's own `application-h2.yml` profile was used; production config (`application.yml`) untouched.

---

## 1. Mandated answers

| Question | Answer | Evidence |
|---|---|---|
| Department persistence reproduced through the real UI? | **YES — works end-to-end** | `POST /api/v1/departments` returned **201** with the full nested department (4 years × 2 sections, each with generated DB ids); the row and all children were found in the H2 file DB; `GET /departments` returns it; a browser reload re-shows it; it is selectable in the Faculty, Subject and Timetable dropdowns. Zero console/page errors. |
| Root cause of a persistence failure? | **No failure reproduces in this environment.** Every layer (DTO names, `@Transactional` save, `CascadeType.ALL` + `orphanRemoval`, both-sides linking, unique constraints, GET filtering) is consistent, so creation persists completely. The prior-session phase A dept (`Verify Engineering`, id 4, sections ids 25/26) had already persisted the same way and is still in the DB — confirming persistence is not environment-specific. |
| Fix applied? | **No code defect found; regression test added** | `backend/src/test/java/com/erp/timetable/module/department/api/DepartmentPersistenceE2ETest.java` boots the real app (MVC + security + JPA + H2) and drives the exact REST contract the frontend uses, asserting cascade rows exist in the DB and read back with generated ids — the chain unit tests could not see. |
| Any production-config or migration mismatch? | **NO** | Prod (`application.yml`) is `ddl-auto: none` + Flyway `validate-on-migrate: true`; `V1__create_core_schema.sql` `departments`/`academic_years`/`sections` DDL matches the entities field-for-field (`name` unique 150, `uk_dept_year`, `uk_year_section`, checks, `ON DELETE CASCADE` FKs). |
| Mentor data modified/deleted? | **NO** | Post-cleanup H2 check: seed departments 1–3, faculty 3, classrooms 3, subjects 1–3 + prior-phase verification rows (`Verify Engineering` id 4, `VFY001`, `VFY101` id 5) all intact. |
| Temporary data cleaned? | **YES** | `Verification Department` (id 33) deleted via the authenticated API; its 4 `academic_years` and 8 `sections` rows removed by orphan removal; nothing else touched. |
| Full regression green? | **YES** | `mvn clean test` → **210 tests, 0 failures** (209 baseline + 1 new). `npm.cmd run build` → PASS. Timetable grid fix re-verified live (7 columns, 6 rows, entries render, headers without seconds). |

## 2. Full-chain trace evidence (each hop verified)

| Hop | Verified artifact | Evidence |
|---|---|---|
| UI form → payload | `DepartmentsPage.tsx` `formData` → `departmentApi.createDepartment` → `POST /departments` | Playwright captured the real request; frontend sends `name, hodName, contactEmail, contactPhone, building, description, years[{yearLabel, enabled, sections[]}]` |
| HTTP response | `DepartmentController.createDepartment` `@PreAuthorize(SUPER_ADMIN/HOD)` → 201 | Live: **201** `{"success":true,"message":"Department created successfully","data":{...}}` |
| DTO validation | `DepartmentRequest` (`@NotBlank name`, `@Size` caps) + `YearSectionsRequest` | Matches payload field-for-field; service `normalizeYearSections` uppercases/dedupes and enforces sections A–E |
| Service | `DepartmentService.createDepartment` (`@Transactional`) | Builds the fixed 4 years, calls `year.addSection(...)` and `department.addAcademicYear(year)` (sets both sides), saves the aggregate in one transaction |
| Entity cascade | `Department.academicYears` (`CascadeType.ALL, orphanRemoval`), `AcademicYear.sections` (same), `addAcademicYear`/`addSection` link both sides | Single `save(department)` persisted 1 + 4 + 8 rows |
| Repository | `DepartmentRepository.save`, `existsByName` unique-name guard | Live duplicate `name` would 400 (BusinessException) |
| DB | H2 file DB | `DEPARTMENTS` id 33 + 4 `ACADEMIC_YEARS` + 8 `SECTIONS` rows (strength 60, ACTIVE) — direct SQL via H2 Shell |
| GET readback | `DepartmentService.getDepartments` / `getDepartmentById` → `mapToResponse` | `GET /departments?search=Verification&archived=false` returned the dept with all years/sections and their ids |
| Selectable by Faculty / Subject / Timetable | Those modules build their department dropdowns from the same `GET /departments` list | Live UI: `Verification Department` appeared as an option in the Faculty create form, Subject create form, and Timetable department selector |

### 2.1 Before/after — the real request and response

Request payload the browser actually sent (playwright `waitForResponse`):

```json
{
  "name": "Verification Department",
  "hodName": "VDEPT",
  "contactEmail": "vdept@college.edu",
  "contactPhone": "+91 9000000002",
  "building": "VDEPT Block",
  "description": "Temporary department used to verify full persistence chain (VDEPT).",
  "years": [
    {"yearLabel": "1st Year", "enabled": true, "sections": ["A", "B"]},
    {"yearLabel": "2nd Year", "enabled": true, "sections": ["A", "B"]},
    {"yearLabel": "3rd Year", "enabled": true, "sections": ["A", "B"]},
    {"yearLabel": "4th Year", "enabled": true, "sections": ["A", "B"]}
  ]
}
```

Response status **201**, envelope `success=true`, `data` carried `id: 33` and 4 `academicYears` (ids 33–36), each with sections A/B (ids 33–40) at `studentStrength: 60`, `status: "ACTIVE"`. The `GET /departments` list readback returned the identical structure.

### 2.2 DB ground truth (H2 Shell, direct SQL)

```
DEPARTMENTS:  33 | Verification Department | VDEPT   (is_archived=FALSE)
ACADEMIC_YEARS (dept 33): 33→'1st Year', 34→'2nd Year', 35→'3rd Year', 36→'4th Year'  (all is_enabled=TRUE)
SECTIONS (dept 33): ids 33–40 = A,B per year; strength 60; status ACTIVE
```

## 3. Files changed this phase

- **Added** `backend/src/test/java/com/erp/timetable/module/department/api/DepartmentPersistenceE2ETest.java` — `@SpringBootTest` + `@ActiveProfiles("h2")` + `@WithMockUser(roles = "SUPER_ADMIN")` + `@Transactional`. Posts the exact frontend-shaped payload to `POST /departments`, asserts **201** and the full nested response, asserts the DB actually contains the department + 4 years + 8 sections via `JdbcTemplate`, reads the department back by id, and asserts it appears in the searchable list contract that feeds the Faculty/Subject/Timetable dropdowns. Rolls back; leaves nothing behind.
- **No production code changed** — the investigation found the persistence chain correct; the new test is the durable regression guard.

## 4. Regression (current source)

| Suite | Result |
|---|---|
| Backend `mvn clean test` (full) | **210 tests, 0 failures, 0 errors, 0 skipped — BUILD SUCCESS** (209 baseline + 1 new `DepartmentPersistenceE2ETest`) |
| Frontend `npm.cmd run build` (`tsc -b` + `vite build`) | **PASS** (built in ~1.3 s) |
| Timetable grid regression (live UI) | 7 slot columns with `HH:mm - HH:mm` headers (no seconds — `TimetablePage.tsx:129` fix holds), 6 day rows, 42 cells, `VFY101` renders 5 cells (4 theory + 1 lab), purple LAB cell present, 5 lock/unlock buttons — no regression |

## 5. Cleanup verification (isolated DB only)

`DELETE /api/v1/departments/33` → **200** `"Department deleted successfully"`. Post-cleanup SQL: `DEPARTMENTS` total 4 (`DEPT_33=0`), `ACADEMIC_YEARS where department_id=33` → 0, `SECTIONS` for those years → 0. Remaining rows are only seed data (ids 1–3) plus prior-phase `Verify Engineering` (id 4) and its artifacts — untouched. `faculty` 4, `subjects` 4, `classrooms` 3, all unmodified.

## 6. Notes

- `mvn clean test` requires the running backend stopped on Windows (jar file lock); the backend was repackaged (`mvn package -DskipTests`) and restarted with the same isolated-file-DB args afterwards.
- Runtime verification used the app's isolated H2 file profile because this environment has no PostgreSQL/docker; production config remains untouched and untested here.
