# Profile & Account Management — Implementation Plan

## Decision Summary (4 pending-review decisions, resolved by user)

| # | Decision | Resolution |
|---|---|---|
| 1 | Logout from other devices | **Approved — implement.** Requires refactoring working login/refresh logic to use a `user_sessions` table (not purely additive). Isolated in **Phase 5** with a **test-first** sequence: write baseline login/refresh/logout tests against current code → verify green → implement sessions table → re-run reconciling only deliberate behavioral changes → add new `/me/sessions` endpoint tests. Any other regression = stop & report. |
| 2 | Institution name/address | **Single-row `Institution` (OrgSettings) entity**, not per-user fields. All users read the same global row; **only SUPER_ADMIN can edit** (`PUT /institution`). No free-text institution fields on `User`. |
| 3 | Profile photo storage | **Local disk, configurable** via `app.upload.dir` (`${UPLOAD_DIR:./uploads}`). Durable across restart (same caveat as the file-backed H2 DB); DB stores only the URL, not the file. Missing-file degrade → letter avatar. S3/MinIO swap is a one-class change if ever needed. |
| 4 | Employee ID/designation for non-Faculty roles | **Explicit "N/A" placement** (styled, `text-gray-500 italic`) when no linked `Faculty` record exists — NOT a blank field, NOT an unhandled null. Resolved per-field independently. Read-only for all users. |

---

## Step 1 — Investigation Findings

### 1.1 User Entity — Current Fields

**File:** `backend/src/main/java/.../auth/entity/User.java`

| Field | Type | DB Column | Constraints | Notes |
|---|---|---|---|---|
| `id` | `Long` | `id` | PK, auto-increment | |
| `username` | `String` | `username` | NOT NULL, UNIQUE, 100 chars | |
| `email` | `String` | `email` | NOT NULL, UNIQUE, 255 chars | |
| `password` | `String` | `password` | NOT NULL | BCrypt encoded |
| `fullName` | `String` | `full_name` | NOT NULL, 200 chars | |
| `isActive` | `Boolean` | `is_active` | NOT NULL | Default: `true` |
| `department` | `Department` | `department_id` | ManyToOne, EAGER | FK → departments |
| `refreshToken` | `String` | `refresh_token` | nullable, 500 chars | Single refresh token stored here |
| `refreshTokenExpiry` | `Instant` | `refresh_token_expiry` | nullable | |
| `lastLoginAt` | `Instant` | `last_login_at` | nullable | Set on each login |
| `roles` | `Set<Role>` | via `user_roles` join table | ManyToMany, EAGER | |
| `createdAt` | `Instant` | `created_at` | NOT NULL, auto | From AuditableEntity |
| `updatedAt` | `Instant` | `updated_at` | nullable, auto | From AuditableEntity |
| `createdBy` | `String` | `created_by` | nullable, auto | From AuditableEntity |
| `updatedBy` | `String` | `updated_by` | nullable, auto | From AuditableEntity |

**What's missing for a profile page:** phone, profile photo URL, college/institution address, designation, employee ID, joined date (use `createdAt`).

### 1.2 Authentication Flow — JWT Stateless Setup

| Aspect | Detail |
|---|---|
| Type | **Fully stateless JWT** — no server-side session store |
| Access token | HS512-signed JWT. Claims: `sub` (username), `userId` (Long), `email`, `roles` (List\<String\>). Expires: **24 hours** |
| Refresh token | Plain UUID string (`UUID.randomUUID()`), stored on `User.refreshToken` column in DB. Expires: **7 days** |
| Login | `AuthenticationManager.authenticate()` → generates both tokens → saves refresh token + expiry on User entity → returns both tokens + user metadata |
| Refresh | Looks up User by refresh token value in DB → checks `refreshTokenExpiry.isBefore(now)` → generates new access + refresh tokens → saves to User |
| Logout | Sets `User.refreshToken = null, User.refreshTokenExpiry = null` via `@Query` — revokes that one refresh token |
| Filter | `JwtAuthenticationFilter` (extends `OncePerRequestFilter`) — skips `/auth/**` paths. Extracts Bearer token, validates, loads `UserPrincipal`, sets `SecurityContextHolder` |

### 1.3 Session/Refresh Token Store — CRITICAL FINDING

**There is NO separate session or refresh-token table.** The refresh token lives as a single column on the `User` entity (`refreshToken` / `refreshTokenExpiry`).

**Consequence:** Only ONE device can be logged in at a time. When a user logs in on a new device, the old refresh token is silently overwritten. "Logout from other devices" is **not possible** with the current architecture without new infrastructure.

**Required addition for multi-device logout:** A new `user_sessions` table (see Section 3 below).

**DECISION (approved by user):** Logout-from-other-devices **WILL be implemented**, despite the scope tension. This requires modifying the currently-working login/refresh flow (`AuthService.login`, `AuthController.refresh`, `AuthService.logout`) to route refresh tokens through a `user_sessions` table instead of the single `User.refreshToken` column. This is a change to live authentication logic, **not purely additive** — so it is isolated as its own phase (Phase 5), with its own tests, and is verified BEFORE the profile page is built on top of it.

> **IMPORTANT — test-first sequencing (approved by user):** Investigation found the backend test suite contains **NO existing auth/login/refresh integration tests** (all tests under `backend/src/test/...` are timetable and department focused). Since there is nothing pre-existing to protect, the sessions phase must be **test-first**, in this exact order:
>
> 1. **WRITE baseline tests against the CURRENT (unmodified) login/refresh/logout code** — documenting today's actual behavior, even the parts we are about to change, so we have a clear before/after. Baseline tests cover: login succeeds; refresh rotates the access token; an expired refresh token is rejected; and — deliberately documenting today's behavior — **a second login overwrites the first refresh token** (single-session behavior).
> 2. **Confirm these new baseline tests PASS against the unmodified code** before any code change.
> 3. **Implement the sessions table + multi-device support** (AuthService/AuthController changes).
> 4. **Re-run the same tests, updating ONLY the assertions that describe behavior we deliberately changed** — e.g. "second login overwrites first token" now becomes "second login creates a second session, first still valid". Any test failure **outside** that deliberate change is a **real regression** — stop and report it; do **not** patzch the test to match.
> 5. **Add new tests** specifically for the new endpoints (`GET /me/sessions`, `DELETE /me/sessions/{id}`, `DELETE /me/sessions/all`, plus `logout-all-devices`).
>
> Only after step 5 passes does work proceed to building the profile page on top of the new session model.

### 1.4 File Upload — NONE EXISTS

- Zero references to `MultipartFile`, `upload`, or multipart configuration anywhere in the backend
- No file storage service, no upload controller, no static file serving configured
- Frontend has no file input, no photo upload, no avatar image — only letter-initial avatars

**What's needed for profile photo upload:**
- Spring Boot `spring-boot-starter-web` already handles multipart (no new dependency needed — it's part of the web starter)
- `application.yml`: add `spring.servlet.multipart.max-file-size` and `max-request-size` config
- A new `FileStorageService` (backend service class) — handles saving files
- A new `FileController` endpoint for upload — returns the accessible URL
- Static file serving config to make uploaded files accessible via URL (e.g., `/uploads/photos/...`)
- Frontend: file input + image preview + upload flow

#### Storage location & durability (Decision #3 — approved by user)

**Where photos are stored: local disk, under a configurable path.**

- Config key: `app.upload.dir`, default `${UPLOAD_DIR:./uploads}` → resolved to an absolute path at startup and created if missing.
- Files stored as: `<uploadDir>/photos/<uuid>.<ext>` (extension validated against an allow-list: jpeg, png, webp). Content type and size validated server-side (max 5 MB per the multipart config).
- The DB stores only the relative URL path (`/uploads/photos/<uuid>.<ext>` in `User.profilePhotoUrl`), never the file itself — the DB is also **not** the storage medium.

**Durability — explicitly confirmed for this environment:**
- The DB here is **file-backed H2**, not in-memory: `jdbc:h2:file:${user.home}/.timetable-scheduler/data/timetabledb` (see `application-h2.yml:3`). The earlier DataScare was in-memory H2; current config persists to `~/.timetable-scheduler/data/`.
- Photos stored under `${UPLOAD_DIR}` **survive an application restart** as long as the working directory (or the configured upload path) is not deleted. They are ordinary files on the filesystem.
- **Caveat to flag deliberately:** local disk does **not** survive a full redeploy that wipes the filesystem/container/files dir (e.g., Docker `--rm` with a non-persisted volume, or `git clean`/delete-repo). DB file has the same caveat — both DB and photos live on local disk in this setup, so neither is more fragile than the other.
- **Mitigation baked into the design** (because of the project's data-loss history):
  1. `UPLOAD_DIR` is an environment-variable-driven config, so a durable/external path (host volume, network share, or object store later) can be supplied without code changes.
  2. If a user's stored photo file is missing at request time (dir was cleared but DB row remains), the profile endpoint degrades gracefully to the letter-initial avatar — same as a user with no photo. No crash, no broken image.

**If local disk is deemed insufficient (e.g., a cloud-only deploy is decided later), the smallest reasonable alternative** is to swap `FileStorageService`'s write/read implementation to an S3-compatible object store (MinIO local, or AWS S3) behind the same interface — the controller, DB URL field, and frontend do not change because they only ever see the returned URL. That is a one-class swap, not an architecture change, and is **not** in scope now unless you prefer it.

### 1.5 Email / SMTP — NONE EXISTS

- No mail configuration in `application.yml`, `application-dev.yml`, or `application-h2.yml`
- No Spring Mail dependency in `pom.xml`
- No mail service, mail template, or any email-related code anywhere

**What's needed for Forgot/Reset Password:**
- New Maven dependency: `spring-boot-starter-mail`
- `application.yml` additions: `spring.mail.host`, `port`, `username`, `password`, `properties.mail.smtp.*`
- SMTP credentials from an actual email provider (Gmail SMTP, SendGrid, Mailgun, etc.)
- A `PasswordResetToken` entity + repository (token, userId, expiry, used flag)
- A `MailService` that sends emails with reset links
- A `ForgotPasswordRequest` DTO and API endpoint
- A frontend "Forgot Password" page (the link already exists in `LoginPage.tsx:146` but the route is dead)

**This is a real infrastructure dependency — not trivial.** SMTP credentials and a mail provider must be available before this can work.

### 1.6 Roles & Related Concepts

**Roles** (`Role` entity, `RoleName` enum):
- `ROLE_SUPER_ADMIN` — full system access
- `ROLE_HOD` — head of department
- `ROLE_FACULTY` — faculty/teacher
- `ROLE_EXAM_COORDINATOR` — exam scheduling access

Roles are stored in a `roles` table, linked to users via `user_roles` join table. Eager-loaded on User.

**Designation and Employee ID** — these live on the **`Faculty` entity** (`module/faculty/entity/Faculty.java`), NOT on the User entity:

| Faculty Field | Type | DB Column |
|---|---|---|
| `employeeId` | `String` | `employee_id` (unique, 50 chars) |
| `firstName` | `String` | `first_name` |
| `lastName` | `String` | `last_name` |
| `email` | `String` | `email` (unique) |
| `phone` | `String` | `phone` (20 chars, nullable) |
| `department` | `Department` | FK, eager |
| `designation` | `String` | `designation` (100 chars, nullable) — e.g., "Professor", "Associate Professor" |
| `qualification` | `String` | `qualification` |
| `specialization` | `String` | `specialization` |
| `status` | `String` | `status` (default: "AVAILABLE") |
| **`userId`** | `Long` | `user_id` (nullable) — **links Faculty → User** |

**Key relationship:** `Faculty.userId` → `User.id`. This allows fetching a user's faculty profile (employeeId, designation, phone) via this link. Not all Users are Faculty (e.g., SUPER_ADMIN may not have a Faculty record), so the link is nullable.

**Institution/college address:** No field exists on any entity. No settings module exists on the backend. The `Department` entity has `building` but no address. Per **Decision #2**, a new single-row `Institution` entity (name, address) will be created that all profile pages read from — editable only by SUPER_ADMIN, never per-user.

---

## Step 2 — Feature Requirements

### "My Profile" Page Sections

| Section | Fields |
|---|---|
| **Personal Information** | Full name, profile photo, phone, email |
| **College Information** | Institution name & address (read-only global row from `Institution` entity), department, designation, employee/user ID |
| **Account Information** | Username, role(s), account status (active/inactive), joined date |
| **Security** | Change Password, Forgot/Reset Password, Logout, Logout from Other Devices |

### Security Actions

| Action | Requirement |
|---|---|
| **Change Password** | Must require current password before allowing new one. No silent password changes. |
| **Forgot Password** | Sends reset email with time-limited token link. Requires SMTP infrastructure (Section 1.5). |
| **Reset Password** | Follows link from email, sets new password with token validation |
| **Logout** | Already exists — clears refresh token, navigates to login |
| **Logout from Other Devices** | Requires `user_sessions` table (Section 1.3). Revokes all refresh tokens for the user except the current one. |

---

## Step 3 — Security Requirement Confirmation

**Non-negotiable:** All "my own profile" endpoints derive the user identity **exclusively** from the JWT token on the server side. No client-supplied user ID is ever read, trusted, or compared.

### How It Works

Every endpoint requiring the current user's identity uses Spring Security's `@AuthenticationPrincipal` annotation:

```java
@GetMapping("/me")
public ResponseEntity<ApiResponse<ProfileResponse>> getProfile(
    @AuthenticationPrincipal UserPrincipal principal) {
    // principal.getId() comes from the JWT token, parsed by JwtAuthenticationFilter
    // The client never sends a user ID — there is no @RequestParam, @PathVariable, or body field for it
    Long userId = principal.getId();
    // ... fetch and return profile for this user only
}
```

**Why this is safe:**
1. `JwtAuthenticationFilter` extracts the JWT from the `Authorization` header, validates the signature, and loads a `UserPrincipal` object from the DB
2. The `UserPrincipal.id` is populated from the JWT's `userId` claim — set at token generation time, cannot be forged without the signing key
3. The controller method has **no parameter** for user ID from the request — Spring injects the authenticated principal automatically
4. Even if a client sends `{"userId": 999}` in a body or `?userId=999` in the URL, the endpoint **never reads it** — it only uses `principal.getId()`
5. For change-password: the same `@AuthenticationPrincipal` is used, and the user must supply their current password in the request body (verified against the DB password hash)

**Endpoints that enforce this pattern:**
- `GET /api/v1/me` — uses `@AuthenticationPrincipal`
- `PUT /api/v1/me` — uses `@AuthenticationPrincipal`
- `POST /api/v1/me/change-password` — uses `@AuthenticationPrincipal` + current password verification
- `POST /api/v1/me/photo` — uses `@AuthenticationPrincipal`
- `GET /api/v1/me/sessions` — uses `@AuthenticationPrincipal`
- `DELETE /api/v1/me/sessions/all` — uses `@AuthenticationPrincipal`
- `DELETE /api/v1/me/sessions/{sessionId}` — uses `@AuthenticationPrincipal` + ownership check
- `POST /api/v1/auth/forgot-password` — public (takes email, not user ID)
- `POST /api/v1/auth/reset-password` — public (takes token + new password, not user ID)

---

## Step 4 — Implementation Plan

### 4.1 Existing Things to REUSE

| Existing | Reused For |
|---|---|
| `User.fullName` | Displayed as-is in profile |
| `User.email` | Displayed in profile, used for forgot-password email lookup |
| `User.username` | Displayed in Account Info |
| `User.department` | Displayed in College Information (name from `Department.name`) |
| `User.roles` | Displayed in Account Information |
| `User.isActive` | Displayed as account status in Account Information |
| `User.createdAt` (from AuditableEntity) | Displayed as "joined date" in Account Information |
| `User.lastLoginAt` | Displayed in Security section |
| `Faculty` entity (via `Faculty.userId`) | employeeId, designation, phone — fetched by joining on `userId`. **Nullable**: if no Faculty record exists (SUPER_ADMIN/HOD/EXAM_COORDINATOR), the profile shows "N/A" per Decision #4 |
| `authApi.me()` | Already exists on frontend but is unused — will now be called to fetch full profile |
| Topbar "My Profile" button | Will be wired to navigate to `/profile` |
| `authApi.logout()` | Already handles single-device logout — reused in profile Security section |
| Design system classes (`.card`, `.form-group`, `.input`, `.btn-primary`, `.btn-danger`, `.badge-*`) | Reused for consistent UI |

### 4.2 New Fields — User Entity

**Strategy:** Add directly to the `User` entity (not a separate table) ONLY the fields that are genuinely per-user and personal. The User-to-Faculty link already exists via `Faculty.userId`, so phone-behavior/designation/employeeId are handled from there — no duplication needed. **Institution name/address are NOT personal per-user fields — they are global and live in a separate single-row `Institution` entity (see 4.2B), NOT on User.**

| New Field | Type | DB Column | Why on User (not Faculty) |
|---|---|---|---|
| `phone` | `String` | `phone` (VARCHAR 20, nullable) | Personal contact — may differ from Faculty.phone or User may not have a Faculty record |
| `profilePhotoUrl` | `String` | `profile_photo_url` (VARCHAR 500, nullable) | User's own profile photo — independent of Faculty record |

**Fields NOT added (reused from linked entities instead):**
- `employeeId` — from `Faculty.employeeId` via `Faculty.userId` link
- `designation` — from `Faculty.designation` via `Faculty.userId` link
- `department` — already exists on User
- `joinedDate` — use existing `User.createdAt`
- `institutionName` — **NOT on User**; single global value in `Institution` entity (4.2B)
- `institutionAddress` — **NOT on User**; single global value in `Institution` entity (4.2B)

### 4.2B NEW — Institution / OrgSettings (single global row)

**Decision (approved by user):** Institution name & address are **not** free-text fields on every user. This is one institution running the ERP; every user must see the SAME institution info, not individually-editable copies. They live in a **single-row `Institution` entity**, readable by all authenticated users, editable **only by SUPER_ADMIN**.

**New entity:** `module/auth/entity/Institution.java` — table `institution`

```sql
CREATE TABLE institution (
    id                 BIGINT       NOT NULL PRIMARY KEY,
    name               VARCHAR(200) NOT NULL,
    address            VARCHAR(500),
    updated_at         TIMESTAMP,
    updated_by         VARCHAR(100)
);
-- always exactly one row; id fixed to 1
```

- Entity is a single-row table (id constrained to 1). A startup seed / V8 migration inserts the initial row.
- Every user's profile page reads `name`/`address` from this single row — the `ProfileResponse` includes the institution fields **copied from the `Institution` entity**, not from the user.
- **Edit authorization:** only `ROLE_SUPER_ADMIN` may change it (via `@PreAuthorize("hasRole('ROLE_SUPER_ADMIN')")` on the update endpoint). Regular users see it read-only; nothing in the user-editable `PUT /me` form touches it.
- **New endpoints:**
  - `GET /institution` — `isAuthenticated()` — returns the single institution row (name + address)
  - `PUT /institution` — `hasRole('ROLE_SUPER_ADMIN')` — updates name/address; body is `InstitutionRequest(name, address)`. Identity here is role-gated; no user ID involved.

**New files:** `Institution.java`, `InstitutionRepository.java`, `InstitutionService.java`, `InstitutionController.java`, `InstitutionRequest.java` DTO.

### 4.3 New Database Tables

**Migration files are split per phase** (Flyway files are immutable once applied; phasing requires each migration to be independent and never re-touched after the phase ships):

| Migration | Phase | Contents |
|---|---|---|
| `V8__add_user_profile_columns.sql` | 1 | `ALTER TABLE users ADD phone, profile_photo_url` |
| `V9__create_institution_table.sql` | 3 | `institution` single-row table + seed |
| `V10__create_user_sessions_table.sql` | 5 | `user_sessions` table (multi-device logout) |
| `V11__create_password_reset_tokens.sql` | 8 | `password_reset_tokens` table (SMTP deferred) |

The H2 dev profile has Flyway disabled and uses `ddl-auto: update`, so entity changes auto-apply there; these SQL files are required for the Postgres/Flyway production profile.

#### Table: `institution` (single global row)
Schema shown in 4.2B. Inserted/checked via migration + entity lifecycle ensuring exactly one row (id = 1).

#### Table: `user_sessions` (for multi-device logout)

```sql
CREATE TABLE user_sessions (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id       BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token VARCHAR(500) NOT NULL,
    device_info   VARCHAR(300),
    ip_address    VARCHAR(45),
    created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at    TIMESTAMP    NOT NULL,
    is_revoked    BOOLEAN      NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_refresh_token ON user_sessions(refresh_token);
```

**Migration:** `V10__create_user_sessions_table.sql`

#### Table: `password_reset_tokens` (for forgot/reset password)

```sql
CREATE TABLE password_reset_tokens (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id    BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token      VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP    NOT NULL,
    is_used    BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_password_reset_tokens_token ON password_reset_tokens(token);
```

**Migration:** `V11__create_password_reset_tokens.sql` (separate migration — SMTP is optional/deferred)

### 4.4 New Backend API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/me` | `@AuthenticationPrincipal` | Get full profile (User + linked Faculty data + institution + session count) |
| `PUT` | `/me` | `@AuthenticationPrincipal` | Update own profile fields (phone, fullName, profilePhotoUrl) — **no institution fields, not role-gated beyond self** |
| `POST` | `/me/change-password` | `@AuthenticationPrincipal` | Change password (requires currentPassword + newPassword in body) |
| `POST` | `/me/photo` | `@AuthenticationPrincipal` | Upload profile photo (multipart) — returns photo URL |
| `GET` | `/me/sessions` | `@AuthenticationPrincipal` | List active sessions (device, IP, date) |
| `DELETE` | `/me/sessions/all` | `@AuthenticationPrincipal` | Revoke ALL other sessions (logout-from-other-devices) |
| `DELETE` | `/me/sessions/{sessionId}` | `@AuthenticationPrincipal` | Revoke a specific session (with ownership check) |
| `GET` | `/institution` | `isAuthenticated()` | Get the single global institution row (name + address) |
| `PUT` | `/institution` | `hasRole('ROLE_SUPER_ADMIN')` | Update the single global institution row (name/address) |
| `POST` | `/auth/forgot-password` | Public | Takes email → generates reset token → (sends email if SMTP configured) → returns success |
| `POST` | `/auth/reset-password` | Public | Takes token + newPassword → validates token → resets password |

**Note:** `/auth/forgot-password` is already in the `PUBLIC_ENDPOINTS` array in `SecurityConfig.java:52` — no security config change needed for that route.

> **Institution endpoint security re-confirmed:** `GET /institution` and `PUT /institution` operate on the single global institution row — they involve **no user ID at all**, so the "never trust client-supplied ID" rule has nothing to compare against. The only authorization is identity *authentication* (any logged-in user can read) and *role* (only SUPER_ADMIN can write), enforced via `@PreAuthorize`. No cross-user data exposure is possible because there is no per-user institution data.

### 4.5 New Backend Files

**Module:** `backend/src/main/java/com/erp/timetable/module/auth/` (extends existing auth module)

```
module/auth/
├── controller/
│   ├── AuthController.java          (modify — add forgot/reset endpoints)
│   ├── ProfileController.java       (NEW — /me/* endpoints)
│   └── InstitutionController.java   (NEW — GET/PUT single global institution row)
├── dto/
│   ├── LoginRequest.java            (existing)
│   ├── LoginResponse.java           (existing)
│   ├── RefreshTokenRequest.java     (existing)
│   ├── ProfileResponse.java         (NEW — full profile DTO)
│   ├── UpdateProfileRequest.java    (NEW — editable fields DTO)
│   ├── ChangePasswordRequest.java   (NEW — currentPassword + newPassword)
│   ├── UploadPhotoResponse.java     (NEW — photo URL response)
│   ├── ForgotPasswordRequest.java   (NEW — email field)
│   └── ResetPasswordRequest.java    (NEW — token + newPassword)
├── entity/
│   ├── User.java                    (modify — add 2 new fields: phone, profilePhotoUrl)
│   ├── Role.java                    (existing, unchanged)
│   ├── RoleName.java                (existing, unchanged)
│   ├── Institution.java             (NEW — single-row institution name/address)
│   ├── UserSession.java             (NEW — user_sessions entity)
│   └── PasswordResetToken.java      (NEW — password_reset_tokens entity)
├── repository/
│   ├── UserRepository.java          (existing, unchanged)
│   ├── RoleRepository.java          (existing, unchanged)
│   ├── InstitutionRepository.java   (NEW)
│   ├── UserSessionRepository.java   (NEW)
│   └── PasswordResetTokenRepository.java (NEW)
├── security/
│   ├── JwtTokenProvider.java        (existing, unchanged)
│   ├── JwtAuthenticationFilter.java (existing, unchanged)
│   ├── UserPrincipal.java           (existing, unchanged)
│   └── UserDetailsServiceImpl.java  (existing, unchanged)
└── service/
    ├── AuthService.java             (existing — Phase 5: refactor to sessions table; create UserSession on login)
    ├── ProfileService.java          (NEW — profile CRUD, password change, session management)
    └── InstitutionService.java      (NEW — get/update single global institution row)
```

**Also modify:**
- `common/file/FileStorageService.java` (NEW) — file upload/storage service
- `common/file/FileController.java` (NEW) — upload endpoint, serves files from upload directory

### 4.6 Frontend Changes

| File | Change |
|---|---|
| `src/pages/profile/ProfilePage.tsx` | **NEW** — Full profile page with 4 sections |
| `src/api/institutionApi.ts` | **NEW** — API client for GET/PUT `/institution` (admin edit if SUPER_ADMIN) |
| `src/pages/auth/ForgotPasswordPage.tsx` | **NEW** — Email input form for forgot password |
| `src/pages/auth/ResetPasswordPage.tsx` | **NEW** — Token-based password reset form |
| `src/api/profileApi.ts` | **NEW** — API client for /me/* endpoints |
| `src/types/profile.types.ts` | **NEW** — ProfileResponse, UpdateProfileRequest, ChangePasswordRequest, SessionInfo, Institution types |
| `src/router/AppRouter.tsx` | **MODIFY** — add `/profile`, `/forgot-password`, `/reset-password` routes (profile under protected `MainLayout`) |
| `src/components/layout/Topbar.tsx` | **MODIFY** — wire "My Profile" button (line 80) to `navigate('/profile')` |
| `src/components/layout/Sidebar.tsx` | **MODIFY** — make bottom user section (line 123) clickable → navigate to `/profile` |

**Profile page layout (ProfilePage.tsx):**
- Uses existing `.card`, `.form-group`, `.input`, `.label`, `.btn-primary`, `.btn-danger` CSS classes
- 4 sections rendered as `.card` blocks, stacked vertically
- **College Information section** shows institution name/address **read-only from the single global `Institution` row** (fetched via `GET /institution` / embedded in `ProfileResponse`) — no per-user editing. If the current user is `ROLE_SUPER_ADMIN`, an "Edit Institution" affordance (modal) calls `PUT /institution`; all other roles see it read-only.
- **Employee ID / Designation display:** null (no linked Faculty) → styled **"N/A"** placeholder per Decision #4. Read-only for all roles.
- Photo upload: click avatar → hidden file input → preview → upload via `profileApi.uploadPhoto()`
- Change Password: modal with current password + new password + confirm password fields
- Sessions list: table showing device, IP, date, with "Revoke" buttons + "Revoke All Others" button
- All editing uses inline edit/save pattern (consistent with existing pages)

### 4.7 Files/Modules That Will NOT Be Modified

Explicitly confirmed — zero changes to:

| Module/Feature | Files Untouched |
|---|---|
| Timetable generation | `module/timetable/` — all files |
| Greedy/Timefold scheduling | `scheduling/` packages, solver configs |
| Reports | `module/report/` — all files |
| Departments | `module/department/` — all files |
| Subjects | `module/subject/` — all files |
| Classrooms | `module/classroom/` — all files |
| Faculty (entity/CRUD) | `module/faculty/` — all files (only read via `Faculty.userId`) |
| Availability | `module/availability/` — all files |
| Dashboard | `module/dashboard/` — all files |
| Settings page | `pages/settings/SettingsPage.tsx` — unchanged |
| Existing auth entities | `Role.java`, `RoleName.java` — unchanged |
| Security config | `SecurityConfig.java` — unchanged (`/auth/forgot-password` already in PUBLIC_ENDPOINTS) |

### 4.8 Implementation Order

| Phase | Scope | Depends On |
|---|---|---|
| **Phase 1: User entity + migration** | Add 2 new fields to User.java (`phone`, `profilePhotoUrl`) + V8 migration (institution fields live in a separate `Institution` entity — see 4.2B) | None |
| **Phase 2: Profile API** | ProfileController, ProfileService, DTOs, repository queries | Phase 1 |
| **Phase 3: Institution/OrgSettings** | `Institution` single-row entity + V8 table + SUPER_ADMIN-only endpoint + read-from-institution logic in profile response | Phase 1 |
| **Phase 4: Change Password** | ChangePasswordRequest DTO, ProfileService.changePassword() method, frontend modal | Phase 2 |
| **Phase 5: Multi-device sessions** — isolated, test-first | UserSession entity, V8 table, refactor AuthService.login/refresh/logout to use sessions table, session endpoints. **Test-first sequence:** (1) write baseline login/refresh/logout integration tests against current code; (2) verify they pass unchanged; (3) implement sessions table + multi-device logic; (4) re-run tests updating ONLY deliberate behavioral changes, stop/report any other regression; (5) add new tests for `/me/sessions` endpoints | Phase 1 |
| **Phase 6: File upload** | FileStorageService, FileController, upload config, frontend photo upload. **Includes explicit photo-fallback test (user-requested):** upload a photo → simulate the file being missing/deleted from disk → load the profile → assert it returns the graceful letter-avatar fallback rather than an error | Phase 2 |
| **Phase 7: Frontend profile page** | ProfilePage.tsx, profileApi.ts, types, router wiring, Topbar/Sidebar click handlers. Built on top of the finished session model | Phases 2–6 |
| **Phase 8: Forgot/Reset Password** (optional — requires SMTP) | PasswordResetToken entity, V9 migration, AuthController additions, MailService, ForgotPasswordPage, ResetPasswordPage | SMTP credentials available |

### 4.9 Infrastructure Requirements Summary

| Requirement | Status | What's Needed Before Phase Can Start |
|---|---|---|
| Profile CRUD | **Ready to implement** | Nothing — all infrastructure exists |
| Change Password | **Ready to implement** | Nothing — BCryptPasswordEncoder exists |
| Institution (global row) | **Ready to implement** | V8 migration (institution table + seed row) + SUPER_ADMIN-only endpoint |
| Multi-device sessions | **Requires new table + auth-flow refactor** — a change to working login/refresh code, isolated in Phase 5 with test-first sequence | V8 migration (user_sessions table, UserSession entity), refactor AuthService.login/refresh/logout, baseline tests written BEFORE the refactor |
| Profile photo upload | **Requires new service** | FileStorageService (local disk `${UPLOAD_DIR}`), FileController, upload config in application.yml. See Decision #3 storage/durability notes |
| Forgot/Reset Password | **Requires external dependency** | SMTP provider credentials, `spring-boot-starter-mail` dependency, mail configuration in application.yml, V9 migration |

### 4.10 Application.yml Additions

```yaml
# Add under app: key
app:
  jwt:            # ... existing ...
  cors:           # ... existing ...
  upload:
    dir: ${UPLOAD_DIR:./uploads}
    max-file-size: 5MB
    allowed-types: image/jpeg,image/png,image/webp

# Add spring.servlet.multipart config
spring:
  servlet:
    multipart:
      max-file-size: 5MB
      max-request-size: 5MB

# Add spring.mail config (Phase 7 only — when SMTP is available)
# spring:
#   mail:
#     host: ${MAIL_HOST:smtp.gmail.com}
#     port: ${MAIL_PORT:587}
#     username: ${MAIL_USERNAME:}
#     password: ${MAIL_PASSWORD:}
#     properties:
#       mail:
#         smtp:
#           auth: true
#           starttls:
#             enable: true
```

### 4.11 Auth Store (Frontend) Update

The `AuthUser` type in `auth.types.ts` and `authStore.ts` will need the new fields to support profile display without an extra API call on every page load:

```ts
// Add to AuthUser interface
interface AuthUser {
  userId: number
  username: string
  email: string
  fullName: string
  departmentId?: number
  departmentName?: string
  roles: RoleName[]
  // NEW fields from profile
  phone?: string
  profilePhotoUrl?: string
  employeeId?: string      // from linked Faculty, null if no Faculty record
  designation?: string     // from linked Faculty, null if no Faculty record
}
```

**Institution name/address are NOT in AuthUser** — they are global single-row data owned by the `Institution` entity and served via `GET /institution` / embedded in `ProfileResponse`. Putting them on every `LoginResponse` would couple institution branding to the session store; they are instead fetched once on the profile page. The `LoginResponse` backend DTO gains the per-user fields only (`phone`, `profilePhotoUrl`, `employeeId`, `designation`), and `authStore.setAuth()` populates them.

> **Employee ID / Designation for non-Faculty roles — Decision #4 (explicit UI behavior):**
>
> `ROLE_SUPER_ADMIN`, `ROLE_HOD`, `ROLE_EXAM_COORDINATOR` users may have **no linked `Faculty` record** (`Faculty.userId` is null). The profile page will display **"N/A"** (a deliberate, styled placeholder — `text-gray-500 italic`, consistent with the design system) for BOTH `employeeId` and `designation` in that case.
>
> - This is an **explicit, handled case**, not an unhandled null — the backend `ProfileResponse` returns these fields as `null`, and the frontend maps null → "N/A".
> - Rationale: a blank field looks like a bug; "N/A" is an intentional, user-facing statement that the field does not apply to this account type.
> - Case-by-case: a user may have a partial Faculty record (e.g., `Faculty.phone` present but `designation` null). Each field is resolved independently — `designation` shows "N/A" only if the linked Faculty record has no designation.
> - These fields are **read-only** on the profile page for everyone (they are governed by Faculty/Department management modules, which are out of scope to modify).

---

*Plan revised to incorporate all four user decisions (multi-device sessions with test-first sequencing; single-row Institution entity; local-disk photo storage with durability notes; "N/A" for non-Faculty employeeId/designation). Awaiting final approval before any implementation begins.*
