import axiosClient from './axiosClient'
import { LoginRequest, LoginResponse, RefreshTokenRequest, RegisterCollegeRequest, CollegeResponse, ForgotPasswordRequest, ResetPasswordRequest, ForgotPasswordResponse } from '@/types/auth.types'
import { ApiResponse } from '@/types/common.types'

export const authApi = {
  login: (data: LoginRequest) =>
    axiosClient.post<ApiResponse<LoginResponse>>('/auth/login', data),

  registerCollege: (data: RegisterCollegeRequest) =>
    axiosClient.post<ApiResponse<CollegeResponse>>(
      '/auth/register-college',
      data,
      { skipAuth: true }
    ),

  forgotPassword: (data: ForgotPasswordRequest) =>
    axiosClient.post<ApiResponse<ForgotPasswordResponse>>(
      '/auth/forgot-password',
      data,
      { skipAuth: true }
    ),

  resetPassword: (data: ResetPasswordRequest) =>
    axiosClient.post<ApiResponse<void>>(
      '/auth/reset-password',
      data,
      { skipAuth: true }
    ),

  refresh: (data: RefreshTokenRequest) =>
    axiosClient.post<ApiResponse<LoginResponse>>('/auth/refresh', data),

  logout: (refreshToken?: string) =>
    axiosClient.post<ApiResponse<void>>(
      '/auth/logout',
      refreshToken ? { refreshToken } : undefined
    ),

  me: () =>
    axiosClient.get<ApiResponse<LoginResponse>>('/auth/me'),
}
