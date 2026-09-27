import { Bell, Search, Menu, LogOut, User, X } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { authApi } from '@/api/authApi'
import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import clsx from 'clsx'

interface TopbarProps {
  onToggleSidebar: () => void
  onToggleMobile: () => void
  mobileOpen: boolean
  sidebarCollapsed: boolean
}

export default function Topbar({ onToggleSidebar, onToggleMobile, mobileOpen, sidebarCollapsed }: TopbarProps) {
  const { user, logout }   = useAuthStore()
  const navigate            = useNavigate()
  const [dropOpen, setDrop] = useState(false)

  const handleLogout = async () => {
    try {
      await authApi.logout(useAuthStore.getState().refreshToken ?? undefined)
    } catch { /* ignore */ }
    logout()
    navigate('/login')
  }

  return (
    <header
      className={clsx(
        'fixed top-0 right-0 z-20 h-12',
        'bg-header border-b border-line text-ink',
        'flex items-center px-3 gap-2 transition-all duration-200',
        // Flush to the right edge; starts after the fixed rail.
        'left-0',
        sidebarCollapsed ? 'lg:left-[60px]' : 'lg:left-[216px]'
      )}
    >
      {/* Mobile: hamburger opens/closes the slide-in drawer */}
      <button
        onClick={onToggleMobile}
        className="btn-icon lg:hidden"
        aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}
        aria-expanded={mobileOpen}
      >
        {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
      </button>

      {/* Desktop: collapse/expand the icon rail */}
      <button onClick={onToggleSidebar} className="btn-icon hidden lg:inline-flex" aria-label="Toggle sidebar">
        <Menu className="w-4 h-4" />
      </button>

      {/* Branding — the header's identity block */}
      <div className="hidden md:flex items-center gap-2 pr-3 mr-1 border-r border-line h-6">
        <span className="text-[11px] font-bold uppercase tracking-wider">Timetable Scheduler</span>
      </div>

      {/* Search — same shared .search-input / .search-icon spec as the page search bars */}
      <div className="flex-1 min-w-0 max-w-sm">
        <div className="relative">
          <Search className="search-icon" aria-hidden="true" />
          <input
            type="text"
            placeholder="Search classes, subjects, faculty, rooms…"
            aria-label="Search classes, subjects, faculty, rooms"
            className="search-input"
          />
        </div>
      </div>

      <div className="flex-1 hidden sm:block" />

      {/* Notifications — this deployment has no notification service
          (no backend endpoint, no stored notifications), so the control is
          explicitly non-interactive instead of showing a fabricated unread dot. */}
      <button
        type="button"
        className="btn-icon hidden sm:inline-flex"
        disabled
        aria-label="Notifications — not available"
        title="No notification service is configured for this application"
      >
        <Bell className="w-4 h-4" />
      </button>

      {/* Avatar Dropdown */}
      <div className="relative">
        <button
          onClick={() => setDrop((d) => !d)}
          className="flex items-center gap-2 px-1.5 sm:px-2 py-1 rounded-sm hover:bg-black/10 transition-colors"
          aria-label="Account menu"
          aria-expanded={dropOpen}
        >
          <div className="w-6 h-6 rounded-sm bg-ink border border-line flex items-center justify-center text-[10px] font-bold text-header flex-shrink-0">
            {user?.fullName?.charAt(0) ?? 'A'}
          </div>
          <div className="text-left hidden md:block">
            <p className="text-[11px] font-bold text-ink leading-tight">{user?.fullName}</p>
            <p className="text-[9px] text-ink/70 leading-tight uppercase tracking-wider">
              {user?.roles?.[0]?.replace('ROLE_', '').replace('_', ' ')}
            </p>
          </div>
        </button>

        {dropOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setDrop(false)} />
            <div className="absolute right-0 top-11 w-52 bg-surface border border-line rounded-sm shadow-card-lg z-20 py-1 animate-slide-up">
              <button
                onClick={() => { setDrop(false); navigate('/profile') }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] font-semibold text-ink hover:bg-gold-100 transition-colors"
              >
                <User className="w-3.5 h-3.5" /> My Profile
              </button>
              <div className="my-1 border-t border-line" />
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] font-semibold text-danger hover:bg-slate-200 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" /> Sign Out
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  )
}
