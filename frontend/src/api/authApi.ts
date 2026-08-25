import axiosClient from './axiosClient'
import { LoginRequest, LoginResponse, RefreshTokenRequest } from '@/types/auth.types'
import { ApiResponse } from '@/types/common.types'

export const authApi = {
  login: (data: LoginRequest) =>
    axiosClient.post<ApiResponse<LoginResponse>>('/auth/login', data),

  refresh: (data: RefreshTokenRequest) =>
    axiosClient.post<ApiResponse<LoginResponse>>('/auth/refresh', data),

  logout: () =>
    axiosClient.post<ApiResponse<void>>('/auth/logout'),

  me: () =>
    axiosClient.get<ApiResponse<LoginResponse>>('/auth/me'),
}
