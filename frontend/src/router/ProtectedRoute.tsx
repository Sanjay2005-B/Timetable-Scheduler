import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'

/**
 * Wraps protected routes — redirects to /login if not authenticated.
 */
export default function ProtectedRoute() {
  const { isAuthenticated } = useAuthStore()
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />
}
