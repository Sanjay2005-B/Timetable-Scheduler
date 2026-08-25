import { RoleName } from './common.types'

export interface LoginRequest {
  usernameOrEmail: string
  password: string
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
  departmentId?: number
  departmentName?: string
  roles: RoleName[]
}

export interface RefreshTokenRequest {
  refreshToken: string
}

export interface AuthUser {
  userId: number
  username: string
  email: string
  fullName: string
  departmentId?: number
  departmentName?: string
  roles: RoleName[]
}
