import axiosClient from './axiosClient'
import { ApiResponse, PageResponse } from '@/types/common.types'

export interface SubjectRequest {
  subjectCode: string
  subjectName: string
  departmentId?: number
  academicYearId?: number
  sectionId?: number
  facultyId?: number
  semester: number
  credits?: number
  theoryHours?: number
  practicalHours?: number
  subjectType?: string
  sessionBlockSize?: number
  isActive?: boolean
}

export interface SubjectResponse {
  id: number
  subjectCode: string
  subjectName: string
  departmentId?: number
  departmentName?: string
  academicYearId?: number
  yearLabel?: string
  sectionId?: number
  sectionName?: string
  facultyId?: number
  facultyName?: string
  semester: number
  credits: number
  theoryHours: number
  practicalHours: number
  subjectType: string
  sessionBlockSize: number
  isActive: boolean
  createdAt: string
}

export const subjectApi = {
  getSubjects: (params?: { page?: number; size?: number; search?: string; departmentId?: number; academicYearId?: number; sectionId?: number; subjectType?: string; sort?: string }) =>
    axiosClient.get<ApiResponse<PageResponse<SubjectResponse>>>('/subjects', { params }),

  getMySubjects: () =>
    axiosClient.get<ApiResponse<SubjectResponse[]>>('/subjects/my'),

  getSubjectById: (id: number) =>
    axiosClient.get<ApiResponse<SubjectResponse>>(`/subjects/${id}`),

  createSubject: (data: SubjectRequest) =>
    axiosClient.post<ApiResponse<SubjectResponse>>('/subjects', data),

  updateSubject: (id: number, data: SubjectRequest) =>
    axiosClient.put<ApiResponse<SubjectResponse>>(`/subjects/${id}`, data),

  deleteSubject: (id: number) =>
    axiosClient.delete<ApiResponse<void>>(`/subjects/${id}`),
}
