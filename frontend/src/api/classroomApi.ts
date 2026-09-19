import axiosClient from './axiosClient'
import { ApiResponse, PageResponse } from '@/types/common.types'

export interface ClassroomRequest {
  roomNumber: string
  roomName?: string
  building?: string
  departmentId?: number
  academicYearId?: number
  sectionId?: number
  roomType?: string
  capacity: number
  floor?: number
  status?: string
}

export interface ClassroomResponse {
  id: number
  roomNumber: string
  roomName?: string
  building?: string
  departmentId?: number
  departmentName?: string
  academicYearId?: number
  academicYearLabel?: string
  sectionId?: number
  sectionName?: string
  roomType: string
  capacity: number
  floor?: number
  status: string
  createdAt: string
}

export const classroomApi = {
  getClassrooms: (params?: { page?: number; size?: number; search?: string; roomType?: string; status?: string; sort?: string }) =>
    axiosClient.get<ApiResponse<PageResponse<ClassroomResponse>>>('/classrooms', { params }),

  getClassroomById: (id: number) =>
    axiosClient.get<ApiResponse<ClassroomResponse>>(`/classrooms/${id}`),

  createClassroom: (data: ClassroomRequest) =>
    axiosClient.post<ApiResponse<ClassroomResponse>>('/classrooms', data),

  updateClassroom: (id: number, data: ClassroomRequest) =>
    axiosClient.put<ApiResponse<ClassroomResponse>>(`/classrooms/${id}`, data),

  deleteClassroom: (id: number) =>
    axiosClient.delete<ApiResponse<void>>(`/classrooms/${id}`),
}
