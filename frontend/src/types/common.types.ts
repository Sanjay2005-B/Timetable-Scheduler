// Common API response shapes
export interface ApiResponse<T> {
  success: boolean
  message?: string
  data?: T
  errors?: Record<string, string>
  timestamp: string
}

export interface PageResponse<T> {
  content: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
  last: boolean
  first: boolean
}

export interface PageParams {
  page?: number
  size?: number
  search?: string
  sort?: string
}

export type Status = 'ACTIVE' | 'INACTIVE'
export type RoleName =
  | 'ROLE_SUPER_ADMIN'
  | 'ROLE_HOD'
  | 'ROLE_FACULTY'
  | 'ROLE_EXAM_COORDINATOR'
