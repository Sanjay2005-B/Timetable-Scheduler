import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { AuthUser, LoginResponse } from '@/types/auth.types'

interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  user: AuthUser | null
  isAuthenticated: boolean

  setAuth: (response: LoginResponse) => void
  setTokens: (accessToken: string, refreshToken: string) => void
  logout: () => void
  hasRole: (role: string) => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,

      setAuth: (response: LoginResponse) =>
        set({
          accessToken: response.accessToken,
          refreshToken: response.refreshToken,
          isAuthenticated: true,
          user: {
            userId:         response.userId,
            username:       response.username,
            email:          response.email,
            fullName:       response.fullName,
            phone:          response.phone,
            profilePhotoUrl: response.profilePhotoUrl,
            departmentId:   response.departmentId,
            departmentName: response.departmentName,
            employeeId:     response.employeeId,
            designation:    response.designation,
            roles:          response.roles,
          },
        }),

      setTokens: (accessToken, refreshToken) =>
        set({ accessToken, refreshToken }),

      logout: () =>
        set({
          accessToken: null,
          refreshToken: null,
          user: null,
          isAuthenticated: false,
        }),

      hasRole: (role: string) =>
        get().user?.roles.includes(role as any) ?? false,
    }),
    {
      name: 'timetable-auth',
      partialize: (state) => ({
        accessToken:     state.accessToken,
        refreshToken:    state.refreshToken,
        user:            state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)
