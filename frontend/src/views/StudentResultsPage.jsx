import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../utils/api.js'
import { Card } from '../ui/form.jsx'
import { useLanguage } from '../state/LanguageContext.jsx'

export function StudentResultsPage() {
  const { t } = useLanguage()
  const [attempts, setAttempts] = useState([])
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await api.get('/attempts/me')
        if (cancelled) return
        setAttempts(res.data.attempts || [])
      } catch (err) {
        if (!cancelled) setError(err?.response?.data?.error?.message || 'Failed to load results')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const stats = useMemo(() => {
    if (attempts.length === 0) return { totalAttempts: 0, uniqueQuizzes: 0, avgScore: 0 }
    
    // Some quizzes might have been attempted multiple times before the unique attempt limit was introduced,
    // so we count total attempts, and average score across all attempts.
    const totalScore = attempts.reduce((acc, curr) => acc + curr.score, 0)
    const avgScore = Math.round(totalScore / attempts.length)
    
    const uniqueQuizzes = new Set(attempts.map(a => a.quiz?.id).filter(Boolean)).size

    return { totalAttempts: attempts.length, uniqueQuizzes, avgScore }
  }, [attempts])

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-16">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-emerald-900 tracking-tight">{t('results_title')}</h2>
          <p className="mt-2 text-slate-500 font-medium">{t('results_subtitle')}</p>
        </div>
      </div>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 font-medium">{error}</div>}

      {loading ? (
        <div className="text-slate-400 font-medium text-center py-20 animate-pulse">{t('loading_results')}</div>
      ) : (
        <>
          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="flex flex-col items-center justify-center text-center p-8">
              <div className="text-xs font-bold tracking-[0.2em] text-slate-400 uppercase mb-2">{t('total_quizzes_attempted')}</div>
              <div className="text-5xl font-bold text-emerald-900">{stats.uniqueQuizzes}</div>
            </Card>
            <Card className="flex flex-col items-center justify-center text-center p-8">
              <div className="text-xs font-bold tracking-[0.2em] text-slate-400 uppercase mb-2">{t('total_submissions')}</div>
              <div className="text-5xl font-bold text-slate-800">{stats.totalAttempts}</div>
            </Card>
            <Card className="flex flex-col items-center justify-center text-center p-8 bg-emerald-50 border-emerald-100">
              <div className="text-xs font-bold tracking-[0.2em] text-emerald-700 uppercase mb-2">{t('average_accuracy')}</div>
              <div className="text-5xl font-bold text-emerald-600">{stats.avgScore}%</div>
            </Card>
          </div>

          {/* Attempt History */}
          <Card>
            <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-4">
              <h3 className="text-xl font-bold text-emerald-900">{t('attempt_history')}</h3>
            </div>
            
            <div className="space-y-4">
              {attempts.length === 0 ? (
                <div className="text-sm font-medium text-slate-400 p-8 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 text-center">
                  {t('no_attempts_results')} <br/><br/>
                  <Link to="/student" className="inline-block rounded-full bg-emerald-800 px-6 py-2.5 text-xs font-bold tracking-widest text-white hover:bg-emerald-700 transition-colors uppercase">
                    {t('find_quizzes')}
                  </Link>
                </div>
              ) : (
                attempts.map((a) => (
                  <div key={a.id} className="rounded-2xl border-2 border-slate-100 bg-white hover:bg-slate-50 transition-colors p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 group">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className={`px-2.5 py-1 text-[10px] font-bold tracking-widest uppercase rounded-md ${
                          a.score >= 80 ? 'bg-emerald-100 text-emerald-800' :
                          a.score >= 50 ? 'bg-amber-100 text-amber-800' :
                          'bg-rose-100 text-rose-800'
                        }`}>
                          {a.score >= 80 ? t('excellent') : a.score >= 50 ? t('passed') : t('needs_review')}
                        </div>
                        <span className="text-xs font-bold text-slate-400">
                          {new Date(a.submittedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                      <h4 className="text-lg font-bold text-slate-800 tracking-tight group-hover:text-emerald-800 transition-colors">
                        {a.quiz?.title || t('unknown_quiz')}
                      </h4>
                      <p className="text-sm font-medium text-slate-500 mt-1">
                        {a.totalQuestions} {t('questions_total')}
                      </p>
                    </div>
                    
                    <div className="flex flex-col items-end gap-3 w-full sm:w-auto mt-2 sm:mt-0 pt-4 sm:pt-0 border-t sm:border-0 border-slate-100">
                      <div className="flex items-center gap-2 bg-slate-100 px-4 py-2 rounded-xl">
                        <span className="text-[10px] font-bold tracking-widest text-slate-500 uppercase">{t('score_uppercase')}</span>
                        <span className="text-lg font-bold text-slate-800">{a.score}%</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
