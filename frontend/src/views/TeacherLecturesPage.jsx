import { useEffect, useMemo, useState, useRef } from 'react'
import axios from 'axios'
import { api } from '../utils/api.js'
import { Card, PrimaryButton, TextInput } from '../ui/form.jsx'
import { useLanguage } from '../state/LanguageContext.jsx'

export function TeacherLecturesPage() {
  const [lectures, setLectures] = useState([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const { t } = useLanguage()
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const streamRef = useRef(null)
  const chunksRef = useRef([])
  const [isRecording, setIsRecording] = useState(false)
  const recordingSupported = typeof window !== 'undefined' && !!window.MediaRecorder

  async function load() {
    const res = await api.get('/lectures')
    setLectures(res.data.lectures || [])
  }

  useEffect(() => {
    load().catch(() => {})
  }, [])

  const canUpload = useMemo(() => title.trim() && (file || youtubeUrl.trim()), [title, file, youtubeUrl])

  const [uploadProgress, setUploadProgress] = useState(0)

  async function uploadLecture() {
    if (!canUpload) return
    setBusy(true)
    setError(null)
    setUploadProgress(0)
    try {
      let cloudinaryUrl = ''
      let cloudinaryPublicId = ''
      let originalName = ''
      let mimeType = ''
      let fileSize = 0

      if (file) {
        // Step 1: get signed upload params from backend
        const sigRes = await api.post('/lectures/sign-upload')
        const { signature, timestamp, folder, cloudName, apiKey } = sigRes.data

        // Step 2: upload directly to Cloudinary (bypasses Render timeout)
        const fd = new FormData()
        fd.append('file', file)
        fd.append('api_key', apiKey)
        fd.append('timestamp', timestamp)
        fd.append('signature', signature)
        fd.append('folder', folder)
        fd.append('resource_type', 'auto')

        const cloudRes = await axios.post(
          `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
          fd,
          {
            onUploadProgress: (e) => {
              if (e.total) setUploadProgress(Math.round((e.loaded / e.total) * 100))
            },
            timeout: 0, // no timeout for large files
          }
        )

        cloudinaryUrl = cloudRes.data.secure_url
        cloudinaryPublicId = cloudRes.data.public_id
        originalName = file.name
        mimeType = file.type
        fileSize = file.size
      }

      // Step 3: save lecture metadata to backend
      const body = new FormData()
      body.set('title', title)
      body.set('description', description)
      if (category.trim()) body.set('category', category.trim())
      if (youtubeUrl.trim()) body.set('youtubeUrl', youtubeUrl.trim())
      if (cloudinaryUrl) {
        body.set('cloudinaryUrl', cloudinaryUrl)
        body.set('cloudinaryPublicId', cloudinaryPublicId)
        body.set('originalName', originalName)
        body.set('mimeType', mimeType)
        body.set('fileSize', fileSize)
      }
      await api.post('/lectures', body)

      setTitle('')
      setDescription('')
      setCategory('')
      setYoutubeUrl('')
      setFile(null)
      setUploadProgress(0)
      await load()
    } catch (err) {
      console.error('Upload Error:', err)
      const msg = err?.response?.data?.error?.message || err?.message || 'Upload failed'
      setError(msg)
    } finally {
      setBusy(false)
    }
  }

  async function togglePublish(l) {
    setBusy(true)
    setError(null)
    try {
      if (l.status === 'published') await api.post(`/lectures/${l._id}/unpublish`)
      else await api.post(`/lectures/${l._id}/publish`)
      await load()
    } catch (err) {
      setError(err?.response?.data?.error?.message || 'Update failed')
    } finally {
      setBusy(false)
    }
  }

  async function removeLecture(l) {
    if (!confirm('Delete this lecture?')) return
    setBusy(true)
    setError(null)
    try {
      await api.delete(`/lectures/${l._id}`)
      await load()
    } catch (err) {
      setError(err?.response?.data?.error?.message || 'Delete failed')
    } finally {
      setBusy(false)
    }
  }

  async function startAudioRecording() {
    if (!recordingSupported) {
      setError('Audio recording is not supported in this browser.')
      return
    }
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const recorder = new MediaRecorder(stream)
      mediaRecorderRef.current = recorder
      chunksRef.current = []
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) chunksRef.current.push(event.data)
      }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        const ext = blob.type.includes('ogg') ? 'ogg' : blob.type.includes('mp4') ? 'm4a' : 'webm'
        const recordedFile = new File([blob], `voice-lecture-${Date.now()}.${ext}`, { type: blob.type })
        
        // Use handleFileSelection so the duration check applies to voice notes too
        handleFileSelection(recordedFile)
        
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop())
          streamRef.current = null
        }
      }
      recorder.start()
      setIsRecording(true)
    } catch {
      setError('Could not access microphone. Please allow mic permission and try again.')
    }
  }

  function stopAudioRecording() {
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop()
      }
    } finally {
      setIsRecording(false)
    }
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleFileSelection = (selectedFile) => {
    if (!selectedFile) {
      setFile(null)
      setError(null)
      return
    }
    
    if (selectedFile.type.startsWith('video/') || selectedFile.type.startsWith('audio/')) {
      const media = document.createElement(selectedFile.type.startsWith('video/') ? 'video' : 'audio')
      media.preload = 'metadata'
      media.onloadedmetadata = function() {
        window.URL.revokeObjectURL(media.src)
        const durationMin = media.duration / 60
        if (durationMin > 30) {
          setError(`Lectures cannot exceed 30 minutes. This file is ${durationMin.toFixed(1)} minutes.`)
          setFile(null)
        } else {
          setError(null)
          setFile(selectedFile)
        }
      }
      media.src = URL.createObjectURL(selectedFile)
    } else {
      setFile(selectedFile)
      setError(null)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelection(e.dataTransfer.files[0])
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-emerald-900 tracking-tight">{t('lectures')}</h2>
        <p className="mt-2 text-slate-500 font-medium">Upload lecture files, then publish them for students.</p>
      </div>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 font-medium">{error}</div>}

      <Card>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-emerald-900">{t('new_lecture')}</h3>
        </div>
        <div className="mt-4 grid gap-5">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-4 flex flex-col justify-center">
              <TextInput label={t('title')} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Lecture 1: Introduction" />
              <TextInput label="Category / Subject" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Mathematics" />
            </div>
            
            <div 
              className={`relative border-2 border-dashed rounded-xl p-4 transition-colors flex flex-col items-center justify-center cursor-pointer min-h-[100px] ${isDragging ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300 bg-slate-50 hover:bg-slate-100 hover:border-emerald-300'}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={(e) => handleFileSelection(e.target.files?.[0] || null)}
                className="hidden"
              />
              <div className="text-emerald-600 mb-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
              </div>
              <div className="text-sm font-bold text-slate-700 text-center">
                {file ? file.name : 'Click to browse or drag file here'}
              </div>
              <div className="text-xs text-slate-500 font-medium mt-1">
                {file ? `${(file.size / (1024 * 1024)).toFixed(2)} MB` : 'Max size: 1GB'}
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-bold text-slate-700">Audio lecture recording</div>
            <div className="mt-2 text-xs text-slate-500">
              Record your voice lecture directly, or upload an audio file (mp3/wav/m4a/webm).
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {!isRecording ? (
                <button
                  type="button"
                  onClick={startAudioRecording}
                  className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  Start Recording
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopAudioRecording}
                  className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-700"
                >
                  Stop Recording
                </button>
              )}
              {file && file.type?.startsWith('audio/') && (
                <audio controls className="max-w-full">
                  <source src={URL.createObjectURL(file)} type={file.type} />
                </audio>
              )}
            </div>
          </div>
          <TextInput
            label="YouTube URL (optional, for video lecture)"
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
          />
          <div className="text-xs text-slate-500 -mt-2">
            Paste a YouTube link to create a playable lecture video in the website. You can also upload a file instead.
          </div>
          <label className="block">
            <div className="mb-1.5 text-xs font-bold tracking-widest text-slate-500 uppercase">{t('description')}</div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-slate-800 outline-none placeholder:text-slate-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10 transition-all font-medium resize-y"
              placeholder="What this lecture covers…"
            />
          </label>
          <div className="flex items-center gap-4 pt-2">
            <PrimaryButton onClick={uploadLecture} disabled={!canUpload || busy}>
              {busy ? (file && uploadProgress < 100 ? `UPLOADING… ${uploadProgress}%` : 'SAVING…') : 'UPLOAD LECTURE'}
            </PrimaryButton>
            {busy && file && uploadProgress > 0 && uploadProgress < 100 && (
              <div className="flex-1 bg-slate-200 rounded-full h-2">
                <div
                  className="bg-emerald-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-emerald-900">Your uploads</h3>
        </div>
        <div className="space-y-4">
          {lectures.length === 0 ? (
            <div className="text-sm font-medium text-slate-400 p-4 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 text-center">No lectures uploaded yet.</div>
          ) : (
            lectures.map((l) => (
              <div key={l._id} className="rounded-2xl border-2 border-slate-100 bg-slate-50 p-6 flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
                <div className="flex-1 w-full md:w-auto">
                  <div className="flex flex-col gap-1 mb-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-widest uppercase ${l.category && l.category !== 'General' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>
                        {l.category || 'General'}
                      </span>
                    </div>
                    <div className="flex items-start justify-between gap-4">
                      <div className="font-bold text-lg text-slate-800">{l.title}</div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold tracking-widest uppercase shrink-0 ${
                          l.status === 'published' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-slate-200 text-slate-500 border border-slate-300'
                        }`}
                      >
                        {l.status}
                      </span>
                    </div>
                  </div>
                  <div className="text-sm font-medium text-slate-500 line-clamp-2 md:pr-12">{l.description || 'No description provided'}</div>
                  {l.sourceType === 'youtube' ? (
                    <div className="mt-3 inline-flex items-center gap-2 bg-red-50 px-3 py-1.5 rounded-lg border border-red-200 shadow-sm text-xs font-bold tracking-widest text-red-600">
                      YOUTUBE VIDEO
                    </div>
                  ) : l.mediaType === 'audio' ? (
                    <div className="mt-3 inline-flex items-center gap-2 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-200 shadow-sm text-xs font-bold tracking-widest text-indigo-700">
                      AUDIO LECTURE
                    </div>
                  ) : (
                    <div className="mt-3 inline-flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm text-xs font-bold tracking-widest text-slate-500">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                      {l.file?.originalName}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto shrink-0 md:pl-4 md:border-l border-slate-200">
                  {l.sourceType === 'file' ? (
                    <a
                      href={`/api/lectures/${l._id}/download`}
                      className="flex-1 md:flex-none text-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:text-emerald-700 hover:border-emerald-200 shadow-sm transition-colors"
                    >
                      Download
                    </a>
                  ) : (
                    <a
                      href={l.youtubeUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 md:flex-none text-center rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-100 transition-colors"
                    >
                      Open YouTube
                    </a>
                  )}
                  <button
                    onClick={() => togglePublish(l)}
                    disabled={busy}
                    className="flex-1 md:flex-none rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm font-bold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 transition-colors"
                  >
                    {l.status === 'published' ? 'Unpublish' : 'Publish'}
                  </button>
                  <button
                    onClick={() => removeLecture(l)}
                    disabled={busy}
                    className="flex-1 md:flex-none rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  )
}

