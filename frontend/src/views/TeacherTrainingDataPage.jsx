import { useEffect, useMemo, useState } from 'react'
import { Card, PrimaryButton, TextInput } from '../ui/form.jsx'
import { api } from '../utils/api.js'

export function TeacherTrainingDataPage() {
  const [examples, setExamples] = useState([])
  const [doubts, setDoubts] = useState([])
  const [prompt, setPrompt] = useState('')
  const [response, setResponse] = useState('')
  const [tags, setTags] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const canAdd = useMemo(() => prompt.trim().length >= 5 && response.trim().length >= 3, [prompt, response])

  async function load() {
    const [exRes, dRes] = await Promise.all([api.get('/training/examples'), api.get('/doubts/history')])
    setExamples(exRes.data.examples || [])
    setDoubts(dRes.data.messages || [])
  }

  useEffect(() => {
    load().catch((err) => setError(err?.response?.data?.error?.message || 'Failed to load training data'))
  }, [])

  async function addExample() {
    if (!canAdd) return
    setBusy(true)
    setError(null)
    try {
      await api.post('/training/examples', {
        prompt: prompt.trim(),
        response: response.trim(),
        tags: tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      })
      setPrompt('')
      setResponse('')
      setTags('')
      await load()
    } catch (err) {
      setError(err?.response?.data?.error?.message || 'Failed to add training example')
    } finally {
      setBusy(false)
    }
  }

  async function removeExample(id) {
    setBusy(true)
    setError(null)
    try {
      await api.delete(`/training/examples/${id}`)
      await load()
    } catch (err) {
      setError(err?.response?.data?.error?.message || 'Failed to remove example')
    } finally {
      setBusy(false)
    }
  }

  async function promoteDoubt(id) {
    setBusy(true)
    setError(null)
    try {
      await api.post(`/training/examples/from-doubt/${id}`)
      await load()
    } catch (err) {
      setError(err?.response?.data?.error?.message || 'Failed to promote doubt')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-emerald-900 tracking-tight">Training Data</h2>
        <p className="mt-2 text-slate-500 font-medium">
          Curate Q/A samples for fine-tuning your own Vedalaya doubt model.
        </p>
      </div>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 font-medium">{error}</div>}

      <Card>
        <h3 className="text-xl font-bold text-emerald-900">Add Manual Training Example</h3>
        <div className="mt-4 grid gap-4">
          <TextInput
            label="Prompt / Student Question"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Explain Newton's second law with an example."
          />
          <label className="block">
            <div className="mb-1.5 text-xs font-bold tracking-widest text-slate-500 uppercase">Response / Ideal Answer</div>
            <textarea
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              rows={5}
              className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-slate-800 outline-none placeholder:text-slate-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10 transition-all font-medium resize-y"
              placeholder="Force equals mass multiplied by acceleration..."
            />
          </label>
          <TextInput
            label="Tags (comma-separated)"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="physics, mechanics, class-10"
          />
          <div className="flex justify-end">
            <PrimaryButton onClick={addExample} disabled={!canAdd || busy}>
              {busy ? 'Saving…' : 'Add Example'}
            </PrimaryButton>
          </div>
        </div>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <h3 className="text-xl font-bold text-emerald-900">Saved Training Examples</h3>
          <div className="mt-4 space-y-3 max-h-[500px] overflow-auto pr-1">
            {examples.length === 0 ? (
              <div className="text-sm font-medium text-slate-400 p-4 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 text-center">
                No examples yet.
              </div>
            ) : (
              examples.map((ex) => (
                <div key={ex._id} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="text-xs font-bold tracking-widest text-slate-500 uppercase">Prompt</div>
                  <div className="mt-1 text-sm font-medium text-slate-800">{ex.prompt}</div>
                  <div className="mt-3 text-xs font-bold tracking-widest text-slate-500 uppercase">Response</div>
                  <div className="mt-1 text-sm text-slate-700 whitespace-pre-wrap">{ex.response}</div>
                  <div className="mt-3 flex items-center justify-between">
                    <div className="text-xs text-slate-500">
                      {(ex.tags || []).length ? `Tags: ${(ex.tags || []).join(', ')}` : 'No tags'}
                    </div>
                    <button
                      onClick={() => removeExample(ex._id)}
                      disabled={busy}
                      className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card>
          <h3 className="text-xl font-bold text-emerald-900">Promote Student Doubts</h3>
          <p className="mt-1 text-sm text-slate-500">Convert useful doubt responses into training examples.</p>
          <div className="mt-4 space-y-3 max-h-[500px] overflow-auto pr-1">
            {doubts.length === 0 ? (
              <div className="text-sm font-medium text-slate-400 p-4 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 text-center">
                No doubt history found.
              </div>
            ) : (
              doubts.map((d) => (
                <div key={d._id} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="text-xs font-bold tracking-widest text-slate-500 uppercase">Question</div>
                  <div className="mt-1 text-sm font-medium text-slate-800">{d.question}</div>
                  <div className="mt-3 text-xs font-bold tracking-widest text-slate-500 uppercase">Answer</div>
                  <div className="mt-1 text-sm text-slate-700 line-clamp-4 whitespace-pre-wrap">{d.answer}</div>
                  <div className="mt-3 flex justify-end">
                    <button
                      onClick={() => promoteDoubt(d._id)}
                      disabled={busy}
                      className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
                    >
                      Promote to Dataset
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}

