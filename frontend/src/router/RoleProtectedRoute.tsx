import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'

interface Props {
  allowedRoles?: string[]
}

/**
 * Wraps protected routes — redirects to /login if not authenticated,
 * or to the user's home (/my-timetable for students, /dashboard otherwise)
 * if they lack the required role(s).
 */
export default function RoleProtectedRoute({ allowedRoles }: Props) {
  const { isAuthenticated, hasRole, user } = useAuthStore()

  if (!isAuthenticated) return <Navigate to="/login" replace />

  if (allowedRoles && allowedRoles.length > 0) {
    const hasAccess = allowedRoles.some((role) => hasRole(role))
    if (!hasAccess) {
      const home = user?.roles?.includes('ROLE_STUDENT')
        ? '/my-timetable'
        : '/dashboard'
      return <Navigate to={home} replace />
    }
  }

  return <Outlet />
}
