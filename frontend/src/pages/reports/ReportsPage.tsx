import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart3, Download, Printer, Users, DoorOpen, FileText } from 'lucide-react'
import { facultyApi } from '@/api/facultyApi'
import axiosClient from '@/api/axiosClient'

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

            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Day</th>
                    <th>Period</th>
                    <th>Subject Course</th>
                    <th>Classroom</th>
                  </tr>
                </thead>
                <tbody>
                  {facultyReport.entries?.map((e: any, i: number) => (
                    <tr key={i}>
                      <td className="font-bold text-xs text-brand-300">{e.day}</td>
                      <td>Period {e.slot}</td>
                      <td className="font-semibold text-white">{e.subject}</td>
                      <td><span className="badge badge-gray">{e.room}</span></td>
                    </tr>
                  ))}
                  {(!facultyReport.entries || facultyReport.entries.length === 0) && (
                    <tr>
                      <td colSpan={4} className="text-center py-6 text-gray-500">No scheduled periods found for this faculty member yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <p className="text-xs text-gray-500 py-6 text-center">Select a faculty member above to view their schedule report.</p>
        )}
      </div>
    </div>
  )
}
