import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import clsx from 'clsx'

export default function MainLayout() {
  // Desktop rail collapse (icon-only) — independent of the mobile drawer.
  const [collapsed, setCollapsed] = useState(false)
  // Mobile slide-in drawer, opened from the topbar hamburger.
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()

  // Close the drawer on navigation so a tapped item never leaves it covering
  // the page it just opened.
  useEffect(() => { setMobileOpen(false) }, [location.pathname])

  // Lock body scroll while the drawer overlay is up, so the page behind it
  // cannot scroll away under the user's finger.
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  // Escape closes the drawer.
  useEffect(() => {
    if (!mobileOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMobileOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mobileOpen])

  return (
    <div className="min-h-screen bg-canvas">
      {/* Mobile drawer backdrop. The rail is full-bleed from the top edge, so
          without this the page behind it stays visible and tappable. Desktop
          hides it because the rail is permanently docked. */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-ink/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}
      <Sidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <Topbar
        onToggleSidebar={() => setCollapsed((c) => !c)}
        onToggleMobile={() => setMobileOpen((o) => !o)}
        mobileOpen={mobileOpen}
        sidebarCollapsed={collapsed}
      />

      {/* Page content — the offsets clear the fixed cream rail (216px / 60px
          collapsed) and the 48px yellow header. No max-width cap, so the
          dashboard uses the full available width. */}
      <main
        className={clsx(
          'min-h-screen pt-16 px-3 pb-6 transition-all duration-200',
          collapsed ? 'lg:pl-[72px]' : 'lg:pl-[228px]'
        )}
      >
        <div className="w-full animate-fade-in">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
