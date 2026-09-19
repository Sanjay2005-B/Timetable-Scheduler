import axiosClient from './axiosClient'
import { ApiResponse } from '@/types/common.types'

export interface TimeSlot {
  id: number
  slotOrder: number
  startTime: string
  endTime: string
  isBreak: boolean
  slotLabel?: string
}

export interface AvailabilityDto {
  id?: number
  facultyId: number
  dayOfWeek: string
  timeSlotId: number
  slotNumber?: number
  status: 'PREFERRED' | 'AVAILABLE' | 'BLOCKED'
}

export const availabilityApi = {
  getTimeSlots: () =>
    axiosClient.get<ApiResponse<TimeSlot[]>>('/availability/time-slots'),

  getFacultyAvailability: (facultyId: number) =>
    axiosClient.get<ApiResponse<AvailabilityDto[]>>(`/availability/faculty/${facultyId}`),

  saveFacultyAvailability: (facultyId: number, data: AvailabilityDto[]) =>
    axiosClient.post<ApiResponse<AvailabilityDto[]>>(`/availability/faculty/${facultyId}`, data),
}
