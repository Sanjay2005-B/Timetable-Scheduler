import { useAuthStore } from '@/store/authStore'
import type { RoleName } from '@/types/common.types'

/** Roles that keep full department management regardless of also holding ROLE_HOD. */
const DEPARTMENT_ADMIN_ROLES: RoleName[] = ['ROLE_SUPER_ADMIN', 'ROLE_COLLEGE_ADMIN']

/**
 * The signed-in user's department scope, taken from the values the backend
 * resolved from the database at login (`users.department_id`) — never from a
 * department name, id or filter chosen in the UI.
 *
 * `isHodReadOnly` is true only for an account that is an HOD and holds no
 * college/platform administration role, so adding ROLE_HOD alongside
 * ROLE_COLLEGE_ADMIN or ROLE_SUPER_ADMIN does not silently remove management.
 */
export function useHodScope() {
  const user = useAuthStore((s) => s.user)
  const roles = user?.roles ?? []
  const isHod = roles.includes('ROLE_HOD')
  const isDepartmentAdmin = DEPARTMENT_ADMIN_ROLES.some((r) => roles.includes(r))

  return {
    isHod,
    isHodReadOnly: isHod && !isDepartmentAdmin,
    departmentId: user?.departmentId ?? null,
    departmentName: user?.departmentName ?? null,
  }
}
