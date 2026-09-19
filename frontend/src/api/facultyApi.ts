import axiosClient from './axiosClient'
import { ApiResponse, PageResponse } from '@/types/common.types'

export interface FacultyRequest {
  employeeId: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  departmentId?: number
  designation?: string
  qualification?: string
  specialization?: string
  maxDailyHours?: number
  maxWeeklyHours?: number
  status?: string
  username?: string
  password?: string
}

export interface FacultyResponse {
  id: number
  employeeId: string
  firstName: string
  lastName: string
  fullName: string
  email: string
  phone?: string
  departmentId?: number
  departmentName?: string
  designation?: string
  qualification?: string
  specialization?: string
  maxDailyHours: number
  maxWeeklyHours: number
  status: string
  createdAt: string
}

export const facultyApi = {
  getFaculty: (params?: { page?: number; size?: number; search?: string; departmentId?: number; status?: string; sort?: string }) =>
    axiosClient.get<ApiResponse<PageResponse<FacultyResponse>>>('/faculty', { params }),

  getFacultyById: (id: number) =>
    axiosClient.get<ApiResponse<FacultyResponse>>(`/faculty/${id}`),

  createFaculty: (data: FacultyRequest) =>
    axiosClient.post<ApiResponse<FacultyResponse>>('/faculty', data),

  updateFaculty: (id: number, data: FacultyRequest) =>
    axiosClient.put<ApiResponse<FacultyResponse>>(`/faculty/${id}`, data),

  deleteFaculty: (id: number) =>
    axiosClient.delete<ApiResponse<void>>(`/faculty/${id}`),
}
