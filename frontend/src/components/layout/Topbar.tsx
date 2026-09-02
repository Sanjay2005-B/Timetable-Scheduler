import { Bell, Search, Menu, LogOut, User, Moon, Sun } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { authApi } from '@/api/authApi'
import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import clsx from 'clsx'

interface TopbarProps {
  onToggleSidebar: () => void
  sidebarCollapsed: boolean
}

export default function Topbar({ onToggleSidebar, sidebarCollapsed }: TopbarProps) {
  const { user, logout }   = useAuthStore()
  const navigate            = useNavigate()
  const [dropOpen, setDrop] = useState(false)

  const handleLogout = async () => {
    try { await authApi.logout() } catch { /* ignore */ }
    logout()
    navigate('/login')
  }

  return (
    <header
      className={clsx(
        'fixed top-0 right-0 h-16 z-20',
        'bg-surface-50/80 backdrop-blur-md border-b border-white/5',
        'flex items-center px-4 gap-3 transition-all duration-300',
        sidebarCollapsed ? 'left-16' : 'left-[260px]'
      )}
    >
      {/* Sidebar Toggle */}
      <button onClick={onToggleSidebar} className="btn-icon">
        <Menu className="w-5 h-5" />
      </button>

      {/* Search */}
      <div className="flex-1 max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search departments, faculty, subjects…"
            className="input py-2 text-sm"
            style={{ paddingLeft: '2.75rem' }}
          />
        </div>
      </div>

      <div className="flex-1" />

      {/* Notifications */}
      <button className="btn-icon relative">
        <Bell className="w-5 h-5" />
        <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-danger rounded-full ring-2 ring-surface-50" />
      </button>

      {/* Avatar Dropdown */}
      <div className="relative">
        <button
          onClick={() => setDrop((d) => !d)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-white/[0.06] transition-colors"
        >
          <div className="w-8 h-8 rounded-full bg-gradient-brand flex items-center justify-center text-xs font-bold text-white">
            {user?.fullName?.charAt(0) ?? 'A'}
          </div>
          <div className="text-left hidden sm:block">
            <p className="text-sm font-medium text-white leading-tight">{user?.fullName}</p>
            <p className="text-[11px] text-gray-500 leading-tight">
              {user?.roles?.[0]?.replace('ROLE_', '').replace('_', ' ')}
            </p>
          </div>
        </button>

        {dropOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setDrop(false)} />
            <div className="absolute right-0 top-12 w-52 bg-surface-100 border border-white/10 rounded-2xl shadow-card-lg z-20 py-1 animate-slide-up">
              <button
                onClick={() => { setDrop(false); navigate('/profile') }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-white/[0.06] transition-colors"
              >
                <User className="w-4 h-4" /> My Profile
              </button>
              <div className="my-1 border-t border-white/10" />
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-danger hover:bg-danger/10 transition-colors"
              >
                <LogOut className="w-4 h-4" /> Sign Out
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  )
}
