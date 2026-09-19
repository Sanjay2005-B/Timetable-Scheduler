import { useState } from 'react'
import { Settings, Save, Clock, Calendar, ShieldCheck, Database } from 'lucide-react'

export default function SettingsPage() {
  const [workingDays, setWorkingDays] = useState(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'])
  const [session, setSession] = useState('2025-2026 EVEN')
  const [maxDailyHours, setMaxDailyHours] = useState(6)
  const [saved, setSaved] = useState(false)

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="page-header">
        <div>
          <h1 className="page-title">System Settings</h1>
          <p className="page-subtitle">Configure college working days, period timings, academic session, and security defaults</p>
        </div>
      </div>

      {saved && (
        <div className="p-4 rounded-xl bg-success/15 border border-success/30 text-success text-xs font-semibold animate-fade-in">
          ✅ Settings saved successfully!
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Working Days & Academic Session */}
        <div className="card p-6 space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-white/10 pb-3">
            <Calendar className="w-5 h-5 text-brand-400" /> Academic & Working Schedule
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="form-group">
              <label className="label">Current Academic Session</label>
              <input
                type="text"
                className="input"
                value={session}
                onChange={(e) => setSession(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="label">Max Daily Teaching Hours (Default)</label>
              <input
                type="number"
                min="1"
                max="10"
                className="input"
                value={maxDailyHours}
                onChange={(e) => setMaxDailyHours(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="label">Active College Working Days</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => {
                const isSelected = workingDays.includes(day)
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        setWorkingDays(workingDays.filter((d) => d !== day))
                      } else {
                        setWorkingDays([...workingDays, day])
                      }
                    }}
                    className={`btn-sm ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                  >
                    {day}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Database & Security Summary */}
        <div className="card p-6 space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-white/10 pb-3">
            <ShieldCheck className="w-5 h-5 text-emerald-400" /> Security & Database Defaults
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-surface-100 space-y-1">
              <span className="text-gray-400 block font-semibold">JWT Authentication</span>
              <span className="text-gray-300">Alg: HS512 · Access Token: 15 min · Refresh: 7 days</span>
            </div>
            <div className="p-4 rounded-xl bg-surface-100 space-y-1">
              <span className="text-gray-400 block font-semibold">Database Engine</span>
              <span className="text-emerald-400 font-semibold">PostgreSQL 16 / H2 Compatible Mode</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button type="submit" className="btn-primary btn-lg">
            <Save className="w-4 h-4" /> Save System Settings
          </button>
        </div>
      </form>
    </div>
  )
}
