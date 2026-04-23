import { useEffect, useState, useMemo } from 'react'
import { api } from '../utils/api.js'
import { useLanguage } from '../state/LanguageContext.jsx'
import CachedVideoPlayer from '../components/CachedVideoPlayer.jsx'

export function StudentLecturesPage() {
  const [lectures, setLectures] = useState([])
  const [error, setError] = useState(null)
  const [activeVideo, setActiveVideo] = useState(null)
  const { t } = useLanguage()
  const [activeCategory, setActiveCategory] = useState('All')

  const allVideoLectures = lectures.filter((l) => l.mediaType === 'video')
  const audioLectures = lectures.filter((l) => l.mediaType === 'audio')
  const otherLectures = lectures.filter((l) => !['video', 'audio'].includes(l.mediaType))

  const videoCategories = useMemo(() => {
    const cats = new Set(allVideoLectures.map(l => l.category && l.category !== 'General' ? l.category : 'General'))
    return Array.from(cats).sort()
  }, [allVideoLectures])

  const videoLectures = activeCategory === 'All' 
    ? allVideoLectures 
    : allVideoLectures.filter(l => (l.category || 'General') === activeCategory)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setError(null)
      const res = await api.get('/lectures')
      if (!cancelled) setLectures(res.data.lectures || [])
    }
    load().catch((err) => {
      if (!cancelled) setError(err?.response?.data?.error?.message || 'Failed to load lectures')
    })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="w-full pb-12">
      {/* Optional Top Category Pills (like YouTube) */}
      <div className="flex gap-3 overflow-x-auto pb-4 mb-4 scrollbar-hide">
        <button onClick={() => setActiveCategory('All')} className={`shrink-0 whitespace-nowrap rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors ${activeCategory === 'All' ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900'}`}>{t('all')}</button>
        {videoCategories.map(c => (
          <button key={c} onClick={() => setActiveCategory(c)} className={`shrink-0 whitespace-nowrap rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors ${activeCategory === c ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900'}`}>{c}</button>
        ))}
      </div>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 mb-8 text-sm text-rose-700 font-medium">{error}</div>}

      {/* Main Video Grid */}
      <div className="mb-12">
        <h2 className="text-xl font-bold text-slate-900 mb-6">{t('lectures')}</h2>
        
        {videoLectures.length === 0 ? (
          <div className="text-center py-12 text-slate-500 font-medium bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
            {t('no_videos_available')}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-y-10 gap-x-4">
            {videoLectures.map((l) => (
              <div 
                key={l._id} 
                className="group flex flex-col gap-3 cursor-pointer"
                onClick={() => setActiveVideo(l)}
              >
                {/* Thumbnail */}
                <div className="relative w-full aspect-video bg-slate-200 rounded-xl overflow-hidden shadow-sm ring-1 ring-slate-900/5 transition-all group-hover:rounded-none sm:group-hover:rounded-xl">
                  {/* Subtle placeholder gradient */}
                  <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900 opacity-95 group-hover:scale-105 transition-transform duration-500"></div>
                  
                  {/* Play icon overlay */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-12 h-12 bg-black/60 backdrop-blur-md rounded-full flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                    </div>
                  </div>

                  {/* Badge */}
                  <div className="absolute top-2 left-2 bg-indigo-600/90 backdrop-blur-sm px-2 py-1 rounded text-[10px] font-bold text-white tracking-widest uppercase shadow-sm">
                    {l.category || 'General'}
                  </div>
                  <div className="absolute bottom-1.5 right-1.5 bg-black/80 px-1.5 py-0.5 rounded text-[10px] font-bold text-white tracking-wider">
                    {l.sourceType === 'youtube' ? 'YOUTUBE' : 'FILE'}
                  </div>
                </div>

                {/* Details */}
                <div className="flex gap-3 px-1 sm:px-0">
                  {/* Avatar */}
                  <div className="w-9 h-9 shrink-0 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold text-xs shadow-sm">
                    {l.title.substring(0,2).toUpperCase()}
                  </div>
                  
                  {/* Text blocks */}
                  <div className="flex flex-col min-w-0">
                    <h3 className="text-sm font-semibold text-slate-900 line-clamp-2 leading-tight group-hover:text-blue-600 transition-colors">
                      {l.title}
                    </h3>
                    <div className="text-[13px] text-slate-500 mt-1 line-clamp-1">
                      {l.description || t('teacher_name')}
                    </div>
                    <div className="text-[13px] text-slate-500 flex items-center gap-1">
                      <span>•</span>
                      <span>{new Date(l.createdAt || Date.now()).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Audio / Other Resources Section (Simplified list below videos) */}
      {(audioLectures.length > 0 || otherLectures.length > 0) && (
        <div className="border-t border-slate-200 pt-8">
          <h2 className="text-lg font-bold text-slate-900 mb-4">{t('additional_resources')}</h2>
          <div className="flex flex-col gap-2">
            {[...audioLectures, ...otherLectures].map(l => (
              <div key={l._id} className="flex items-center justify-between p-4 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-200">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold ${l.mediaType === 'audio' ? 'bg-amber-500' : 'bg-emerald-500'}`}>
                    {l.mediaType === 'audio' ? 'A' : 'F'}
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">{l.title}</h4>
                    <p className="text-xs text-slate-500">{l.mediaType === 'audio' ? t('audio_lecture_tag') : t('document_file_tag')}</p>
                  </div>
                </div>
                {l.sourceType === 'file' && (
                  <a href={`/api/lectures/${l._id}/download`} className="ml-4 shrink-0 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-sm font-semibold text-slate-700 rounded-full transition-colors">
                    {t('download')}
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Video Player Modal Overlay */}
      {activeVideo && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-4 md:p-8">
          <div 
            className="absolute inset-0 bg-black/90 cursor-pointer" 
            onClick={() => setActiveVideo(null)}
          ></div>
          <div className="relative w-full h-full sm:h-auto sm:max-h-[90vh] max-w-6xl sm:rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10 animate-in fade-in sm:zoom-in-95 duration-200 flex flex-col bg-black">
            
            {/* Close Button Top Right */}
            <div className="absolute top-4 right-4 z-20">
              <button 
                onClick={() => setActiveVideo(null)}
                className="rounded-full bg-black/50 p-2 text-white/70 hover:text-white hover:bg-rose-600 transition-colors backdrop-blur-sm"
                aria-label="Close video"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            
            {/* Smart Video Player Setup */}
            <div className="flex-1 min-h-[40vh] bg-black flex items-center justify-center p-0 sm:p-4 overflow-hidden">
              {activeVideo.sourceType === 'youtube' && activeVideo.youtubeVideoId ? (
                <iframe
                  className="max-w-full max-h-full shadow-2xl ring-1 ring-white/10 sm:rounded-xl"
                  style={{ aspectRatio: '16/9', width: '100%' }}
                  src={`https://www.youtube.com/embed/${activeVideo.youtubeVideoId}?autoplay=1`}
                  title={activeVideo.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              ) : activeVideo.file?.mimeType?.startsWith('video/') ? (
                <CachedVideoPlayer 
                  src={`/api/lectures/${activeVideo._id}/stream`} 
                  mimeType={activeVideo.file.mimeType} 
                  variants={activeVideo.variants}
                  processingStatus={activeVideo.processingStatus}
                />
              ) : (
                <div className="text-white/50 p-12 text-center">Video format not supported or file missing.</div>
              )}
            </div>
            
            {/* Video Meta Info */}
            <div className="flex-1 bg-[#0f0f0f] p-4 sm:p-6 sm:px-8 border-t border-white/5 overflow-y-auto min-h-0">
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight leading-snug pb-4">{activeVideo.title}</h1>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

