import { RoleName } from './common.types'

export interface LoginRequest {
  usernameOrEmail: string
  password: string
}

export interface RegisterCollegeRequest {
  name: string
  code: string
  address?: string
  phone?: string
  email?: string
  collegeId?: string
  password: string
  confirmPassword: string
}

export interface CollegeResponse {
  id: number
  name: string
  code: string
  address?: string
  phone?: string
  email?: string
  adminUsername?: string
  adminUserId?: number
}

export interface LoginResponse {
  accessToken: string
  refreshToken: string
  tokenType: string
  expiresIn: number
  userId: number
  username: string
  email: string
  fullName: string
  phone?: string
  profilePhotoUrl?: string
  departmentId?: number
  departmentName?: string
  employeeId?: string
  designation?: string
  roles: RoleName[]
}

export interface RefreshTokenRequest {
  refreshToken: string
}

export interface ForgotPasswordRequest {
  usernameOrEmail: string
}

export interface ResetPasswordRequest {
  token: string
  newPassword: string
}

export interface ForgotPasswordResponse {
  /** One-time raw reset token (delivered in the body — no SMTP in this build). Null when the identifier is unknown. */
  resetToken?: string | null
}

export interface AuthUser {
  userId: number
  username: string
  email: string
  fullName: string
  phone?: string
  profilePhotoUrl?: string
  departmentId?: number
  departmentName?: string
  employeeId?: string
  designation?: string
  roles: RoleName[]
}
