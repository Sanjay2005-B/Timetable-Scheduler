import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart3, Printer, Users, DoorOpen, FileText, User, Building2, CalendarClock } from 'lucide-react'
import { facultyApi } from '@/api/facultyApi'
import { availabilityApi, TimeSlot } from '@/api/availabilityApi'
import axiosClient from '@/api/axiosClient'

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

export default function ReportsPage() {
  const [selectedFacultyId, setSelectedFacultyId] = useState<number | null>(null)

  const { data: facultyList } = useQuery({
    queryKey: ['faculty'],
    queryFn: async () => {
      const res = await facultyApi.getFaculty({ size: 100 })
      const list = res.data.data?.content || []
      if (list.length > 0 && selectedFacultyId === null) {
        setSelectedFacultyId(list[0].id)
      }
      return list
    },
  })

  const { data: facultyReport } = useQuery({
    queryKey: ['facultyReport', selectedFacultyId],
    queryFn: async () => {
      if (!selectedFacultyId) return null
      const res = await axiosClient.get(`/reports/faculty/${selectedFacultyId}`)
      return res.data.data
    },
    enabled: !!selectedFacultyId,
  })

  const { data: timeSlotData } = useQuery<TimeSlot[]>({
    queryKey: ['timeSlots'],
    queryFn: async () => {
      const res = await availabilityApi.getTimeSlots()
      return res.data?.data || []
    },
  })

  // Grid columns come from the TimeSlot master (same pattern as TimetablePage):
  // break/lunch slots excluded, sorted by slotOrder, labelled with their times.
  const columns: { key: string; label: string }[] = (timeSlotData ?? [])
    .filter((ts) => !ts.isBreak)
    .sort((a, b) => (a.slotOrder ?? 0) - (b.slotOrder ?? 0))
    .map((ts) => ({
      key: String(ts.id),
      label: `${ts.startTime} - ${ts.endTime}`,
    }))

  // Group the faculty's entries by day & slot identity so cells match columns.
  const entryMap = new Map<string, any>()
  facultyReport?.entries?.forEach((e: any) => {
    entryMap.set(`${e.day}_${e.timeSlotId}`, e)
  })

  const { data: roomReport } = useQuery({
    queryKey: ['roomReport'],
    queryFn: async () => {
      const res = await axiosClient.get('/reports/rooms/utilization')
      return res.data.data
    },
  })

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Report & Analytics Centre</h1>
          <p className="page-subtitle">Export faculty workload, timetable schedules, and classroom utilization reports</p>
        </div>
        <button onClick={() => window.print()} className="btn-secondary">
          <Printer className="w-4 h-4" /> Print Report
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="card p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-brand-500/20 text-brand-400 flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-2xl font-bold text-white">{facultyList?.length || 0}</p>
            <p className="text-xs text-gray-400">Total Faculty Members</p>
          </div>
        </div>

        <div className="card p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <DoorOpen className="w-6 h-6" />
          </div>
          <div>
            <p className="text-2xl font-bold text-white">{roomReport?.totalRooms || 0}</p>
            <p className="text-xs text-gray-400">Available Classrooms</p>
          </div>
        </div>

        <div className="card p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-2xl font-bold text-white">100%</p>
            <p className="text-xs text-gray-400">Timetable Accuracy Rate</p>
          </div>
        </div>
      </div>

      {/* Faculty Individual Schedule Report */}
      <div className="card p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-brand-400" /> Faculty Schedule Report
          </h3>

          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400">Faculty:</span>
            <select
              className="input w-auto min-w-[240px]"
              value={selectedFacultyId || ''}
              onChange={(e) => setSelectedFacultyId(Number(e.target.value))}
            >
              {facultyList?.map((f) => (
                <option key={f.id} value={f.id}>{f.fullName} ({f.employeeId})</option>
              ))}
            </select>
          </div>
        </div>

        {facultyReport ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-gray-400 bg-surface-100 p-3 rounded-xl">
              <span>Assigned Total Weekly Periods: <strong className="text-white text-sm">{facultyReport.assignedPeriodsCount} periods</strong></span>
              <span>Faculty: <strong className="text-brand-300">{facultyReport.faculty}</strong></span>
            </div>

            {columns.length === 0 ? (
              <p className="text-xs text-gray-500 py-6 text-center">
                Time slot master is unavailable — cannot render the weekly grid.
              </p>
            ) : (
              <div className="card overflow-x-auto p-4">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="px-2 py-1.5 text-[11px] font-bold text-gray-400 uppercase w-24">Day / Slot</th>
                      {columns.map((col) => (
                        <th key={col.key} className="px-2 py-1.5 text-[11px] font-bold text-gray-300 text-center min-w-[140px]">
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {DAYS.map((day) => (
                      <tr key={day} className="hover:bg-white/[0.02]">
                        <td className="px-2 py-1.5 text-[11px] font-bold text-brand-300 uppercase tracking-wider bg-surface-100/50">
                          {day}
                        </td>
                        {columns.map((col) => {
                          const entry = entryMap.get(`${day}_${col.key}`)
                          if (!entry) {
                            return (
                              <td key={col.key} className="p-1.5 text-center text-[11px] border border-white/5">
                                <span className="text-gray-600 italic">FREE</span>
                              </td>
                            )
                          }
                          const isLab = entry.isLab
                          return (
                            <td key={col.key} className="p-1 border border-white/5 relative group">
                              <div
                                className={`px-2 py-1.5 rounded-md space-y-0.5 transition-all ${
                                  isLab
                                    ? 'bg-purple-500/15 border border-purple-500/30'
                                    : 'bg-brand-500/15 border border-brand-500/30'
                                }`}
                              >
                                <div className="flex items-center gap-1">
                                  <span className="font-bold text-[11px] text-white">{entry.subjectCode}</span>
                                  <span className={`text-[9px] px-1 py-px rounded font-semibold ${isLab ? 'bg-purple-500/30 text-purple-200' : 'bg-brand-500/30 text-brand-200'}`}>
                                    {isLab ? 'LAB' : 'THEORY'}
                                  </span>
                                </div>
                                <div className="text-[10px] font-medium text-gray-200 truncate">{entry.subjectName}</div>
                                <div className="text-[9px] text-gray-400 flex items-center gap-1">
                                  <User className="w-2.5 h-2.5 text-violet-400" /> {entry.yearLabel} Sec {entry.sectionName}
                                </div>
                                <div className="text-[9px] text-gray-400 flex items-center gap-1">
                                  <Building2 className="w-2.5 h-2.5 text-emerald-400" /> {entry.roomNumber}
                                </div>
                              </div>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {!facultyReport.entries || facultyReport.entries.length === 0 ? (
              <p className="text-xs text-gray-500 py-3 text-center flex items-center justify-center gap-1.5">
                <CalendarClock className="w-3.5 h-3.5" /> No scheduled periods found for this faculty member yet.
              </p>
            ) : null}
          </div>
        ) : (
          <p className="text-xs text-gray-500 py-6 text-center">Select a faculty member above to view their schedule report.</p>
        )}
      </div>
    </div>
  )
}
