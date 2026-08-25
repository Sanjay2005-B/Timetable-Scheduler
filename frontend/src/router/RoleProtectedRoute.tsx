import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'

interface Props {
  allowedRoles?: string[]
}

/**
 * Wraps protected routes — redirects to /login if not authenticated,
 * or to /dashboard if the user lacks the required role(s).
 */
export default function RoleProtectedRoute({ allowedRoles }: Props) {
  const { isAuthenticated, hasRole } = useAuthStore()

  if (!isAuthenticated) return <Navigate to="/login" replace />

  if (allowedRoles && allowedRoles.length > 0) {
    const hasAccess = allowedRoles.some((role) => hasRole(role))
    if (!hasAccess) return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}
