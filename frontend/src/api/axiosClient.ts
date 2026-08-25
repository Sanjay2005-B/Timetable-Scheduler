import axios, { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '@/store/authStore'

const BASE_URL = import.meta.env.VITE_API_URL ?? '/api/v1'

export const axiosClient = axios.create({
  baseURL: BASE_URL,
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
})

// ── Request Interceptor — Attach JWT ──────────────────────────────
axiosClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = useAuthStore.getState().accessToken
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// ── Response Interceptor — Auto-refresh on 401 ───────────────────
let isRefreshing = false
let refreshQueue: Array<(token: string) => void> = []

axiosClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      const { refreshToken, setTokens, logout } = useAuthStore.getState()
      if (!refreshToken) {
        logout()
        return Promise.reject(error)
      }

      if (isRefreshing) {
        return new Promise((resolve) => {
          refreshQueue.push((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`
            resolve(axiosClient(originalRequest))
          })
        })
      }

      isRefreshing = true
      try {
        const res = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken })
        const { accessToken, refreshToken: newRefreshToken } = res.data.data
        setTokens(accessToken, newRefreshToken)
        refreshQueue.forEach((cb) => cb(accessToken))
        refreshQueue = []
        originalRequest.headers.Authorization = `Bearer ${accessToken}`
        return axiosClient(originalRequest)
      } catch {
        logout()
        return Promise.reject(error)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)

export default axiosClient
