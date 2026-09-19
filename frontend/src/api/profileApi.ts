import axiosClient from './axiosClient'
import { ApiResponse } from '@/types/common.types'
import {
  ChangePasswordRequest,
  ProfileResponse,
  SessionInfo,
  UpdateProfileRequest,
  UploadPhotoResponse,
} from '@/types/profile.types'

export const profileApi = {
  // The authenticated user is derived from the JWT server-side — no user ID
  // is ever sent by the client.
  getMyProfile: () =>
    axiosClient.get<ApiResponse<ProfileResponse>>('/me'),

  updateMyProfile: (data: UpdateProfileRequest) =>
    axiosClient.put<ApiResponse<ProfileResponse>>('/me', data),

  changeMyPassword: (data: ChangePasswordRequest) =>
    axiosClient.post<ApiResponse<void>>('/me/change-password', data),

  uploadPhoto: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    // FormData: axios clears the default JSON header so the browser sets the
    // multipart boundary automatically.
    return axiosClient.post<ApiResponse<UploadPhotoResponse>>('/me/photo', form)
  },

  // Phase 5 multi-device sessions — identity derived from the JWT server-side.
  getMySessions: () =>
    axiosClient.get<ApiResponse<SessionInfo[]>>('/me/sessions'),

  revokeSession: (sessionId: number) =>
    axiosClient.delete<ApiResponse<void>>(`/me/sessions/${sessionId}`),

  // "Logout from other devices": keeps the session holding our refresh token.
  revokeAllOtherSessions: (refreshToken: string) =>
    axiosClient.delete<ApiResponse<void>>('/me/sessions/all', {
      data: { refreshToken },
    }),
}