import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import RoleProtectedRoute from './RoleProtectedRoute'
import MainLayout from '@/components/layout/MainLayout'
import { Loader2 } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'

// Lazy-loaded pages
const LoginPage         = lazy(() => import('@/pages/auth/LoginPage'))
const RegisterCollegePage = lazy(() => import('@/pages/auth/RegisterCollegePage'))
const ForgotPasswordPage = lazy(() => import('@/pages/auth/ForgotPasswordPage'))
const ResetPasswordPage  = lazy(() => import('@/pages/auth/ResetPasswordPage'))
const DashboardPage     = lazy(() => import('@/pages/dashboard/DashboardPage'))
const DepartmentsPage   = lazy(() => import('@/pages/departments/DepartmentsPage'))
const FacultyPage       = lazy(() => import('@/pages/faculty/FacultyPage'))
const SubjectsPage      = lazy(() => import('@/pages/subjects/SubjectsPage'))
const ClassroomsPage    = lazy(() => import('@/pages/classrooms/ClassroomsPage'))
const AvailabilityPage  = lazy(() => import('@/pages/availability/AvailabilityPage'))
const TimetablePage     = lazy(() => import('@/pages/timetable/TimetablePage'))
const ReportsPage       = lazy(() => import('@/pages/reports/ReportsPage'))
const SettingsPage      = lazy(() => import('@/pages/settings/SettingsPage'))
const ProfilePage       = lazy(() => import('@/pages/profile/ProfilePage'))
const MyTimetablePage   = lazy(() => import('@/pages/timetable/MyTimetablePage'))
const MySubjectsPage    = lazy(() => import('@/pages/subjects/MySubjectsPage'))

const PageLoader = () => (
  <div className="flex items-center justify-center h-[60vh]">
    <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
  </div>
)

const ADMIN_ROLES = ['ROLE_SUPER_ADMIN', 'ROLE_COLLEGE_ADMIN', 'ROLE_HOD']
const SCHEDULING_ROLES = ['ROLE_SUPER_ADMIN', 'ROLE_COLLEGE_ADMIN', 'ROLE_HOD', 'ROLE_EXAM_COORDINATOR']
// Management staff — the Faculty role is deliberately EXCLUDED since the 2026
// access overhaul: faculty see only /my-timetable, /my-subjects and /profile.
const MANAGEMENT_STAFF_ROLES = ['ROLE_SUPER_ADMIN', 'ROLE_COLLEGE_ADMIN', 'ROLE_HOD', 'ROLE_EXAM_COORDINATOR']
// Subjects/Availability master data — hidden from College Admins (view-only
// timetable scope). HOD / EXAM_COORDINATOR / SUPER_ADMIN keep them.
const SUBJECT_AVAILABILITY_ROLES = ['ROLE_SUPER_ADMIN', 'ROLE_HOD', 'ROLE_EXAM_COORDINATOR']
const MY_TIMETABLE_ROLES = ['ROLE_FACULTY', 'ROLE_STUDENT']
const MY_SUBJECTS_ROLES = ['ROLE_FACULTY']

const HomeRedirect = () => {
  const { isAuthenticated, user } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  const isFacultyOrStudent =
    user?.roles?.includes('ROLE_FACULTY') || user?.roles?.includes('ROLE_STUDENT')
  return (
    <Navigate
      to={isFacultyOrStudent ? '/my-timetable' : '/dashboard'}
      replace
    />
  )
}

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register-college" element={<RegisterCollegePage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/" element={<HomeRedirect />} />

          {/* Protected — any authenticated user */}
          <Route element={<RoleProtectedRoute />}>
            <Route element={<MainLayout />}>
              <Route path="/profile"      element={<ProfilePage />} />
            </Route>
          </Route>

{/* Protected — management staff (no Faculty; faculty have own pages below) */}
           <Route element={<RoleProtectedRoute allowedRoles={MANAGEMENT_STAFF_ROLES} />}>
             <Route element={<MainLayout />}>
               <Route path="/dashboard"    element={<DashboardPage />} />
               <Route path="/faculty"      element={<FacultyPage />} />
               <Route path="/classrooms"   element={<ClassroomsPage />} />
             </Route>
           </Route>

           {/* Protected — subjects & availability master data (no College Admin) */}
           <Route element={<RoleProtectedRoute allowedRoles={SUBJECT_AVAILABILITY_ROLES} />}>
             <Route element={<MainLayout />}>
               <Route path="/subjects"     element={<SubjectsPage />} />
               <Route path="/availability" element={<AvailabilityPage />} />
             </Route>
           </Route>

          {/* Protected — faculty/student own timetable */}
          <Route element={<RoleProtectedRoute allowedRoles={MY_TIMETABLE_ROLES} />}>
            <Route element={<MainLayout />}>
              <Route path="/my-timetable" element={<MyTimetablePage />} />
            </Route>
          </Route>

          {/* Protected — faculty own subjects */}
          <Route element={<RoleProtectedRoute allowedRoles={MY_SUBJECTS_ROLES} />}>
            <Route element={<MainLayout />}>
              <Route path="/my-subjects"  element={<MySubjectsPage />} />
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
          <Route path="*" element={<HomeRedirect />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
