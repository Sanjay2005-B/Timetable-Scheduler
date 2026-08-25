import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import RoleProtectedRoute from './RoleProtectedRoute'
import MainLayout from '@/components/layout/MainLayout'
import { Loader2 } from 'lucide-react'

// Lazy-loaded pages
const LoginPage         = lazy(() => import('@/pages/auth/LoginPage'))
const DashboardPage     = lazy(() => import('@/pages/dashboard/DashboardPage'))
const DepartmentsPage   = lazy(() => import('@/pages/departments/DepartmentsPage'))
const FacultyPage       = lazy(() => import('@/pages/faculty/FacultyPage'))
const SubjectsPage      = lazy(() => import('@/pages/subjects/SubjectsPage'))
const ClassroomsPage    = lazy(() => import('@/pages/classrooms/ClassroomsPage'))
const AvailabilityPage  = lazy(() => import('@/pages/availability/AvailabilityPage'))
const TimetablePage     = lazy(() => import('@/pages/timetable/TimetablePage'))
const ReportsPage       = lazy(() => import('@/pages/reports/ReportsPage'))
const SettingsPage      = lazy(() => import('@/pages/settings/SettingsPage'))

const PageLoader = () => (
  <div className="flex items-center justify-center h-[60vh]">
    <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
  </div>
)

const ADMIN_ROLES = ['ROLE_SUPER_ADMIN', 'ROLE_HOD']
const SCHEDULING_ROLES = ['ROLE_SUPER_ADMIN', 'ROLE_HOD', 'ROLE_EXAM_COORDINATOR']

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          {/* Protected — any authenticated user */}
          <Route element={<RoleProtectedRoute />}>
            <Route element={<MainLayout />}>
              <Route path="/dashboard"    element={<DashboardPage />} />
              <Route path="/faculty"      element={<FacultyPage />} />
              <Route path="/subjects"     element={<SubjectsPage />} />
              <Route path="/classrooms"   element={<ClassroomsPage />} />
              <Route path="/availability" element={<AvailabilityPage />} />
              <Route path="/reports"      element={<ReportsPage />} />
            </Route>
          </Route>

          {/* Protected — admin/hod only */}
          <Route element={<RoleProtectedRoute allowedRoles={ADMIN_ROLES} />}>
            <Route element={<MainLayout />}>
              <Route path="/departments"  element={<DepartmentsPage />} />
              <Route path="/settings"     element={<SettingsPage />} />
            </Route>
          </Route>

          {/* Protected — admin/hod/coordinator */}
          <Route element={<RoleProtectedRoute allowedRoles={SCHEDULING_ROLES} />}>
            <Route element={<MainLayout />}>
              <Route path="/timetable"    element={<TimetablePage />} />
            </Route>
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
