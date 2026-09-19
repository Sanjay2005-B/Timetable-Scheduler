// Profile / Account types — mirrors backend ProfileResponse & UpdateProfileRequest
export interface ProfileResponse {
  userId: number
  username: string
  email: string
  fullName: string
  phone?: string
  profilePhotoUrl?: string
  departmentId?: number
  departmentName?: string
  institutionName?: string
  institutionAddress?: string
  employeeId?: string
  designation?: string
  roles: string[]
  isActive: boolean
  joinedDate?: string
  lastLoginAt?: string
  activeSessionCount: number
}

// Whitelist enforced by backend DTO: only these fields are writable.
export interface UpdateProfileRequest {
  fullName: string
  phone?: string
  profilePhotoUrl?: string
}

// Change-password payload — mirrors backend ChangePasswordRequest.
// Identity comes from the JWT; the current password is verified server-side.
export interface ChangePasswordRequest {
  currentPassword: string
  newPassword: string
}

// One active login/device for the current user — mirrors backend SessionInfo.
// Refresh tokens are never exposed by the API, so none is present here.
export interface SessionInfo {
  sessionId: number
  device?: string
  ipAddress?: string
  createdAt?: string
  expiresAt?: string
  active: boolean
}

// Response of POST /me/photo — the URL path of the stored file.
export interface UploadPhotoResponse {
  profilePhotoUrl: string
}

// Institution / college info — mirrors backend InstitutionResponse & Request.
// Single global row (id = 1); only SUPER_ADMIN may write it.
export interface InstitutionResponse {
  id: number
  name: string
  address?: string
}

export interface UpdateInstitutionRequest {
  name: string
  address?: string
}