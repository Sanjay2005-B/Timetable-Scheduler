import axiosClient from './axiosClient'
import { ApiResponse } from '@/types/common.types'

export interface FacultyWorkload {
  name: string
  hours: number
}

export interface RoomUtilization {
  name: string
  value: number
  color: string
}

export interface TodayClass {
  time: string
  subject: string
  faculty: string
  room: string
  dept: string
}

export interface RecentActivity {
  type: string
  msg: string
  time: string
}

export interface DashboardStatsResponse {
  totalDepartments: number
  totalFaculty: number
  totalSubjects: number
  totalClassrooms: number
  totalTimetables: number
  facultyWorkload: FacultyWorkload[]
  roomUtilization: RoomUtilization[]
  todayClasses: TodayClass[]
  recentActivities: RecentActivity[]
}

export const dashboardApi = {
  getDashboardStats: () =>
    axiosClient.get<ApiResponse<DashboardStatsResponse>>('/dashboard/stats'),
}
