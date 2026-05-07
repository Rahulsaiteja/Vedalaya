import { useEffect, useMemo, useState, useRef, useCallback } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../utils/api.js'
import { Card, PrimaryButton } from '../ui/form.jsx'
import { useLanguage } from '../state/LanguageContext.jsx'

export function QuizAttemptPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t } = useLanguage()
  const [quiz, setQuiz] = useState(null)
  const [selected, setSelected] = useState({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)
  const [review, setReview] = useState(null)
  const [timeLeft, setTimeLeft] = useState(null)
  
  const selectedRef = useRef(selected)
  useEffect(() => {
    selectedRef.current = selected
  }, [selected])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setError(null)
      const res = await api.get(`/quizzes/${id}`)
      if (!cancelled) {
        if (res.data.quiz.attempted) {
          setError('You have already attempted this quiz.')
        } else {
          setQuiz(res.data.quiz)
          setTimeLeft(res.data.quiz.timeLimitSeconds || undefined)
        }
      }
    }
    load().catch((err) => {
      if (!cancelled) setError(err?.response?.data?.error?.message || 'Failed to load quiz')
    })
    return () => {
      cancelled = true
    }
  }, [id])

  const questions = useMemo(() => quiz?.questions || [], [quiz])

  const submit = useCallback(async () => {
    if (!quiz) return
    setBusy(true)
    setError(null)
    try {
      const answers = quiz.questions
        .map((q) => {
          const sel = selectedRef.current[q._id]
          if (typeof sel !== 'number') return null
          return { questionId: q._id, selectedIndex: sel }
        })
        .filter(Boolean)

      const res = await api.post('/attempts/submit', { quizId: quiz._id, answers })
      setResult(res.data)
      const detail = await api.get(`/attempts/${res.data.attemptId}`)
      setReview(detail.data.attempt)
    } catch (err) {
      setError(err?.response?.data?.error?.message || 'Submit failed')
    } finally {
      setBusy(false)
    }
  }, [quiz])

  // Timer logic
  useEffect(() => {
    if (timeLeft === null || timeLeft === undefined || busy || result) return
    if (timeLeft <= 0) {
      submit()
      return
    }

    const timerId = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerId)
          submit()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timerId)
  }, [timeLeft, busy, result, submit])

  const formatTime = (seconds) => {
    if (seconds == null || isNaN(seconds)) return ''
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  if (result) {
    return (
      <div className="mx-auto max-w-3xl mt-8">
        <Card>
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-emerald-900 tracking-tight">{t('quiz_complete')}</h2>
            <p className="mt-2 text-slate-500 font-medium text-lg">
              {t('your_score')}: <span className="font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-lg ml-2">{result.score}%</span>
            </p>
          </div>
          {review?.review?.length ? (
            <div className="mt-8 space-y-4">
              <div className="text-sm font-bold tracking-widest text-slate-400 uppercase border-b border-slate-100 pb-2">{t('review')}</div>
              {review.review.map((q, idx) => (
                <div key={q.questionId} className="rounded-2xl border-2 border-slate-100 bg-slate-50 p-6">
                  <div className="text-xs font-bold tracking-widest text-emerald-700 uppercase mb-2">{t('question')} {idx + 1}</div>
                  <div className="text-lg font-bold text-slate-800">{q.prompt}</div>
                  <ul className="mt-4 space-y-2 text-sm font-medium">
                    {q.options.map((opt, oi) => {
                      const isCorrect = oi === q.correctOptionIndex
                      const isSelected = oi === q.selectedIndex
                      const tone = isCorrect
                        ? 'text-emerald-700 bg-emerald-50 border-emerald-200 border w-full rounded-xl px-4 py-3 font-bold'
                        : isSelected
                          ? 'text-rose-700 bg-rose-50 border-rose-200 border w-full rounded-xl px-4 py-3 font-bold'
                          : 'text-slate-500 bg-white border-slate-200 border w-full rounded-xl px-4 py-3'
                      return (
                        <li key={oi} className={`flex items-center gap-3 ${tone}`}>
                          {isCorrect ? (
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                          ) : isSelected ? (
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                          ) : (
                            <div className="w-5 h-5 rounded-full border-2 border-slate-300" />
                          )}
                          {opt}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
            </div>
          ) : null}
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <PrimaryButton onClick={() => navigate('/student')}>{t('back_to_dashboard').toUpperCase()}</PrimaryButton>
            <Link to={`/quizzes/${id}`} className="rounded-full border-2 border-slate-200 px-6 py-3 text-xs font-bold tracking-widest text-slate-600 hover:bg-slate-50 hover:text-emerald-800 hover:border-emerald-200 transition-colors">
              {t('view_quiz_details').toUpperCase()}
            </Link>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto mt-4">
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 font-medium mb-6">{error}</div>}
      {!quiz ? (
        <div className="text-slate-400 font-medium text-center py-20 animate-pulse">{t('loading_quiz')}</div>
      ) : (
        <div className="grid gap-8">
          <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100 flex flex-wrap items-center justify-between gap-6 sticky top-24 z-40">
            <div>
              <h2 className="text-3xl font-bold text-emerald-900 tracking-tight">{quiz.title}</h2>
              <div className="mt-4 flex items-center gap-3 text-xs font-bold tracking-widest text-slate-400 uppercase">
                <span className="bg-slate-100 px-3 py-1.5 rounded-md text-emerald-800">{questions.length} {t('questions')}</span>
                {timeLeft != null && (
                  <span className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors ${
                    timeLeft <= 60 ? 'bg-rose-100 text-rose-700 animate-pulse' : 'bg-emerald-50 text-emerald-700'
                  }`}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                    {formatTime(timeLeft)}
                  </span>
                )}
              </div>
            </div>
            <PrimaryButton onClick={submit} disabled={busy || (timeLeft != null && timeLeft <= 0)}>
              {busy ? t('submitting').toUpperCase() : t('submit_answers').toUpperCase()}
            </PrimaryButton>
          </div>

          <div className="space-y-8">
            {questions.map((q, idx) => (
              <Card key={q._id}>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-lg">{idx + 1}</div>
                  <div className="text-xs font-bold tracking-widest text-slate-400 uppercase">{t('question')}</div>
                </div>
                
                <h3 className="text-xl font-bold text-slate-800 leading-snug mb-8">{q.prompt}</h3>
                
                <div className="grid gap-3">
                  {q.options.map((opt, oi) => (
                    <label
                      key={oi}
                      className={`flex cursor-pointer items-center gap-4 rounded-xl border-2 px-5 py-4 transition-all ${
                        selected[q._id] === oi
                          ? 'border-emerald-600 bg-emerald-50 shadow-sm'
                          : 'border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name={q._id}
                        className="w-5 h-5 text-emerald-600 focus:ring-emerald-600 border-slate-300"
                        checked={selected[q._id] === oi}
                        onChange={() => setSelected((s) => ({ ...s, [q._id]: oi }))}
                      />
                      <span className={`font-medium ${selected[q._id] === oi ? 'text-emerald-900' : 'text-slate-600'}`}>{opt}</span>
                    </label>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

