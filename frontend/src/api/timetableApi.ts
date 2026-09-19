import axiosClient from './axiosClient'
import { ApiResponse } from '@/types/common.types'

export interface GenerateTimetableRequest {
  departmentId: number
  sectionId: number
  semester: number
  academicSession?: string
}

export interface TimetableEntryDto {
  id: number
  dayOfWeek: string
  timeSlotId: number
  timeSlotLabel: string
  timeSlotTime: string
  subjectId: number
  subjectCode: string
  subjectName: string
  subjectType: string
  facultyId: number
  facultyName: string
  classroomId: number
  roomNumber: string
  roomName: string
  isLocked: boolean
  isLab: boolean
}

export interface TimetableConflictDto {
  id: number
  conflictType: string
  description: string
  severity: string
}

export interface TimetableResponse {
  id: number
  academicSession: string
  departmentId: number
  departmentName: string
  sectionId: number
  sectionName: string
  semester: number
  status: string
  conflictCount: number
  optimizationScore: number
  createdAt: string
  entries: TimetableEntryDto[]
  conflicts: TimetableConflictDto[]
}

export const timetableApi = {
  generateTimetable: (data: GenerateTimetableRequest) =>
    axiosClient.post<ApiResponse<TimetableResponse>>('/timetable/generate', data),

  regenerateUnlockedSlots: (id: number) =>
    axiosClient.post<ApiResponse<TimetableResponse>>(`/timetable/${id}/regenerate-unlocked`),

  toggleSlotLock: (entryId: number) =>
    axiosClient.patch<ApiResponse<TimetableResponse>>(`/timetable/entries/${entryId}/lock`),

  getTimetableById: (id: number) =>
    axiosClient.get<ApiResponse<TimetableResponse>>(`/timetable/${id}`),

  getTimetableBySection: (sectionId: number, semester: number) =>
    axiosClient.get<ApiResponse<TimetableResponse>>(`/timetable/section/${sectionId}/semester/${semester}`),

  getTimetablesByDepartment: (departmentId: number) =>
    axiosClient.get<ApiResponse<TimetableResponse[]>>(`/timetable/department/${departmentId}`),

  getMyTimetable: () =>
    axiosClient.get<ApiResponse<TimetableResponse[]>>('/timetable/my'),

  deleteTimetable: (id: number) =>
    axiosClient.delete<ApiResponse<void>>(`/timetable/${id}`),
}
