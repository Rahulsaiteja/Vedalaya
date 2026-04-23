import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../utils/api.js'
import { Card } from '../ui/form.jsx'

export function TeacherQuizAnalyticsPage() {
  const { id } = useParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setError(null)
      const res = await api.get(`/attempts/quiz/${id}`)
      if (!cancelled) setData(res.data)
    }
    load().catch((err) => {
      if (!cancelled) setError(err?.response?.data?.error?.message || 'Failed to load analytics')
    })
    return () => {
      cancelled = true
    }
  }, [id])

  return (
    <div className="max-w-4xl mx-auto space-y-8 mt-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-emerald-900 tracking-tight">Quiz Analytics</h2>
          <p className="mt-2 text-slate-500 font-medium">Attempts and average score for this quiz.</p>
        </div>
        <Link to="/teacher" className="rounded-full border-2 border-slate-200 bg-white px-6 py-3 text-xs font-bold tracking-widest text-slate-600 hover:bg-slate-50 hover:text-emerald-800 hover:border-emerald-200 transition-colors">
          BACK TO DASHBOARD
        </Link>
      </div>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 font-medium">{error}</div>}
      {!data ? (
        <div className="text-slate-400 font-medium text-center py-20 animate-pulse">Loading analytics…</div>
      ) : (
        <div className="grid gap-8">
          <Card>
            <div className="text-2xl font-bold text-emerald-900 mb-6">{data.quiz?.title || 'Quiz Details'}</div>
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex-1 bg-slate-50 border border-slate-100 rounded-2xl p-6 text-center">
                <div className="text-xs font-bold tracking-widest text-slate-400 uppercase mb-2">Total Attempts</div>
                <div className="text-4xl font-black text-slate-800">{data.analytics?.attempts ?? 0}</div>
              </div>
              <div className="flex-1 bg-emerald-50 border border-emerald-100 rounded-2xl p-6 text-center">
                <div className="text-xs font-bold tracking-widest text-emerald-600 uppercase mb-2">Average Score</div>
                <div className="text-4xl font-black text-emerald-900">{data.analytics?.averageScore ?? 0}%</div>
              </div>
            </div>
          </Card>

          <Card>
            <div className="text-xl font-bold text-emerald-900 mb-6 border-b border-slate-100 pb-4">Recent Attempts</div>
            <div className="space-y-4">
              {(data.attempts || []).length === 0 ? (
                <div className="text-sm font-medium text-slate-400 p-8 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 text-center">No attempts yet.</div>
              ) : (
                data.attempts.map((a) => (
                  <div key={a._id || a.id} className="rounded-2xl border-2 border-slate-100 bg-slate-50 p-5 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center transition-colors hover:border-slate-200 hover:bg-white">
                    <div>
                      <div className="font-bold text-lg text-slate-800">{a.student?.name || 'Anonymous Student'}</div>
                      <div className="mt-1 flex items-center gap-3 text-sm font-medium text-slate-500">
                        {a.student?.email ? <span>{a.student.email}</span> : null}
                        {a.student?.email && <span className="text-slate-300">•</span>}
                        <span className="text-xs font-bold tracking-wider text-slate-400">
                          {new Date(a.submittedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border-2 border-slate-100 shadow-sm">
                      <span className="text-[10px] font-bold tracking-[0.2em] text-slate-400 uppercase">SCORE</span>
                      <span className="font-black text-emerald-600 text-lg">{a.score}%</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

