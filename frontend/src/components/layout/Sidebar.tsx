import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Building2, GraduationCap, Users, BookOpen, BookMarked,
  DoorOpen, CalendarCheck, Calendar, BarChart3, Settings,
  ChevronRight, Zap
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import clsx from 'clsx'

// Management staff — the Faculty role is deliberately EXCLUDED since the 2026
// access overhaul: faculty see only /my-timetable, /my-subjects and /profile.
const MANAGEMENT_STAFF_ROLES = ['ROLE_SUPER_ADMIN', 'ROLE_COLLEGE_ADMIN', 'ROLE_HOD', 'ROLE_EXAM_COORDINATOR']

// Master-data pages that must NOT be visible to College Admins (view-only
// timetable scope). HOD / EXAM_COORDINATOR / SUPER_ADMIN keep them.
const SUBJECT_AVAILABILITY_ROLES = ['ROLE_SUPER_ADMIN', 'ROLE_HOD', 'ROLE_EXAM_COORDINATOR']

const NAV_ITEMS = [
  {
    group: 'Overview',
    items: [
      { to: '/dashboard',    icon: LayoutDashboard, label: 'Dashboard', roles: MANAGEMENT_STAFF_ROLES },
      { to: '/my-timetable', icon: Calendar,        label: 'My Timetable', roles: ['ROLE_FACULTY', 'ROLE_STUDENT'] },
      { to: '/my-subjects',  icon: BookMarked,      label: 'My Subjects',   roles: ['ROLE_FACULTY'] },
    ],
  },
  {
    group: 'Master Data',
    items: [
      { to: '/departments',  icon: Building2,      label: 'Departments',   roles: ['ROLE_SUPER_ADMIN', 'ROLE_COLLEGE_ADMIN', 'ROLE_HOD'] },
      { to: '/faculty',      icon: Users,           label: 'Faculty',      roles: MANAGEMENT_STAFF_ROLES },
      { to: '/subjects',     icon: BookOpen,        label: 'Subjects',     roles: SUBJECT_AVAILABILITY_ROLES },
      { to: '/classrooms',   icon: DoorOpen,        label: 'Classrooms',   roles: MANAGEMENT_STAFF_ROLES },
      { to: '/availability', icon: CalendarCheck,   label: 'Availability', roles: SUBJECT_AVAILABILITY_ROLES },
    ],
  },
  {
    group: 'Scheduling',
    items: [
      { to: '/timetable', icon: Calendar, label: 'Timetable', roles: ['ROLE_SUPER_ADMIN', 'ROLE_COLLEGE_ADMIN', 'ROLE_HOD', 'ROLE_EXAM_COORDINATOR'] },
    ],
  },
  {
    group: 'System',
    items: [
      { to: '/settings', icon: Settings, label: 'Settings', roles: ['ROLE_SUPER_ADMIN', 'ROLE_COLLEGE_ADMIN', 'ROLE_HOD'] },
    ],
  },
]

interface SidebarProps {
  collapsed: boolean
}

export default function Sidebar({ collapsed }: SidebarProps) {
  const { user, hasRole } = useAuthStore()
  const location  = useLocation()
  const navigate  = useNavigate()

  return (
    <aside
      className={clsx(
        'fixed left-0 top-0 h-full z-30 flex flex-col',
        'bg-surface-50 border-r border-white/5',
        'transition-all duration-300',
        collapsed ? 'w-16' : 'w-[260px]'
      )}
    >
      {/* ── Logo ── */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-white/5 flex-shrink-0">
        <div className="w-9 h-9 rounded-xl bg-gradient-brand flex items-center justify-center flex-shrink-0 shadow-glow">
          <Zap className="w-5 h-5 text-white" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <p className="text-sm font-bold text-white leading-tight truncate">
              Timetable ERP
            </p>
            <p className="text-[10px] text-gray-500 leading-tight">AI Scheduler</p>
          </div>
        )}
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto py-4 no-scrollbar">
        {NAV_ITEMS.map((group) => {
          const items = group.items.filter(
            (item) => !item.roles || item.roles.some((r) => hasRole(r)),
          )
          if (items.length === 0) return null
          return (
          <div key={group.group} className="mb-6">
            {!collapsed && (
              <p className="px-4 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-gray-600">
                {group.group}
              </p>
            )}
            <div className="space-y-0.5 px-2">
              {items
                .map(({ to, icon: Icon, label }) => {
                const isActive = location.pathname.startsWith(to)
                return (
                  <NavLink
                    key={to}
                    to={to}
                    title={collapsed ? label : undefined}
                    className={clsx(
                      'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium',
                      'transition-all duration-150 group relative',
                      isActive
                        ? 'bg-brand-500/15 text-white border border-brand-500/25'
                        : 'text-gray-400 hover:text-white hover:bg-white/[0.06]'
                    )}
                  >
                    <Icon
                      className={clsx(
                        'w-5 h-5 flex-shrink-0',
                        isActive ? 'text-brand-400' : 'text-gray-500 group-hover:text-gray-300'
                      )}
                    />
                    {!collapsed && (
                      <>
                        <span className="flex-1">{label}</span>
                        {isActive && (
                          <ChevronRight className="w-3.5 h-3.5 text-brand-400" />
                        )}
                      </>
                    )}
                  </NavLink>
                )
              })}
            </div>
          </div>
          )
        })}
      </nav>

      {/* ── User Profile ── */}
      <div className="flex-shrink-0 p-3 border-t border-white/5">
        <div
          className={clsx(
            'flex items-center gap-3 px-2 py-2 rounded-xl',
            'hover:bg-white/[0.05] transition-colors cursor-pointer'
          )}
          onClick={() => navigate('/profile')}
          title="My Profile"
          role="button"
        >
          <div className="w-8 h-8 rounded-full bg-gradient-brand flex items-center justify-center flex-shrink-0 text-xs font-bold text-white">
            {user?.fullName?.charAt(0) ?? 'A'}
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.fullName}</p>
              <p className="text-[11px] text-gray-500 truncate">{user?.email}</p>
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
