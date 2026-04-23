import { useEffect, useState } from 'react'
import { api } from '../utils/api.js'
import { Card, PrimaryButton } from '../ui/form.jsx'

export function DoubtAssistantPage() {
  const [question, setQuestion] = useState('')
  const [messages, setMessages] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const res = await api.get('/doubts/history')
      if (!cancelled) setMessages((res.data.messages || []).reverse())
    }
    load().catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  async function ask() {
    if (!question.trim()) return
    setBusy(true)
    setError(null)
    try {
      const q = question.trim()
      setQuestion('')
      const res = await api.post('/doubts/ask', { question: q })
      setMessages((m) => [...m, res.data.message])
    } catch (err) {
      setError(err?.response?.data?.error?.message || 'Failed to ask doubt')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-emerald-900 tracking-tight">Doubt Assistant</h2>
        <p className="mt-2 text-slate-500 font-medium">
          Ask your question. The assistant uses your Vedalaya content (quizzes, lectures, flashcards) to answer.
        </p>
      </div>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 font-medium">{error}</div>}

      <Card>
        <div className="flex flex-col gap-3">
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={4}
            placeholder="Type your doubt here..."
            className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-slate-800 outline-none placeholder:text-slate-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10 transition-all font-medium resize-y"
          />
          <div className="flex justify-end">
            <PrimaryButton onClick={ask} disabled={busy || !question.trim()}>
              {busy ? 'Thinking…' : 'Ask Doubt'}
            </PrimaryButton>
          </div>
        </div>
      </Card>

      <div className="space-y-4">
        {messages.map((m) => (
          <Card key={m._id || m.id}>
            <div className="text-sm font-bold tracking-widest text-emerald-800 uppercase">Question</div>
            <div className="mt-2 text-slate-800 font-medium">{m.question}</div>
            <div className="mt-4 text-sm font-bold tracking-widest text-indigo-700 uppercase">Answer</div>
            <div className="mt-2 whitespace-pre-wrap text-slate-700">{m.answer}</div>
            {m.contextSources?.length ? (
              <div className="mt-3 text-xs text-slate-500">
                Sources: {m.contextSources.slice(0, 4).join(' | ')}
              </div>
            ) : null}
          </Card>
        ))}
      </div>
    </div>
  )
}

