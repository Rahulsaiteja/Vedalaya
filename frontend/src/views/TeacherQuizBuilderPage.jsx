import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../utils/api.js'
import { Card, PrimaryButton, TextInput } from '../ui/form.jsx'

function EmptyQuestion() {
  return { prompt: '', options: ['', '', '', ''], correctOptionIndex: 0 }
}

export function TeacherQuizBuilderPage({ mode }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = mode === 'edit'

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [timeLimitSeconds, setTimeLimitSeconds] = useState(300)
  const [questions, setQuestions] = useState([EmptyQuestion()])

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!isEdit) return
      const res = await api.get(`/quizzes/${id}`)
      const q = res.data.quiz
      if (cancelled) return
      setTitle(q.title || '')
      setDescription(q.description || '')
      setTimeLimitSeconds(q.timeLimitSeconds || 300)
      setQuestions(
        (q.questions || []).map((qq) => ({
          prompt: qq.prompt,
          options: qq.options || [],
          correctOptionIndex: qq.correctOptionIndex ?? 0,
        })),
      )
    }
    load().catch((err) => {
      if (!cancelled) setError(err?.response?.data?.error?.message || 'Failed to load quiz')
    })
    return () => {
      cancelled = true
    }
  }, [id, isEdit])

  const canSave = useMemo(() => title.trim().length > 0, [title])

  function updateQuestion(idx, patch) {
    setQuestions((qs) => qs.map((q, i) => (i === idx ? { ...q, ...patch } : q)))
  }

  function updateOption(qIdx, optIdx, value) {
    setQuestions((qs) =>
      qs.map((q, i) => {
        if (i !== qIdx) return q
        const options = [...(q.options || [])]
        options[optIdx] = value
        return { ...q, options }
      }),
    )
  }

  function addQuestion() {
    setQuestions((qs) => [...qs, EmptyQuestion()])
  }

  async function save() {
    setBusy(true)
    setError(null)
    try {
      const payload = {
        title,
        description,
        timeLimitSeconds: Number(timeLimitSeconds),
        questions: questions
          .map((q) => ({
            prompt: q.prompt,
            options: (q.options || []).filter((o) => o.trim()),
            correctOptionIndex: Number(q.correctOptionIndex),
          }))
          .filter((q) => q.prompt.trim() && q.options.length >= 2),
      }

      if (isEdit) await api.put(`/quizzes/${id}`, payload)
      else await api.post('/quizzes', payload)
      navigate('/teacher', { replace: true })
    } catch (err) {
      setError(err?.response?.data?.error?.message || 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-emerald-900 tracking-tight">{isEdit ? 'Edit Quiz' : 'Create Quiz'}</h2>
          <p className="mt-2 text-slate-500 font-medium">Add questions manually and set the correct answer for each.</p>
        </div>
        <div className="flex gap-4">
          <Link to="/teacher" className="rounded-full border-2 border-slate-200 bg-white px-6 py-3 text-xs font-bold tracking-widest text-slate-600 hover:bg-slate-50 hover:text-emerald-800 hover:border-emerald-200 transition-colors">
            CANCEL
          </Link>
          <PrimaryButton onClick={save} disabled={!canSave || busy}>
            {busy ? 'SAVING…' : 'SAVE QUIZ'}
          </PrimaryButton>
        </div>
      </div>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 font-medium">{error}</div>}

      <Card>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-emerald-900">Quiz details</h3>
        </div>
        <div className="grid gap-5">
          <div className="grid md:grid-cols-2 gap-4">
            <TextInput label="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
            <TextInput
              label="Time limit (seconds)"
              type="number"
              min={10}
              value={timeLimitSeconds}
              onChange={(e) => setTimeLimitSeconds(e.target.value)}
            />
          </div>
          <label className="block">
            <div className="mb-1.5 text-xs font-bold tracking-widest text-slate-500 uppercase">Description</div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-slate-800 outline-none placeholder:text-slate-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10 transition-all font-medium resize-y"
              placeholder="Optional description"
            />
          </label>
        </div>
      </Card>

      <div className="flex items-center justify-between mt-8 border-b border-slate-200 pb-4">
        <h3 className="text-2xl font-bold text-emerald-900 tracking-tight">Questions ({questions.length})</h3>
        <button onClick={addQuestion} className="rounded-lg border-2 border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 hover:text-emerald-700 hover:border-emerald-200 shadow-sm transition-colors">
          + ADD QUESTION
        </button>
      </div>

      <div className="grid gap-6">
        {questions.map((q, idx) => (
          <Card key={idx}>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-sm">{idx + 1}</div>
              <div className="text-xs font-bold tracking-widest text-slate-400 uppercase">Question Details</div>
            </div>
            
            <div className="mb-6">
              <TextInput
                label="Prompt"
                value={q.prompt}
                onChange={(e) => updateQuestion(idx, { prompt: e.target.value })}
                placeholder="Enter question prompt"
              />
            </div>

            <div className="mb-3 text-xs font-bold tracking-widest text-slate-500 uppercase">Answers (Select the correct one)</div>
            <div className="grid gap-3 sm:grid-cols-2 bg-slate-50 border border-slate-100 rounded-2xl p-4">
              {Array.from({ length: Math.max(4, q.options?.length || 0) }).map((_, oi) => {
                const isSelected = Number(q.correctOptionIndex) === oi;
                return (
                  <div key={oi} className={`flex items-center gap-3 rounded-xl border-2 px-3 py-2 transition-all ${
                    isSelected ? 'border-emerald-500 bg-white shadow-sm' : 'border-transparent hover:border-slate-200 bg-white/50'
                  }`}>
                    <input
                      type="radio"
                      name={`correct-${idx}`}
                      className="w-5 h-5 text-emerald-600 focus:ring-emerald-600 border-slate-300"
                      checked={isSelected}
                      onChange={() => updateQuestion(idx, { correctOptionIndex: oi })}
                    />
                    <input
                      value={q.options?.[oi] ?? ''}
                      onChange={(e) => updateOption(idx, oi, e.target.value)}
                      placeholder={`Option ${oi + 1}`}
                      className={`w-full bg-transparent outline-none font-medium placeholder:text-slate-400 ${
                        isSelected ? 'text-emerald-900' : 'text-slate-700'
                      }`}
                    />
                  </div>
                );
              })}
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

