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