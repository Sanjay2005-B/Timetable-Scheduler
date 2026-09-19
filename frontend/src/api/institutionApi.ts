import axiosClient from './axiosClient'
import { ApiResponse } from '@/types/common.types'
import { InstitutionResponse, UpdateInstitutionRequest } from '@/types/profile.types'

export const institutionApi = {
  // The institution is a single global row (id = 1) — no id is ever sent by
  // the client; updates are SUPER_ADMIN-only (enforced server-side).
  getInstitution: () =>
    axiosClient.get<ApiResponse<InstitutionResponse>>('/institution'),

  updateInstitution: (data: UpdateInstitutionRequest) =>
    axiosClient.put<ApiResponse<InstitutionResponse>>('/institution', data),
}