# Phase 11 Real Application Verification Report — Subject Creator → AI Generator (Live UI, No Fake Data)

**Status:** PASS — 11 Aug 2026
**Scope:** Run the real application (fresh backend jar from current source + fresh frontend dev server) and drive the **actual browser UI** end-to-end — Department → Year → Section → Semester → Subjects (Subject Creator) → Save → DB → Run AI Generator → Generated Timetable. Prove demand/block/LAB/diagnostics/regeneration behaviors on the live UI without touching mentor data and without creating any fake LAB/subjects. Then full regression (`mvn clean test`, `npm.cmd run build`).
**Runtime:** Backend `java -jar target/timetable-scheduler-1.0.0.jar --spring.profiles.active=h2` on 8080 (isolated H2 **file** DB in temp, `AUTO_SERVER=TRUE`, flyway off, ddl-auto update); frontend `npm.cmd run dev` (vite 8.1.5) on 5173 proxying `/api` → 8080. PostgreSQL/docker unavailable in this environment, so the app's own `application-h2.yml` profile was used — production config (`application.yml`) was not modified.

---

## 1. Mandated answers

| Question | Answer | Evidence |
|---|---|---|
| Existing (mentor) data modified/deleted? | **NO** | Post-run H2 integrity check: seed `departments`=3, `faculty`=3, `classrooms`=3, `subjects`=3 — all unchanged; seed rooms `CS-101`(70)/`CS-LAB1`(40)/`EC-201`(120) and seed subjects `CS201`(3/0), `CS202`(3/0), `CS205L`(0/3) byte-identical. Only my own rows (`Verify Engineering` dept id 4) exist besides them. |
| Temporary data created? | **YES** | One department `Verify Engineering` (id 4, years 1–4, sections A/B), one faculty `VFY001 "Verify Prof"` (id 5), one subject `VFY101` (id 4), two timetables — all confined to the isolated H2 file DB in temp. |
| Fake LAB room created? | **NO** | No classroom was created during any phase; `classrooms` count stayed **3**. Practicals used only the real seeded LAB `CS-LAB1` (capacity 40). |
| Fake subject created in production DB? | **NO** | The only new subject is `VFY101` inside the isolated verification DB. The infeasibility demo used the real seed subjects `CS201`/`CS202`/`CS205L`. |
| Capacity/lab rules weakened? | **NO** | LAB placement required capacity ≥ section strength, never relaxed. Section A of the temp dept had strength set to 40 (fits `CS-LAB1`); seed CSE 1st-year section kept strength 60 → LAB correctly refused. |
| Demand hard-coded? | **NO** | Weekly demand followed DB values exactly: **7** (5 theory + 2 lab) → after editing the same subject to 4/1 → **5** (4 theory + 1 lab) on unlocked-only regeneration. No 42/36/6/3/session constants. |
| Real structured diagnostics? | **YES** | Live UI Conflict Analysis Report showed `LAB_CAPACITY_INSUFFICIENT` HIGH SEVERITY with the truthful reason (required capacity 60, largest LAB capacity 40). Also observed truthful `MISSING_CURRICULUM` HIGH for a section with no subjects — never fake success. |

## 2. Live E2E — exact observed values

### 2.1 Phase A — Department via UI
Created `Verify Engineering` through the Departments page (all 4 years enabled, sections A/B, strength 60 seeded). Section A id **25**, Section B id **26**. Then (own rows only) set section 25 `student_strength = 40` in the isolated DB.

### 2.2 Phase B — Faculty + Subject via UI (source of truth)
- Faculty `VFY001 "Verify Prof"` created via Faculty page: primary dept `Verify Engineering`, `teaching_departments = null`, `max_daily=6`, `max_weekly=24`, `AVAILABLE`.
- Subject Creator create-form defaults (verified in the live DOM): **semester=3, credits=4, theory=3, practicalHours=0** — THEORY default `practicalHours=0` confirmed in the running app.
- Subject `VFY101` created via Subject Creator: dept `Verify Engineering`, 1st Year, Section A, **semester 1**, THEORY, **theory 5 / practical 2**, **consecutive block 2**, faculty `Verify Prof`. Table row: `5h Theory + 2h Lab`, `2×consecutive`, Sem 1. DB row: `theory=5, practical=2, block=2`.

### 2.3 Phase C — Generate, verify 7, edit, lock, regenerate to 5
**Generate** (`POST /timetable/generate`): status `GENERATED`, `academicSession = "2026-2027 ODD"` (**calendar-derived** by `currentAcademicSession()`, not the removed hard-coded `2025-2026 EVEN`), score 100, 0 conflicts.

| Check | Observed |
|---|---|
| Entries | **7** = 5 theory + 2 lab |
| No clashes | all `(day, timeSlotId)` pairs distinct |
| LAB-only | lab periods **only** in `CS-LAB1` (2 consecutive, MON P1–P2 = block of 2) |
| Theory rooms | `CS-101`, `EC-201` — never `CS-LAB1` |
| Faculty | `Verify Prof` only |
| Grid (DOM) | 7 columns (all non-break slots), 6 day rows, 42 cells, 35 empty cells (`&nbsp;`), **2 purple cells identified purely by `isLab`** |

**Live UI bug found & fixed:** the grid rendered an empty table even though 7 entries existed. Root cause: grid headers are built from the TimeSlot master whose `LocalTime` is serialized by Jackson **with seconds** (`09:00:00 - 09:50:00`), while `entryMap` keys use `TimetableEntryDto.timeSlotTime` = `getStartTime() + " - " + getEndTime()` → Java `LocalTime.toString()` **without seconds** (`09:00 - 09:50`). Keys never matched, so every cell rendered empty. Fixed by normalizing the master times to the entry format (`TimetablePage.tsx:129`); grid then rendered all 7 entries. Backend tests only assert `timeSlotTime` non-null, so no backend/test change was needed.

**Edit same subject 5/2 → 4/1** via the Subject Creator edit modal: row now shows `4h Theory + 1h Lab` (demand 7 → 5).

**Lock 2 theory entries** (MON P5, MON P6) via the grid lock buttons → `isLocked=true`.

**Regenerate unlocked only** (`POST /timetable/{id}/regenerate-unlocked`): total **5** = 4 theory + 1 lab; the 2 locked entries **preserved exactly** (same id / day / slot / room); new demand backfilled (2 theory + 1 lab); all slots distinct; single remaining lab period placed in `CS-LAB1` (practical 1 with block 2 → remainder path, one single-period practical). No capacity relaxation: rooms used `CS-101` + `CS-LAB1` only.

### 2.4 Phase D — truthful infeasibility on real seed data (zero modifications)
Target: seed CSE **1st Year Sec A** (strength **60**) semester 3, subjects `CS201` (theory 3), `CS202` (theory 3), `CS205L` (LAB practical 3). Only LAB room capacity = 40 < 60.

| Check | Observed |
|---|---|
| Theory placed | **6** entries (`CS201`+`CS202`) in `CS-101` (70) / `EC-201` (120) — capacity satisfied |
| Lab placed | **0** (`CS205L` correctly **not** placed) |
| Diagnostics | **3× `LAB_CAPACITY_INSUFFICIENT` HIGH** — `"…practical demand 3, required block 1, required room type LAB, required capacity 60… no LAB room with capacity >= 60; largest available LAB capacity is 40…"` |
| UI | Conflicts Detected badge + Conflict Analysis Report modal listing `LAB_CAPACITY_INSUFFICIENT` / HIGH SEVERITY |
| Score | 94 (unmet demand reflected — no fake 100%) |

Also verified: generating for a section with no subjects returns truthful `MISSING_CURRICULUM` HIGH (observed when 2nd Year was initially tried).

## 3. Files changed this phase

- `frontend/src/pages/timetable/TimetablePage.tsx:118-129` — normalize TimeSlot-master header times to `HH:mm - HH:mm` (strip seconds) so grid columns exactly match `entryMap` keys built from `entry.timeSlotTime`. **Behavior:** generated timetable entries are now actually visible in the grid.
- Prior phases' fixes already in current source (re-verified live): `GenerateTimetableRequest.java:29` (no hard-coded session), `TimetablePage.tsx:17` (calendar semester default), `SubjectsPage.tsx:27,92` (THEORY `practicalHours=0`).

## 4. Regression (current source)

| Suite | Result |
|---|---|
| Backend `mvn clean test` (full) | **209 tests, 0 failures, 0 errors, 0 skipped — BUILD SUCCESS** |
| Frontend `npm.cmd run build` (`tsc -b` + `vite build`) | **PASS** (built in ~0.9 s) |

## 5. Remaining real-world limitations / notes

1. **404 console noise:** `GET /timetable/section/{id}/semester/{sem}` returns 404 while no timetable exists yet; the app catches it (`queryFn` catch → null → “No Timetable Generated Yet”) so UX is correct, but the browser logs a console error per un-generated section. Cosmetic.
2. **`mvn clean test` needs the running backend stopped** on Windows (jar file lock).
3. **Runtime DB choice:** verification used the isolated H2 file profile because this environment has no PostgreSQL/docker; production config untouched and untested here.
4. **Empty cells render as blank (`&nbsp;`)** rather than an explicit “Free Period” label — unscheduled demand instead surfaces truthfully as conflict records.
5. Seed data maps sem-3 subjects onto CSE 1st-year section (seed quirk, not a code issue).

## 6. Artifacts

- Isolated H2 file DB: `C:\Users\Sanja\AppData\Local\Temp\opencode\verifydb.*` (temp — disposable).
- Automation scripts (Playwright-core, headless Chrome): `C:\Users\Sanja\AppData\Local\Temp\opencode\ui\phase-{a,b,c,d}.js` + `phase-*-out.json` evidence.
- Running now: backend `java` on :8080 (H2 verifydb), frontend `vite` on :5173 — both from current source.
