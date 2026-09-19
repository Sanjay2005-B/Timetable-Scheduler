import axiosClient from './axiosClient'
import { ApiResponse, PageResponse } from '@/types/common.types'

export interface YearSections {
  yearLabel: string
  enabled: boolean
  sections: string[]
}

export interface DepartmentRequest {
  name: string
  hodName?: string
  contactEmail?: string
  contactPhone?: string
  building?: string
  description?: string
  years: YearSections[]
  hodUsername?: string
  hodPassword?: string
}

export interface SectionDto {
  id: number
  academicYearId: number
  name: string
  studentStrength: number
  status: string
}

export interface AcademicYearDto {
  id: number
  departmentId: number
  yearLabel: string
  isEnabled: boolean
  sections: SectionDto[]
}

export interface DepartmentResponse {
  id: number
  collegeId?: number
  name: string
  hodName?: string
  contactEmail?: string
  contactPhone?: string
  building?: string
  description?: string
  isArchived: boolean
  createdAt: string
  updatedAt?: string
  academicYears: AcademicYearDto[]
}

export interface DepartmentDependencies {
  timetables: number
  subjects: number
  faculty: number
  classrooms: number
  users: number
}

export const departmentApi = {
  getDepartments: (params?: { page?: number; size?: number; search?: string; isArchived?: boolean; sort?: string }) =>
    axiosClient.get<ApiResponse<PageResponse<DepartmentResponse>>>('/departments', { params }),

  getDepartmentById: (id: number) =>
    axiosClient.get<ApiResponse<DepartmentResponse>>(`/departments/${id}`),

  createDepartment: (data: DepartmentRequest) =>
    axiosClient.post<ApiResponse<DepartmentResponse>>('/departments', data),

  updateDepartment: (id: number, data: DepartmentRequest) =>
    axiosClient.put<ApiResponse<DepartmentResponse>>(`/departments/${id}`, data),

  archiveDepartment: (id: number) =>
    axiosClient.patch<ApiResponse<void>>(`/departments/${id}/archive`),

  restoreDepartment: (id: number) =>
    axiosClient.patch<ApiResponse<void>>(`/departments/${id}/restore`),

  deleteDepartment: (id: number) =>
    axiosClient.delete<ApiResponse<void>>(`/departments/${id}`),

  getDependencies: (id: number) =>
    axiosClient.get<ApiResponse<DepartmentDependencies>>(`/departments/${id}/dependencies`),
}
