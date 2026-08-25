import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import clsx from 'clsx'

export default function MainLayout() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="min-h-screen bg-surface">
      <Sidebar collapsed={collapsed} />
      <Topbar
        onToggleSidebar={() => setCollapsed((c) => !c)}
        sidebarCollapsed={collapsed}
      />

      {/* Page content */}
      <main
        className={clsx(
          'min-h-screen pt-16 transition-all duration-300',
          collapsed ? 'ml-16' : 'ml-[260px]'
        )}
      >
        <div className="p-6 lg:p-8 max-w-[1600px] mx-auto animate-fade-in">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
