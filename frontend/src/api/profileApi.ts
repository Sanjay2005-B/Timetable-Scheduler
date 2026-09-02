import axiosClient from './axiosClient'
import { ApiResponse } from '@/types/common.types'
import { ProfileResponse, UpdateProfileRequest } from '@/types/profile.types'

export const profileApi = {
  // The authenticated user is derived from the JWT server-side — no user ID
  // is ever sent by the client.
  getMyProfile: () =>
    axiosClient.get<ApiResponse<ProfileResponse>>('/me'),

  updateMyProfile: (data: UpdateProfileRequest) =>
    axiosClient.put<ApiResponse<ProfileResponse>>('/me', data),
}