import { useQuery } from '@tanstack/react-query'
import { Building2, Users, BookOpen, DoorOpen, Zap, Loader2, CalendarRange, AlertTriangle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts'
import { useAuthStore } from '@/store/authStore'
import { useHodScope } from '@/hooks/useHodScope'
import { dashboardApi } from '@/api/dashboardApi'
import { timetableApi, TimetableResponse, TimetableEntryDto } from '@/api/timetableApi'

/** Working days, in timetable order. Matches the engine's MON–SAT cycle. */
const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'] as const

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div className="bg-surface border border-line rounded-sm px-2.5 py-1.5 shadow-card text-xs">
        <p className="text-ink-soft font-medium mb-0.5">{label}</p>
        <p className="text-ink font-bold tabular-nums">{payload[0].value} hrs/week</p>
      </div>
    )
  }
  return null
}

/* ═══════════════════════════════════════════════════════════════════════
   Timetable card — real data only, straight from GET /timetable/my.
   Nothing here is synthesised: the slot axis is derived from the entries
   the API actually returned, and a cell is drawn only where a real entry
   exists. Days/slots with no entry stay visibly empty.
   ═══════════════════════════════════════════════════════════════════════ */
function TimetableCard({ timetable }: { timetable: TimetableResponse }) {
  const navigate = useNavigate()
  const entries = timetable.entries ?? []

  // Build the slot axis from the data itself — the API returns the label and
  // time on every entry, so no master-data fetch is needed to draw the grid.
  const slots = Array.from(
    new Map(entries.map((e) => [e.timeSlotId, { id: e.timeSlotId, label: e.timeSlotLabel }])).values(),
  ).sort((a, b) => a.id - b.id)

  const cellAt = new Map<string, TimetableEntryDto>()
  entries.forEach((e) => cellAt.set(`${e.dayOfWeek}_${e.timeSlotId}`, e))

  const labCount = entries.filter((e) => e.isLab).length
  const theoryCount = entries.length - labCount

  return (
    <article className="card flex flex-col overflow-hidden">
      {/* Accent band: identity of the timetable */}
      <header className="flex items-start justify-between gap-2 px-3 py-2 bg-gold-100 border-b border-line">
        <div className="min-w-0">
          <h3 className="text-[11px] font-bold uppercase tracking-wide text-ink truncate">
            {timetable.departmentName || 'Department'}
          </h3>
          <p className="text-[10px] text-ink-soft truncate">
            Sec {timetable.sectionName} · Sem {timetable.semester}
            {timetable.academicSession ? ` · ${timetable.academicSession}` : ''}
          </p>
        </div>
        <span className="badge badge-gray flex-shrink-0">
          {timetable.status}
        </span>
      </header>

      {/* Miniature timetable preview — the actual weekly grid */}
      <div className="flex-1 p-2">
        {slots.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-center">
            <p className="text-[10px] uppercase tracking-wide text-ink-soft">
              No periods scheduled
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse" style={{ fontSize: '7px' }}>
              <thead>
                <tr>
                  <th className="w-4 border border-line bg-slate-100 text-ink-soft text-[6px] uppercase px-0.5 py-0.5">
                    D
                  </th>
                  {slots.map((s) => (
                    <th
                      key={s.id}
                      className="border border-line bg-slate-100 text-ink-soft text-[6px] uppercase px-0.5 py-0.5 whitespace-nowrap"
                    >
                      {s.label || `P${s.id}`}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DAYS.map((day) => (
                  <tr key={day}>
                    <th className="border border-line bg-slate-100 text-ink text-[6px] uppercase px-0.5 py-0.5 text-left">
                      {day.slice(0, 3)}
                    </th>
                    {slots.map((s) => {
                      const entry = cellAt.get(`${day}_${s.id}`)
                      return (
                        <td
                          key={s.id}
                          className={`border border-line px-0.5 py-1 text-center leading-none ${
                            entry
                              ? entry.isLab
                                ? 'bg-accent-100 text-accent-800 font-bold'
                                : 'bg-surface text-ink'
                              : 'bg-slate-100'
                          }`}
                          title={
                            entry
                              ? `${entry.subjectCode} — ${entry.subjectName}${
                                  entry.roomNumber ? ` · ${entry.roomNumber}` : ''
                                }`
                              : 'Free period'
                          }
                        >
                          {entry ? entry.subjectCode.slice(0, 4) : ''}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer: real counts + the action */}
      <footer className="flex items-center justify-between gap-2 px-3 py-2 border-t border-line bg-surface">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[10px] font-bold text-ink tabular-nums">
            {entries.length} periods
          </span>
          <span className="text-[9px] text-ink-soft tabular-nums hidden sm:inline">
            {theoryCount}T / {labCount}L
          </span>
          {timetable.conflictCount > 0 && (
            <span className="badge badge-danger" title={`${timetable.conflictCount} conflicts`}>
              {timetable.conflictCount}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => navigate('/timetable')}
          className="btn-primary !py-1 !px-2 !text-[10px] flex-shrink-0"
        >
          View Timetable
        </button>
      </footer>
    </article>
  )
}

export default function DashboardPage() {
  const { user } = useAuthStore()
  // Statistics are scoped to the caller's own department for an HOD by the
  // backend; the header names that department so the numbers are unambiguous.
  const { isHod, isHodReadOnly, departmentName } = useHodScope()

  const { data: statsData, isLoading, isError } = useQuery({
    queryKey: ['dashboardStats'],
    queryFn: async () => {
      const res = await dashboardApi.getDashboardStats()
      return res.data.data
    },
    refetchInterval: 15_000,
  })

  // Real timetables, already scoped by the backend to whatever this account may
  // see. Same endpoint the "My Timetable" page uses — no new API is introduced.
  const { data: myTimetables, isLoading: ttLoading } = useQuery({
    queryKey: ['myTimetables'],
    queryFn: async () => {
      const res = await timetableApi.getMyTimetable()
      return res.data.data ?? []
    },
  })

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-3">
        <Loader2 className="w-8 h-8 text-accent-500 animate-spin" />
        <p className="label-caps">Fetching real-time database statistics…</p>
      </div>
    )
  }

  // Restrained warm accent set drawn from the central tokens: neutral ink,
  // gold, teal, green. Orange is reserved for primary actions + the active
  // nav, so it is deliberately NOT a KPI colour.
  const kpiStats = [
    // "Departments" is always 1 for an HOD (their own), so it is replaced by
    // the timetable count, which is the meaningful figure at department scope.
    ...(isHod
      ? [{ label: 'Timetables', value: statsData?.totalTimetables ?? 0, icon: Building2, tone: '' }]
      : [{ label: 'Departments', value: statsData?.totalDepartments ?? 0, icon: Building2, tone: '' }]),
    { label: 'Faculty',      value: statsData?.totalFaculty ?? 0,     icon: Users,     tone: '' },
    { label: 'Subjects',     value: statsData?.totalSubjects ?? 0,    icon: BookOpen,  tone: '' },
    { label: 'Classrooms',   value: statsData?.totalClassrooms ?? 0,  icon: DoorOpen,  tone: '' },
  ]

  const facultyWorkload = statsData?.facultyWorkload || []
  const roomUtilization = statsData?.roomUtilization || []
  const timetables = myTimetables ?? []

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <p className="page-breadcrumb">Overview</p>
          <h1 className="page-title">
            {getGreeting()}, {user?.fullName?.split(' ')[0]}
          </h1>
          <p className="page-subtitle">
            {new Date().toLocaleDateString('en-IN', {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
            })}
            {departmentName ? ` · ${departmentName} only` : ''}
          </p>
        </div>
        {/* Generation stays available to every other authorised role. Timetable
            generation is performed from the Timetable page, so an HOD loses no
            capability here. `isHodReadOnly` (not `isHod`) keeps the button for an
            account that also holds COLLEGE_ADMIN / SUPER_ADMIN. */}
        {!isHodReadOnly && (
          <button className="btn-primary">
            <Zap className="w-3.5 h-3.5" /> Generate Timetable
          </button>
        )}
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-2">
        {kpiStats.map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="metric-card">
            <div className={`metric-icon ${tone}`}>
              <Icon className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <p className="metric-value">{value}</p>
              <p className="metric-label">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Timetable cards: 3 columns desktop / 2 tablet / 1 mobile ── */}
      <section>
        <div className="flex items-center justify-between gap-3 mb-2">
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-ink flex items-center gap-1.5">
            <CalendarRange className="w-3.5 h-3.5" /> Timetables
          </h2>
          <span className="label-caps">
            {ttLoading ? 'Loading…' : `${timetables.length} total`}
          </span>
        </div>

        {ttLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-5 h-5 text-accent-500 animate-spin" />
          </div>
        ) : isError ? (
          <div className="card">
            <div className="empty-state py-8">
              <AlertTriangle className="w-8 h-8 text-danger/50" />
              <h3 className="empty-state-title">Could not load timetables</h3>
              <p className="empty-state-desc">Please refresh the page or verify the backend is running.</p>
            </div>
          </div>
        ) : timetables.length === 0 ? (
          <div className="card">
            <div className="empty-state py-10">
              <CalendarRange className="w-8 h-8 text-ink-mute" />
              <h3 className="empty-state-title">No timetables yet</h3>
              <p className="empty-state-desc">
                Generate a timetable from the Timetable page and it will appear here.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {timetables.map((t) => (
              <TimetableCard key={t.id} timetable={t} />
            ))}
          </div>
        )}
      </section>

      {/* ── Charts Row ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
        {/* Faculty Workload Bar Chart — the single orange chart series */}
        <div className="card p-3 xl:col-span-2">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-ink">Faculty Weekly Workload</h2>
              <p className="label-caps mt-0.5">Hours per week (calculated from DB)</p>
            </div>
            <span className="badge badge-brand">Live Database</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={facultyWorkload} barSize={18}>
              <CartesianGrid strokeDasharray="3 3" stroke="#D9CDB2" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fill: '#6B6353', fontSize: 10 }}
                axisLine={{ stroke: '#1A1A1A' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: '#6B6353', fontSize: 10 }}
                axisLine={{ stroke: '#1A1A1A' }}
                tickLine={false}
                domain={[0, 30]}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(232,89,12,0.08)' }} />
              <Bar dataKey="hours" fill="#E8590C" radius={0} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Room Utilization Donut */}
        <div className="card p-3">
          <div className="mb-3">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-ink">Room Utilization</h2>
            <p className="label-caps mt-0.5">{statsData?.totalClassrooms ?? 0} classrooms total</p>
          </div>
          <ResponsiveContainer width="100%" height={150}>
            <PieChart>
              <Pie
                data={roomUtilization}
                cx="50%" cy="50%"
                innerRadius={42}
                outerRadius={62}
                paddingAngle={2}
                dataKey="value"
                stroke="#14130F"
                strokeWidth={1}
              >
                {roomUtilization.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: '#FBF7EC', border: '1px solid #1A1A1A',
                  borderRadius: 3, fontSize: 11, color: '#14130F'
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1 mt-2">
            {roomUtilization.map(({ name, value, color }) => (
              <div key={name} className="flex items-center justify-between text-[10px]">
                <div className="flex items-center gap-1.5 min-w-0">
                  <div className="w-2 h-2 rounded-sm border border-line flex-shrink-0" style={{ background: color }} />
                  <span className="text-ink-soft truncate">{name}</span>
                </div>
                <span className="font-bold text-ink flex-shrink-0 ml-2 tabular-nums">{value}%</span>
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
