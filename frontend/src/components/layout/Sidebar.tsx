import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Building2, Users, BookOpen, BookMarked,
  DoorOpen, CalendarCheck, Calendar, Settings,
  Zap, X
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import clsx from 'clsx'

// Management staff — the Faculty role is deliberately EXCLUDED since the 2026
// access overhaul: faculty see only /my-timetable, /my-subjects and /profile.
const MANAGEMENT_STAFF_ROLES = ['ROLE_SUPER_ADMIN', 'ROLE_COLLEGE_ADMIN', 'ROLE_HOD', 'ROLE_EXAM_COORDINATOR']

// Master-data pages that must NOT be visible to College Admins (view-only
// timetable scope). HOD / EXAM_COORDINATOR / SUPER_ADMIN keep them.
const SUBJECT_AVAILABILITY_ROLES = ['ROLE_SUPER_ADMIN', 'ROLE_HOD', 'ROLE_EXAM_COORDINATOR']

// Availability is not part of the HOD's read-only department scope, so
// ROLE_HOD is deliberately absent. Kept separate from
// SUBJECT_AVAILABILITY_ROLES because Subjects stays visible to an HOD.
const AVAILABILITY_ROLES = ['ROLE_SUPER_ADMIN', 'ROLE_EXAM_COORDINATOR']

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
      { to: '/availability', icon: CalendarCheck,   label: 'Availability', roles: AVAILABILITY_ROLES },
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
      { to: '/settings', icon: Settings, label: 'Settings', roles: ['ROLE_SUPER_ADMIN', 'ROLE_COLLEGE_ADMIN'] },
    ],
  },
]

interface SidebarProps {
  collapsed: boolean
  /** Mobile slide-in drawer state. */
  mobileOpen: boolean
  onCloseMobile: () => void
}

export default function Sidebar({ collapsed, mobileOpen, onCloseMobile }: SidebarProps) {
  const { user, hasRole } = useAuthStore()
  const location  = useLocation()
  const navigate  = useNavigate()

  const railCollapsed = collapsed && !mobileOpen

  return (
    <>
      {/* ── Mobile overlay ── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-[#1a1a1a]/50 lg:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      {/* Fixed cream rail — full height, flush to the left edge, ruled with a
          thin black border. Dense and rectangular, per the reference. */}
      <aside
        className={clsx(
          'fixed top-0 bottom-0 left-0 z-40 flex flex-col overflow-hidden',
          'bg-nav text-ink border-r border-line',
          'transition-all duration-200 ease-in-out',
          // Mobile: off-canvas drawer. Desktop: static fixed column.
          mobileOpen ? 'w-[216px]' : '-translate-x-full',
          'lg:translate-x-0',
          railCollapsed ? 'lg:w-[60px]' : 'lg:w-[216px]'
        )}
        aria-label="Main navigation"
      >
        {/* ── Logo ── */}
        <div className="flex items-center gap-2 px-3 h-12 border-b border-line flex-shrink-0 bg-surface">
          <div className="w-6 h-6 rounded-sm bg-accent-500 border border-line flex items-center justify-center flex-shrink-0">
            <Zap className="w-3.5 h-3.5 text-white" />
          </div>
          {!railCollapsed && (
            <div className="overflow-hidden">
              <p className="text-[11px] font-bold text-ink leading-tight truncate uppercase">
                Timetable Scheduler
              </p>
              <p className="text-[9px] text-ink-soft leading-tight tracking-wider uppercase">College Schedule ERP</p>
            </div>
          )}
          {/* Close control — mobile drawer only */}
          <button
            onClick={onCloseMobile}
            className="ml-auto lg:hidden p-1 rounded-sm text-ink hover:bg-slate-200 transition-colors"
            aria-label="Close navigation"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Navigation ── */}
        <nav className="flex-1 overflow-y-auto py-2 px-2 no-scrollbar">
          {NAV_ITEMS.map((group) => {
            const items = group.items.filter(
              (item) => !item.roles || item.roles.some((r) => hasRole(r)),
            )
            if (items.length === 0) return null
            return (
            <div key={group.group} className="mb-3 last:mb-0">
              {!railCollapsed && (
                <p className="nav-section-label px-2 mb-1">
                  {group.group}
                </p>
              )}
              <div className="space-y-0.5">
                {items
                  .map(({ to, icon: Icon, label }) => {
                  const isActive = location.pathname.startsWith(to)
                  return (
                    <NavLink
                      key={to}
                      to={to}
                      onClick={onCloseMobile}
                      title={railCollapsed ? label : undefined}
                      className={clsx(
                        'nav-item group',
                        isActive && 'nav-item-active'
                      )}
                    >
                      <Icon className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={2} />
                      {!railCollapsed && <span className="flex-1 truncate">{label}</span>}
                    </NavLink>
                  )
                })}
              </div>
            </div>
            )
          })}
        </nav>

        {/* ── User Profile ──
            Sign-out is intentionally NOT duplicated here. It already exists in
            two pre-existing places — the topbar account menu and the Profile
            security section — and both share one session-revocation helper.
            A third control would repeat that call and the redirect. */}
        <div className="flex-shrink-0 p-2 border-t border-line">
          <div
            className="flex items-center gap-2 px-1.5 py-1.5 rounded-sm hover:bg-gold-100 transition-colors cursor-pointer"
            onClick={() => { onCloseMobile(); navigate('/profile') }}
            title="My Profile"
            role="button"
          >
            <div className="w-6 h-6 rounded-sm bg-ink border border-line flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-surface">
              {user?.fullName?.charAt(0) ?? 'A'}
            </div>
            {!railCollapsed && (
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-ink truncate">{user?.fullName}</p>
                <p className="text-[9px] text-ink-soft truncate">{user?.email}</p>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  )
}
