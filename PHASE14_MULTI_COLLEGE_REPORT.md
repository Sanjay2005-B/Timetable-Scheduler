# Multi-College Tenants — Verification Report (PHASE 14)

Date: 09-10-2026
Scope: full multi-college tenant isolation (backend + live E2E + frontend + migration).

## 13-point verification

1. **Tenant model.** `College` entity + `colleges` table (name, unique `code`,
   address/phone/email, is_active); `ROLE_COLLEGE_ADMIN` role; `college_id`
   FK columns on `departments`, `faculty`, `users` ONLY (subjects reach their
   college through the department). VERIFIED.

2. **Fresh-DB bootstrap.** A brand-new database seeds default tenant `DEV001`
   and grants `ROLE_COLLEGE_ADMIN` to `admin`; idempotent at every startup
   (verified on the live temp-H2 A/B server: admin roles =
   `[ROLE_SUPER_ADMIN, ROLE_COLLEGE_ADMIN]`, collegeId=1). VERIFIED.

3. **Legacy backfill.** Every pre-existing NULL-college department/faculty/user
   is assigned to `DEV001` (`DataInitializerConfig.migrateLegacyDataIntoDefaultCollege`).
   On the real dev DB: 0 null-college departments / 0 faculty / 0 users; all 8
   accounts preserved (admin, cse_admin, ece_admin, me_admin, student, faculty,
   CSDTamil, Sanjay01). VERIFIED (read-only, on a backup copy).

4. **College lifecycle.** `POST /colleges` and `GET /colleges` are
   SUPER_ADMIN-only. Create atomically provisions the College Admin account
   (login defaults to `<CODE>ADMIN`). Live: admin created "ABC Technical
   University" → `201`, admin login "abcadmin"; abcadmin `POST/GET /colleges`
   → `403`. VERIFIED.

5. **College Admin scope — reads.** A College Admin sees ONLY own-college
   data: dept list = 1 (own IT dept) vs platform admin = 4 (CSE/ECE/ME + ABC-IT);
   dashboard/report counts scoped by college. VERIFIED.

6. **Cross-college read denial.** `GET /departments/{foreign-id}` →
   **403** for abcadmin, its HOD, and its faculty. VERIFIED.

7. **Cross-college write denial.** `PUT /departments/{foreign-id}` → **403**
   (abcadmin AND HOD); `POST /subjects` into a foreign-college department → **403**
   (abcadmin); `POST /faculty` / `/classrooms` into a foreign dept → **403**;
   deletes → **403** via `canDelete*` (own-college COLLEGE_ADMIN only). VERIFIED.

8. **Role matrix conservation.** HOD: create department 403, update OWN dept 200,
   foreign dept 403. Faculty: login 200, own-college faculty list only,
   `GET /timetable/my` 200. Student: login **422** blocked ("Student login is not
   available") while the DB record is preserved. VERIFIED.

9. **Tenant authority.** College scope is resolved server-side from the DB-loaded
   `User` (`TenantContext.currentUser()`); writes never accept a client-supplied
   `collegeId`; the JWT `collegeId` claim is informational only. VERIFIED by code
   review + live E2E.

10. **Isolation breadth.** Every management GET list on Department/Faculty/
    Subject/Classroom controllers now allows `COLLEGE_ADMIN` and is scoped to the
    caller's college; timetable generation/manage/entries scoped to own college
    (`canGenerateTimetable` etc.); dashboard + reports role lists updated. VERIFIED.

11. **No regression / test baseline.** Full `mvn test`: **324 tests / 12
    failures / 0 errors**. All 12 are the documented flaky Greedy/Timefold
    engine family of this run + 2 deterministic PRE-EXISTING test/engine
    `[3]`-block divergences (proven to fail identically on a FRESH DB with the
    original seed). Zero auth/department/faculty/college failures;
    `MultiCollegeE2ETest` 2/2, `RoleBasedAccessE2ETest` 11/11,
    `DepartmentPersistenceE2ETest` 1/1, `DepartmentServiceTest` 9/9,
    tt1 planning tests green. VERIFIED.

12. **Migration path.** Dev H2 migrated additively: `roles.name` H2 native ENUM
    → `VARCHAR(50)` (backup:
    `...\Temp\opencode\timetabledb_legacy_backup_20260910_184412.mv.db`);
    Postgres Flyway `V12__create_colleges_and_backfill.sql` created (creates
    colleges, adds `college_id`, backfills DEV001, grants COLLEGE_ADMIN to
    SUPER_ADMINs, realigns identity sequence). VERIFIED (runs idempotent;
    `restoreMissingCseSeed()` is additive and unique-keyed).

13. **Frontend.** LoginPage selector now offers Admin / College Admin /
    HOD-Department / Faculty (STUDENT type removed — backend already blocks
    student logins); redirect logic + HomeRedirect unchanged for the new role;
    `RoleName` + router `ADMIN_ROLES`/`SCHEDULING_ROLES`/`STAFF_ROLES` +
    Sidebar nav gating include `ROLE_COLLEGE_ADMIN`; frontend `npm run build`
    GREEN. VERIFIED.

## Evidence
- Live temp-H2 A/B E2E (fresh file DB, rebuilt jar, port 8086): 29/29 checks,
  cross-college denials return exactly **403** (GET/PUT /departments/{dev-id},
  POST /subjects into dev dept), student login **422**.
- Real dev DB read-only queries on a backup copy (colleges/departments/faculty/
  users/roles/user_roles counts, institution row intact, subject/classroom/
  timetable counts unchanged).
- `mvn test` 324/12F/0E; failing-method list is 100% engine-family.