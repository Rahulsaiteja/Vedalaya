import { useEffect, useState } from 'react'
import { api } from '../utils/api.js'
import { Card, PrimaryButton, TextInput } from '../ui/form.jsx'
import { useLanguage } from '../state/LanguageContext.jsx'

function getFontSizeClass(text, isFront) {
  const len = text?.length || 0;
  if (isFront) {
    if (len < 50) return 'text-xl sm:text-2xl';
    if (len < 100) return 'text-lg sm:text-xl';
    if (len < 150) return 'text-base sm:text-lg';
    return 'text-sm sm:text-base';
  } else {
    if (len < 80) return 'text-lg sm:text-xl';
    if (len < 150) return 'text-base sm:text-lg';
    if (len < 250) return 'text-sm sm:text-base';
    if (len < 400) return 'text-xs sm:text-sm';
    return 'text-[10px] sm:text-xs leading-tight';
  }
}

function FlipCard({ front, back, t }) {
  const [flipped, setFlipped] = useState(false)
  return (
    <div className="perspective-1000 w-full h-[240px] group">
      <div 
        onClick={() => setFlipped((f) => !f)}
        className={`relative w-full h-full transition-transform duration-700 transform-style-3d cursor-pointer ${flipped ? 'rotate-y-180' : ''}`}
      >
        {/* Front */}
        <div className="absolute inset-0 backface-hidden rounded-[2rem] border border-slate-200 bg-white p-4 sm:p-6 text-center flex flex-col items-center shadow-sm hover:shadow-md transition-shadow">
          <div className="shrink-0 text-[10px] font-bold tracking-[0.2em] text-slate-300 uppercase">{t('click_to_flip')}</div>
          <div className="flex-1 w-full mt-4 overflow-y-auto custom-scrollbar flex items-center justify-center">
            <div className={`font-bold text-emerald-900 leading-snug py-2 break-words ${getFontSizeClass(front, true)}`}>{front}</div>
          </div>
        </div>
        
        {/* Back */}
        <div className="absolute inset-0 backface-hidden rotate-y-180 rounded-[2rem] border-2 border-emerald-100 bg-emerald-50 p-4 sm:p-6 text-center flex flex-col items-center shadow-md">
          <div className="shrink-0 text-[10px] font-bold tracking-[0.2em] text-emerald-300 uppercase">{t('answer')}</div>
          <div className="flex-1 w-full mt-4 overflow-y-auto custom-scrollbar flex items-center justify-center">
            <div className={`font-medium text-emerald-900 leading-snug py-2 break-words text-left whitespace-pre-wrap w-full ${getFontSizeClass(back, false)}`}>{back}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function FlashcardsPage() {
  const { t } = useLanguage()
  const [sets, setSets] = useState([])
  const [activeSet, setActiveSet] = useState(null)
  const [title, setTitle] = useState('')
  const [topic, setTopic] = useState('')
  const [text, setText] = useState('')
  const [generated, setGenerated] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function loadSets() {
    const res = await api.get('/flashcards/sets/me')
    setSets(res.data.sets || [])
  }

  useEffect(() => {
    loadSets().catch(() => {})
  }, [])

  async function openSet(id) {
    const res = await api.get(`/flashcards/sets/${id}`)
    setActiveSet(res.data.set)
  }

  async function deleteSet(id, e) {
    e.stopPropagation()
    if (!confirm(t('delete_confirm_flashcard'))) return
    setBusy(true)
    setError(null)
    try {
      await api.delete(`/flashcards/sets/${id}`)
      if (activeSet?._id === id) setActiveSet(null)
      await loadSets()
    } catch (err) {
      setError(err?.response?.data?.error?.message || 'Failed to delete set')
    } finally {
      setBusy(false)
    }
  }

  async function generate() {
    setBusy(true)
    setError(null)
    try {
      const res = await api.post('/generate/flashcards', { text, maxCards: 12 })
      setGenerated(res.data.cards || [])
    } catch (err) {
      setError(err?.response?.data?.error?.message || 'Generation failed')
    } finally {
      setBusy(false)
    }
  }

  async function saveSet() {
    if (!title.trim()) {
      setError('Title is required')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await api.post('/flashcards/sets', { title, topic, cards: generated })
      setTitle('')
      setTopic('')
      setText('')
      setGenerated([])
      setActiveSet(res.data.set)
      await loadSets()
    } catch (err) {
      setError(err?.response?.data?.error?.message || 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-emerald-900 tracking-tight">{t('flashcards_title')}</h2>
        <p className="mt-2 text-slate-500 font-medium">{t('flashcards_subtitle')}</p>
      </div>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 font-medium">{error}</div>}

      <div className="grid gap-8 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <Card>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-emerald-900">{t('your_sets')}</h3>
            </div>
            <div className="space-y-3">
              {sets.length === 0 ? (
                <div className="text-sm font-medium text-slate-400 p-4 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 text-center">{t('no_sets')}</div>
              ) : (
                sets.map((s) => (
                  <button
                    key={s._id}
                    onClick={() => openSet(s._id)}
                    className={`w-full rounded-2xl border-2 p-5 text-left transition-all group ${
                      activeSet?._id === s._id 
                        ? 'border-emerald-600 bg-emerald-50/50 shadow-sm' 
                        : 'border-slate-100 bg-slate-50 hover:bg-white hover:border-slate-200 hover:shadow-sm'
                    }`}
                  >
                    <div className={`font-bold ${activeSet?._id === s._id ? 'text-emerald-900' : 'text-slate-700 group-hover:text-emerald-800'}`}>{s.title}</div>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="text-xs font-bold tracking-widest uppercase text-slate-400">{s.topic || 'General'}</div>
                      <button 
                        onClick={(e) => deleteSet(s._id, e)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md text-slate-400 hover:bg-rose-100 hover:text-rose-700 transition-all shadow-sm bg-white"
                        aria-label={t('delete_set')}
                        title={t('delete_set')}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    </div>
                  </button>
                ))
              )}
            </div>
          </Card>
        </div>

        <div className="lg:col-span-3">
          <Card>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-emerald-900">{t('generate_new_set')}</h3>
            </div>
            <div className="grid gap-5">
              <div className="grid sm:grid-cols-2 gap-4">
                <TextInput label={t('set_title')} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Biology: Cells" />
                <TextInput label={t('topic_optional')} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Photosynthesis" />
              </div>
              <label className="block">
                <div className="mb-1.5 text-xs font-bold tracking-widest text-slate-500 uppercase">{t('paste_text')}</div>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={5}
                  className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-slate-800 outline-none placeholder:text-slate-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10 transition-all font-medium resize-y"
                  placeholder="Paste a paragraph from your notes to auto-generate flashcards…"
                />
              </label>
              <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                <PrimaryButton onClick={generate} disabled={busy || text.trim().length < 20}>
                  {busy ? t('generating') : t('generate_magic')}
                </PrimaryButton>
                
                <div className="flex items-center gap-4">
                  {generated.length > 0 && <div className="text-sm font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-md">{generated.length} {t('cards_ready')}</div>}
                  <button
                    onClick={saveSet}
                    disabled={busy || generated.length === 0}
                    className="rounded-full border-2 border-slate-200 px-6 py-3 text-xs font-bold tracking-widest text-slate-600 hover:bg-slate-50 hover:text-emerald-800 hover:border-emerald-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {t('save_set_btn')}
                  </button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Flashcard Set Modal Overlay */}
      {activeSet && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 sm:p-8 opacity-100 transition-opacity">
          <div className="bg-slate-50 w-full max-w-6xl max-h-full rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-8 py-6 border-b border-slate-200 bg-white">
              <div>
                <h2 className="text-3xl font-bold text-emerald-900 tracking-tight">{activeSet.title}</h2>
                <div className="mt-2 flex items-center gap-3 text-xs font-bold tracking-widest text-slate-400 uppercase">
                  <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-md">{activeSet.cards.length} {t('cards_count')}</span>
                  {activeSet.topic && <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-md">{activeSet.topic}</span>}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button 
                  onClick={(e) => deleteSet(activeSet._id, e)}
                  className="rounded-full border-2 border-rose-100 bg-white px-5 py-2.5 text-xs font-bold tracking-widest text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition-colors uppercase flex items-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                  {t('delete_set')}
                </button>
                <div className="w-px h-8 bg-slate-200 hidden sm:block mx-1"></div>
                <button 
                  onClick={() => setActiveSet(null)}
                  className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-emerald-100 hover:text-emerald-800 transition-colors"
                  aria-label="Close modal"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            {/* Modal Body (Scrollable) */}
            <div className="p-8 overflow-y-auto w-full max-h-[calc(100vh-160px)] custom-scrollbar">
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 pb-8">
                {activeSet.cards.map((c) => (
                  <FlipCard key={c._id} front={c.front} back={c.back} t={t} />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

