# PHASE 15 — Faculty Self-Service + Forgot/Reset Password

**Date:** 15-09-2026
**Requirement:** Make ROLE_FACULTY a self-service role — it can only access Timetable, its own subjects and
Profile — and deliver a working Forgot / Reset password flow (no SMTP).

---

## 1. What changed (backend)

### 1.1 Faculty-role lockdown (real-JWT 403s)
- `RbacGuard` denies ROLE_FACULTY for: view of Department/Faculty/Subject/Classroom/Timetable/SectionTimetable,
  Availability read+write, and Faculty Report (no self-allow). The coarse `fallbackRoleAllowed` still lists FACULTY
  but it only applies when `currentUser() == null` (MockUser in old tests) — a real faculty JWT always resolves the
  current user and is denied.
- `'FACULTY'` removed from the list-endpoint `@PreAuthorize`s: GET `/departments`, `/faculty`, `/subjects`,
  `/classrooms`, `/reports/rooms/utilization`, `/dashboard/stats`. HOD / COLLEGE_ADMIN / EXAM_COORDINATOR unchanged.
- **NEW** `GET /subjects/my` (`@PreAuthorize("hasRole('ROLE_FACULTY')")`) → `SubjectService.getMySubjects` returns
  only the subjects assigned to the calling faculty (User → Faculty link). Self-scoped, read-only.

### 1.2 Forgot / Reset password (public, token-based, no SMTP)
- `POST /auth/forgot-password` (public) → finds ACTIVE accounts by `usernameOrEmail`:
  - 0 candidates → 200 `{ data: { resetToken: null } }` (no account enumeration).
  - >1 candidates (shared login across colleges) → 422.
  - exactly 1 → stores a SHA-256 hash + 15-min expiry on the `User` row and returns the RAW token **once** in the
    body (dev-mode delivery until an SMTP transport exists).
- `POST /auth/reset-password` (public) → validates token (hash match, not used, not expired):
  - success → DELETES all `user_sessions` for that user (every old refresh token dies) and re-encodes the new
    password (same bcrypt path as change-password). Password `@Size(min=8, max=128)`.
  - replay / invalid / expired token → 422 "Reset token has expired...".
- DTOs `ForgotPasswordRequest` / `ResetPasswordRequest`; migration
  `V15__add_password_reset_columns.sql` (Postgres; h2 dev DB gets columns via `ddl-auto:update`).
  `reset_password_used` column marks single-use.

## 2. What changed (frontend)
- **MySubjectsPage** (`/my-subjects`, FACULTY only) — read-only cards for `GET /subjects/my`.
- **ForgotPasswordPage** (`/forgot-password`, public) — requests a token; shows the one-time code box with copy
  button when `data.resetToken` is present, generic message when null (no account enumeration).
- **ResetPasswordPage** (`/reset-password?token=...`, public) — prefilled token from the URL, manual token input
  fallback, new + confirm password, error surfaces "invalid or expired", success → `/login` after 2.5 s.
- **LoginPage** — "Forgot password?" is now a router `Link` to `/forgot-password`.
- **ProfilePage** — the "Forgot / Reset Password" button (previously a disabled placeholder) now navigates to
  `/forgot-password`; the Active Sessions block + query are hidden for FACULTY (`enabled: !isFaculty`).
- **Sidebar / AppRouter / HomeRedirect** — `MANAGEMENT_STAFF_ROLES` (SUPER_ADMIN, COLLEGE_ADMIN, HOD,
  EXAM_COORDINATOR) controls staff pages; FACULTY/STUDENT land on `/my-timetable`; FACULTY gains "My Subjects";
  forgot/reset routes are public and use `authApi.forgotPassword` / `authApi.resetPassword` with `skipAuth: true`
  (JWT + auto-refresh bypassed so stale tokens cannot break the public flow).

## 3. Tests
- `FacultyRoleE2ETest` — 7 tests. Real faculty JWT: 403s on all six master-data lists, single-resource reads
  (own dept/faculty/subject/classroom, `/timetable/department/{id}`, `/timetable/section/{id}/semester/1`,
  `/timetable/999999`), writes, and `POST /timetable/generate`; `/subjects/my` + `/timetable/my` self-scoped 200;
  `/auth/me` + `/me` 200.
- `PasswordResetE2ETest` — 8 tests. Happy-path rotate (old pw 401, new pw 200); single-use replay 422; invalid token
  422; expired token 422 + old pw still valid; unknown identifier 200 no token; shared login across 2 colleges 422;
  short password 400; refresh token revoked after reset 422.
- **Full targeted batch: 93 tests / 0 failures** — AuthFlow 18, CollegeRegistration 5, FacultyRole 7, InstitutionApi 8,
  MultiCollege 7, PasswordReset 8, PhotoUpload 9, ProfileApi 10, RoleBasedAccess 11, DepartmentService 9,
  DepartmentPersistence 1. Frontend `npm run build` green. (The only full-suite failures remain the 12 documented
  flaky Greedy/Timefold engine tests — unrelated.)

## 4. Live verification (dev H2 DB, rebuilt jar 11:31, server PID 10920 :8080)
25 checks, all PASS (script `C:\Users\Sanja\AppData\Local\Temp\opencode\live_verify_faculty_reset.ps1`):
- admin + faculty login 200 (roles include ROLE_FACULTY).
- faculty 403 on GET `/departments`, `/faculty`, `/subjects`, `/classrooms`, `/reports/rooms/utilization`,
  `/dashboard/stats` and on `POST /timetable/generate` with a **valid** body (empty `{}` returns 400 first because
  `@Valid` runs before method security — a test-design trap, not a bug).
- faculty 200 on `/subjects/my` (empty for the dev faculty — no assignment), `/timetable/my`, `/auth/me`, `/me`.
- forgot → 200 + 36-char UUID resetToken; unknown identifier → 200 null token.
- reset to a temp password → old pw now 401, temp pw 200; token replay → 422; forgot → reset back to the original
  `Faculty@1234` → login works again. Admin depts list intact (9).

## 5. Notes / gotchas
- No SMTP yet: the raw reset token is intentionally returned in the response for dev/demo. Swap it for an email
  transport later; the stored-value contract (SHA-256 hash, TTL, single-use) is already production-shaped.
- `ForgotPasswordResponse` returns `resetToken: null` on the no-candidates path — the null must go through a
  `HashMap` (a `Map.of("resetToken", null)` throws NPE).
- The dev H2 database needed no manual schema change (`users.reset_password_*` added by ddl-auto). Faculty password
  ends unchanged.
- Real faculty logins are strictly scoped; `@WithMockUser(roles = "FACULTY")` in MockMvc skips the guard's
  user-scoping (falls back to role-only) — any new faculty E2E must log in with a real JWT to prove 403s.

## 6. Report
Complete. Backend rebuilt, backend restarted on :8080 with the h2 profile, frontend build green, all targeted
suites green, live flow verified end-to-end.