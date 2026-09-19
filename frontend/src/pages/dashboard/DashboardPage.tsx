import { useQuery } from '@tanstack/react-query'
import {
  Building2, Users, BookOpen, DoorOpen, Calendar,
  Clock, AlertTriangle, Zap, Loader2
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts'
import { useAuthStore } from '@/store/authStore'
import { dashboardApi } from '@/api/dashboardApi'

const NOTIFY_ICON: Record<string, string> = {
  success: '✅', warning: '⚠️', info: 'ℹ️', danger: '🔴',
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div className="bg-surface-100 border border-white/10 rounded-xl px-4 py-3 shadow-card text-sm">
        <p className="text-gray-400 font-medium mb-1">{label}</p>
        <p className="text-white font-bold">{payload[0].value} hrs/week</p>
      </div>
    )
  }
  return null
}

export default function DashboardPage() {
  const { user } = useAuthStore()

  const { data: statsData, isLoading, isError } = useQuery({
    queryKey: ['dashboardStats'],
    queryFn: async () => {
      const res = await dashboardApi.getDashboardStats()
      return res.data.data
    },
    refetchInterval: 15_000,
  })

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-4">
        <Loader2 className="w-10 h-10 text-brand-500 animate-spin" />
        <p className="text-sm text-gray-400 font-medium">Fetching real-time database statistics…</p>
      </div>
    )
  }

  const kpiStats = [
    { label: 'Departments',  value: statsData?.totalDepartments ?? 0, icon: Building2, color: 'from-brand-600 to-brand-800',  change: 'Active in DB' },
    { label: 'Faculty',      value: statsData?.totalFaculty ?? 0,     icon: Users,     color: 'from-violet-600 to-purple-800', change: 'Configured in DB' },
    { label: 'Subjects',     value: statsData?.totalSubjects ?? 0,    icon: BookOpen,  color: 'from-cyan-600 to-blue-800',     change: 'Active in Curriculum' },
    { label: 'Classrooms',   value: statsData?.totalClassrooms ?? 0,  icon: DoorOpen,  color: 'from-emerald-600 to-green-800', change: 'Available Rooms' },
  ]

  const facultyWorkload = statsData?.facultyWorkload || []
  const roomUtilization = statsData?.roomUtilization || []
  const todayClasses = statsData?.todayClasses || []
  const recentActivities = statsData?.recentActivities || []

  return (
    <div className="space-y-8">
      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title">
            Good {getGreeting()}, {user?.fullName?.split(' ')[0]} 👋
          </h1>
          <p className="page-subtitle">
            {new Date().toLocaleDateString('en-IN', {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
            })}
          </p>
        </div>
        <button className="btn-primary">
          <Zap className="w-4 h-4" /> Generate Timetable
        </button>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        {kpiStats.map(({ label, value, icon: Icon, color, change }) => (
          <div key={label} className="card p-6 flex items-center gap-4 group hover:border-brand-500/20 transition-all">
            <div className={`stat-icon bg-gradient-to-br ${color} shadow-lg`}>
              <Icon className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-3xl font-bold text-white">{value}</p>
              <p className="text-sm text-gray-400 font-medium">{label}</p>
              <p className="text-xs text-gray-600 mt-0.5">{change}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Charts Row ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Faculty Workload Bar Chart */}
        <div className="card p-6 xl:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-base font-semibold text-white">Faculty Weekly Workload</h2>
              <p className="text-xs text-gray-500 mt-0.5">Hours per week (calculated from DB)</p>
            </div>
            <span className="badge badge-brand">Live Database</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={facultyWorkload} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis
                dataKey="name"
                tick={{ fill: '#6b7280', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: '#6b7280', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                domain={[0, 30]}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99,102,241,0.08)' }} />
              <Bar dataKey="hours" fill="url(#brandGrad)" radius={[6, 6, 0, 0]} />
              <defs>
                <linearGradient id="brandGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" />
                  <stop offset="100%" stopColor="#4338ca" />
                </linearGradient>
              </defs>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Room Utilization Donut */}
        <div className="card p-6">
          <div className="mb-6">
            <h2 className="text-base font-semibold text-white">Room Utilization</h2>
            <p className="text-xs text-gray-500 mt-0.5">{statsData?.totalClassrooms ?? 0} classrooms total</p>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={roomUtilization}
                cx="50%" cy="50%"
                innerRadius={55}
                outerRadius={80}
                paddingAngle={3}
                dataKey="value"
              >
                {roomUtilization.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: '#20243a', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 12, fontSize: 12, color: '#fff'
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-2">
            {roomUtilization.map(({ name, value, color }) => (
              <div key={name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                  <span className="text-gray-400">{name}</span>
                </div>
                <span className="font-semibold text-white">{value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Bottom Row ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Today's Classes */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-brand-400" /> Today's Active Schedule
            </h2>
            <span className="badge badge-success">{todayClasses.length} Active</span>
          </div>
          <div className="space-y-3">
            {todayClasses.map((cls, i) => (
              <div
                key={i}
                className="flex items-center gap-4 p-3 rounded-xl bg-surface-100 hover:bg-surface-200 transition-colors"
              >
                <div className="text-center min-w-[52px]">
                  <p className="text-xs font-bold text-brand-400">{cls.time}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{cls.subject}</p>
                  <p className="text-xs text-gray-500">{cls.faculty} · {cls.dept}</p>
                </div>
                <span className="badge badge-gray flex-shrink-0">{cls.room}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Notifications */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-warning" /> Recent System Activities
            </h2>
            <button className="text-xs text-brand-400 hover:text-brand-300">Mark all read</button>
          </div>
          <div className="space-y-3">
            {recentActivities.map((n, i) => (
              <div
                key={i}
                className="flex items-start gap-3 p-3 rounded-xl bg-surface-100 hover:bg-surface-200 transition-colors"
              >
                <span className="text-lg mt-0.5 flex-shrink-0">{NOTIFY_ICON[n.type] || 'ℹ️'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-200 leading-snug">{n.msg}</p>
                  <p className="text-xs text-gray-600 mt-1">{n.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}
