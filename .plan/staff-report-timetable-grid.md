# Plan: Staff Report → Weekly Timetable Grid

## Current State

**File to change:** `ReportsPage.tsx` (147 lines, single file, flat component)

**Current display:** A flat `<table>` with columns Day | Period | Subject Course | Classroom. Each entry is a row — NOT a weekly grid.

**Target display:** A day × slot timetable grid identical in structure to the TimetablePage grid, but showing only the selected faculty member's classes with "FREE" for empty cells.

## Changes Required

### 1. Backend: `ReportService.java` — Enrich entry data

The current `/reports/faculty/{id}` endpoint returns minimal entry data (`day`, `slot`, `subject`, `room`). The grid needs `timeSlotId`, separate `subjectCode`/`subjectName`, section info, and `isLab`.

**What changes:**
- In `getFacultyReport()` → `.map(e -> Map.of(...))`, replace the flat map with a richer one that includes:
  - `"timeSlotId"` → `e.getTimeSlot().getId()`
  - `"subjectCode"` → `e.getSubject().getSubjectCode()`
  - `"subjectName"` → `e.getSubject().getSubjectName()`
  - `"isLab"` → `e.getIsLab()`
  - `"sectionName"` → `e.getSection().getName()` (e.g. "A")
  - `"yearLabel"` → `e.getSection().getAcademicYear().getYearLabel()` (e.g. "Year I")
  - `"roomNumber"` → `e.getClassroom().getRoomNumber()`
  - Remove old `"subject"` (combined) and `"slot"` (slotOrder) and `"room"` — replace with the new fields

**No other backend files change.** No new endpoints. No schema changes.

### 2. Frontend: `ReportsPage.tsx` — Replace flat table with timetable grid

**What changes:**

a) **Add imports:** `availabilityApi` + `TimeSlot` type, `DAYS` constant, icons (`User`, `Building2` from lucide-react)

b) **Add TimeSlot query:** Fetch `availabilityApi.getTimeSlots()` to get the column headers (same pattern as TimetablePage)

c) **Build columns from TimeSlot master:** Filter out break slots, sort by `slotOrder`, create `{ key: string, label: string }[]` — same pattern as TimetablePage lines 118-133

d) **Build entryMap:** Key entries by `${day}_${timeSlotId}` — same pattern as TimetablePage lines 137-140

e) **Replace flat table with grid:** A `<table>` with:
  - Header row: "DAY / SLOT" + one column per TimeSlot (sorted by slotOrder, break/lunch excluded)
  - Body rows: MON through SAT
  - Each cell: look up `entryMap.get(${day}_${slotId})`
    - If found → show subjectCode, subjectName, section info (year + section), roomNumber
    - If not found → show "FREE"

f) **Keep unchanged:** Page header, KPI cards, faculty dropdown selector, room utilization section

### 3. No other files change

- No other pages
- No other components
- No router changes
- No database schema
- No other API endpoints
- No other report types

## Existing Logic Reused

| Pattern | Source | How reused |
|---------|--------|------------|
| DAYS constant | `TimetablePage.tsx:11` | Same 6 days |
| TimeSlot query | `availabilityApi.getTimeSlots()` | Already exists |
| Break filtering | `TimetablePage.tsx:119` | `filter(ts => !ts.isBreak)` |
| Sort by slotOrder | `TimetablePage.tsx:120` | `sort((a,b) => a.slotOrder - b.slotOrder)` |
| Columns construction | `TimetablePage.tsx:126-133` | Same `key`/`label` pattern |
| entryMap keying | `TimetablePage.tsx:137-140` | Same `${day}_${id}` pattern |
| Grid CSS classes | `TimetablePage.tsx:298-361` | Same table styling, `tt-cell-*` classes |
| Faculty dropdown | `ReportsPage.tsx:94-103` | Already exists, no change |

## Verification

1. Select Staff A → grid shows MON-SAT × 7 periods, Staff A's classes in correct cells, FREE elsewhere
2. Select Staff B → grid updates to Staff B's schedule only
3. Cells show: SubjectCode, SubjectName, Year-Section, RoomNumber (or "FREE")
4. Break/lunch periods are excluded from columns (same as TimetablePage)
5. Columns use TimeSlot startTime-endTime headers, sorted by slotOrder
6. All existing functionality (KPI cards, room report, faculty dropdown) unchanged
7. `npm run build` passes cleanly
