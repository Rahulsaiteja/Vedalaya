import { useState, useRef, useCallback, useEffect } from 'react'
import Webcam from 'react-webcam'
import { api } from '../utils/api.js'
import { useAuth } from '../state/AuthContext.jsx'
import { useLanguage } from '../state/LanguageContext.jsx'
import { TeacherClassesPage as ManageClassesTab } from './TeacherClassesPage.jsx'

// ── small helpers ─────────────────────────────────────────────────────
function fmtDate(d) {
  return new Date(d).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}
function fmtTime(d) {
  return new Date(d).toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit',
  })
}

// ── Tab button ────────────────────────────────────────────────────────
function Tab({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-5 py-2.5 rounded-full text-xs font-bold tracking-widest uppercase transition-all ${
        active
          ? 'bg-emerald-700 text-white shadow-lg shadow-emerald-900/30'
          : 'text-slate-400 hover:text-emerald-300 hover:bg-slate-700/50'
      }`}
    >
      {children}
    </button>
  )
}

// ── Stat card ─────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color = 'emerald' }) {
  const colors = {
    emerald: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/30 text-emerald-300',
    blue:    'from-blue-500/20 to-blue-600/10 border-blue-500/30 text-blue-300',
    rose:    'from-rose-500/20 to-rose-600/10 border-rose-500/30 text-rose-300',
    amber:   'from-amber-500/20 to-amber-600/10 border-amber-500/30 text-amber-300',
  }
  return (
    <div className={`rounded-2xl border bg-gradient-to-br p-5 ${colors[color]}`}>
      <div className="text-3xl font-black">{value}</div>
      <div className="text-xs font-bold tracking-widest uppercase mt-1 opacity-80">{label}</div>
      {sub && <div className="text-xs opacity-60 mt-0.5">{sub}</div>}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════
// MARK ATTENDANCE TAB
// ═════════════════════════════════════════════════════════════════════
function MarkAttendanceTab() {
  const webcamRef  = useRef(null)
  const [loading, setLoading]  = useState(false)
  const [result,  setResult]   = useState(null)
  const [error,   setError]    = useState(null)
  const [stats,   setStats]    = useState(null)
  const [classes, setClasses]  = useState([])
  const [selectedClass, setSelectedClass] = useState('')
  const { user } = useAuth()
  const { t } = useLanguage()
  const isTeacher = user?.role === 'teacher'

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await api.get('/attendance/my/stats')
        setStats(res.data)
      } catch { /* ignore */ }
    }
    fetchStats()
  }, [result])

  useEffect(() => {
    if (!isTeacher) return
    api.get('/classes')
      .then(r => setClasses(r.data.classes || []))
      .catch(() => {})
  }, [isTeacher])

  const capture = useCallback(async () => {
    if (isTeacher && !selectedClass) {
      setError('Please select a class section before marking attendance.')
      return
    }
    try {
      setLoading(true); setError(null); setResult(null)
      const imageSrc = webcamRef.current?.getScreenshot()
      if (!imageSrc) throw new Error('Could not capture from webcam.')

      const blob = await (await fetch(imageSrc)).blob()
      const formData = new FormData()
      formData.append('image', blob, 'webcam.jpg')
      if (selectedClass) formData.append('classGroupId', selectedClass)

      const res = await api.post('/attendance/mark', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setResult(res.data)
    } catch (err) {
      setError(err?.response?.data?.error || err.message)
    } finally {
      setLoading(false)
    }
  }, [selectedClass, isTeacher])

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Stats row for student */}
      {stats && !isTeacher && (
        <div className="w-full grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label={t('total_days')}    value={stats.total}      color="blue" />
          <StatCard label={t('present')}       value={stats.present}    color="emerald" />
          <StatCard label={t('absent')}        value={stats.absent}     color="rose" />
          <StatCard label={t('attendance_pct')}  value={`${stats.percentage}%`} color="amber" />
        </div>
      )}

      {/* Class selector for teacher */}
      {isTeacher && (
        <div className="w-full max-w-2xl">
          <label className="block text-xs font-bold tracking-widest uppercase text-slate-400 mb-2">
            {t('select_class')} *
          </label>
          <select
            id="mark-attendance-class-select"
            value={selectedClass}
            onChange={e => setSelectedClass(e.target.value)}
            className="w-full rounded-xl bg-slate-700 border border-slate-600 text-slate-100 px-4 py-3 outline-none focus:border-emerald-500 transition-colors"
          >
            <option value="">{t('choose_class')}</option>
            {classes.map(c => (
              <option key={c._id} value={c._id}>
                {c.name}{c.section ? ` · ${c.section}` : ''} ({c.students?.length || 0} students)
              </option>
            ))}
          </select>
          {classes.length === 0 && (
            <p className="text-xs text-slate-400 mt-2">{t('no_classes')} <a href="/teacher/classes" className="text-emerald-400 underline">Create a class first.</a></p>
          )}
        </div>
      )}

      {/* Webcam */}
      <div className="relative rounded-2xl overflow-hidden border-2 border-slate-700 shadow-2xl shadow-black/40 w-full max-w-2xl">
        <Webcam
          ref={webcamRef}
          audio={false}
          screenshotFormat="image/jpeg"
          videoConstraints={{ width: 720, height: 480, facingMode: 'user' }}
          className="w-full rounded-2xl"
        />
        {/* Scanning overlay ring */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className={`w-48 h-48 rounded-full border-4 ${loading ? 'border-emerald-400 animate-pulse' : 'border-white/20'} transition-all`} />
        </div>
        {loading && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <div className="text-emerald-400 font-bold text-sm animate-pulse tracking-widest uppercase">
              {t('scanning')}
            </div>
          </div>
        )}
      </div>

      <p className="text-slate-400 text-sm text-center max-w-md">
        {t('look_at_camera')}
      </p>

      <button
        id="capture-attendance-btn"
        onClick={capture}
        disabled={loading}
        className="relative px-10 py-3.5 rounded-full bg-emerald-600 hover:bg-emerald-500 active:scale-95 disabled:opacity-50 text-white font-bold tracking-wide shadow-lg shadow-emerald-900/40 transition-all"
      >
        {loading ? t('processing') : `📸 ${t('capture_btn')}`}
      </button>

      {error && (
        <div className="w-full max-w-2xl p-4 rounded-xl bg-rose-900/30 border border-rose-500/40 text-rose-300 text-sm">
          <strong>Error:</strong> {error}
        </div>
      )}

      {result && (
        <div className="w-full max-w-2xl animate-fade-in">
          <div className={`rounded-2xl border p-6 flex flex-col items-center gap-3 ${
            result.alreadyMarked
              ? 'bg-amber-900/20 border-amber-500/30 text-amber-200'
              : 'bg-emerald-900/20 border-emerald-500/30 text-emerald-200'
          }`}>
            <div className="text-4xl">{result.alreadyMarked ? '⚠️' : '✅'}</div>
            <h3 className="text-xl font-bold">{result.message}</h3>
            <div className="flex gap-6 text-sm bg-black/20 px-6 py-2 rounded-full">
              <span>Student: <strong className="text-white">{result.user?.name}</strong></span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════
// REGISTER STUDENT TAB (teacher only)
// ═════════════════════════════════════════════════════════════════════
const CAPTURE_COUNT = 100

function RegisterStudentTab() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const webcamRef       = useRef(null)
  const [students, setStudents] = useState([])
  const [selected, setSelected] = useState('')
  const [customName, setCustomName] = useState('')
  const [captured,  setCaptured]    = useState([])
  const [capturing, setCapturing]   = useState(false)
  const [uploading, setUploading]   = useState(false)
  const [result,    setResult]      = useState(null)
  const [error,     setError]       = useState(null)
  const [mlStatus,  setMlStatus]    = useState(null)
  const intervalRef = useRef(null)

  useEffect(() => {
    Promise.all([
      api.get('/attendance/students'),
      api.get('/attendance/ml-status')
    ])
      .then(([stuRes, mlRes]) => {
        setStudents(stuRes.data.students || [])
        setMlStatus(mlRes.data || null)
      })
      .catch(() => {})
  }, [])

  const nameToUse = selected === '__custom__'
    ? customName.trim()
    : students.find(s => s._id === selected)?.name || ''

  function startCapture() {
    if (!nameToUse) { setError('Select a student first.'); return }
    setError(null); setResult(null); setCaptured([])
    setCapturing(true)

    intervalRef.current = setInterval(() => {
      const shot = webcamRef.current?.getScreenshot()
      if (shot) {
        setCaptured(prev => {
          const next = [...prev, shot]
          if (next.length >= CAPTURE_COUNT) {
            clearInterval(intervalRef.current)
            setCapturing(false)
          }
          return next
        })
      }
    }, 200) // capture every 200ms → 30 frames ≈ 6 seconds
  }

  function stopCapture() {
    clearInterval(intervalRef.current)
    setCapturing(false)
  }

  const [uploadProgress, setUploadProgress] = useState(0)

  async function uploadFaces() {
    if (!nameToUse || captured.length === 0) return
    setUploading(true); setError(null); setResult(null); setUploadProgress(0)
    try {
      const BATCH_SIZE = 20
      let lastResult = null
      const totalBatches = Math.ceil(captured.length / BATCH_SIZE)

      for (let i = 0; i < captured.length; i += BATCH_SIZE) {
        const batch = captured.slice(i, i + BATCH_SIZE)
        const formData = new FormData()
        formData.append('name', nameToUse)
        if (user?.email) formData.append('teacherEmail', user.email)

        for (const b64 of batch) {
          const blob = await (await fetch(b64)).blob()
          formData.append('images', blob, 'frame.jpg')
        }

        const res = await api.post('/attendance/register-face', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 120_000,
        })
        if (res.status >= 400) throw new Error(res.data?.error || 'Upload failed')
        lastResult = res.data

        const batchNum = Math.floor(i / BATCH_SIZE) + 1
        setUploadProgress(Math.round((batchNum / totalBatches) * 100))
      }

      setResult(lastResult)
      setCaptured([])
      setUploadProgress(100)
    } catch (err) {
      setError(err?.response?.data?.error || err.message)
    } finally {
      setUploading(false)
    }
  }

  const progress = Math.min(captured.length / CAPTURE_COUNT * 100, 100)

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Student selector */}
      <div className="w-full max-w-2xl space-y-3">
        <label className="block text-xs font-bold tracking-widest uppercase text-slate-400">
          {t('select_student')}
        </label>
        <select
          id="register-student-select"
          value={selected}
          onChange={e => setSelected(e.target.value)}
          className="w-full rounded-xl bg-slate-700 border border-slate-600 text-slate-100 px-4 py-3 outline-none focus:border-emerald-500 transition-colors"
        >
          <option value="">{t('choose_student')}</option>
          {students.map(s => (
            <option key={s._id} value={s._id}>{s.name} ({s.email})</option>
          ))}
          <option value="__custom__">+ Enter name manually</option>
        </select>

        {selected === '__custom__' && (
          <input
            id="register-custom-name"
            type="text"
            value={customName}
            onChange={e => setCustomName(e.target.value)}
            placeholder="Student's full name (must match dataset folder)"
            className="w-full rounded-xl bg-slate-700 border border-slate-600 text-slate-100 px-4 py-3 outline-none focus:border-emerald-500 transition-colors"
          />
        )}
      </div>

      {/* Webcam */}
      <div className="relative rounded-2xl overflow-hidden border-2 border-slate-700 shadow-2xl w-full max-w-2xl">
        <Webcam
          ref={webcamRef}
          audio={false}
          screenshotFormat="image/jpeg"
          videoConstraints={{ width: 720, height: 480, facingMode: 'user' }}
          className="w-full rounded-2xl"
        />
        {capturing && (
          <div className="absolute top-4 left-4 bg-black/60 text-emerald-400 text-xs font-bold px-3 py-1 rounded-full animate-pulse">
            ● Recording {captured.length}/{CAPTURE_COUNT}
          </div>
        )}
      </div>

      {/* Progress bar */}
      {(captured.length > 0) && (
        <div className="w-full max-w-2xl">
          <div className="flex justify-between text-xs text-slate-400 mb-1">
            <span>Frames captured</span>
            <span>{captured.length} / {CAPTURE_COUNT}</span>
          </div>
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {error && (
        <div className="w-full max-w-2xl p-4 rounded-xl bg-rose-900/30 border border-rose-500/40 text-rose-300 text-sm">
          {error}
        </div>
      )}

      {result && (
        <div className="w-full max-w-2xl p-5 rounded-2xl bg-emerald-900/20 border border-emerald-500/30 text-emerald-200">
          <div className="font-bold text-lg">✅ Registration successful!</div>
          <div className="text-sm mt-2 opacity-80">
            Saved <strong>{result.saved}</strong> face images for <strong>{result.name}</strong>.
            Total in dataset: <strong>{result.total_in_folder}</strong> images.
          </div>
          {result.total_in_folder < 50 && (
            <div className="mt-2 text-amber-300 text-xs">
              ⚠️ Recommend at least 50 images for good accuracy. Re-register to add more.
            </div>
          )}
          {result.is_training && (
            <div className="mt-2 text-emerald-300 text-xs animate-pulse">
              🚀 Model is automatically retraining in the background with the new data...
            </div>
          )}
          {!result.is_training && result.total_in_folder >= 50 && (
            <div className="mt-2 text-emerald-300 text-xs">
              Ready for recognition! The model has already been trained with this student.
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3">
        {!capturing ? (
          <button
            id="start-capture-btn"
            onClick={startCapture}
            disabled={!nameToUse || uploading}
            className="px-8 py-3 rounded-full bg-emerald-600 hover:bg-emerald-500 active:scale-95 disabled:opacity-40 text-white font-bold tracking-wide shadow-lg transition-all"
          >
            🎥 {t('start_capture')} ({CAPTURE_COUNT} frames)
          </button>
        ) : (
          <button
            onClick={stopCapture}
            className="px-8 py-3 rounded-full bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-bold tracking-wide shadow-lg transition-all"
          >
            ⏹ {t('stop')}
          </button>
        )}

        {captured.length > 0 && !capturing && (
          <button
            id="upload-faces-btn"
            onClick={uploadFaces}
            disabled={uploading}
            className="px-8 py-3 rounded-full bg-blue-600 hover:bg-blue-500 active:scale-95 disabled:opacity-40 text-white font-bold tracking-wide shadow-lg transition-all"
          >
            {uploading ? 'Uploading…' : `☁️ ${t('upload_frames')} (${captured.length})`}
          </button>
        )}
      </div>

      <p className="text-slate-500 text-xs text-center max-w-md">
        Ask the student to face the camera with different angles and expressions during the 6-second capture.
      </p>

      {/* Registration Status Table */}
      {mlStatus && (
        <div className="w-full max-w-2xl mt-8 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-lg font-bold text-slate-100">Student Registration Status</h3>
              <p className="text-xs text-slate-400">See who is ready for face recognition login.</p>
            </div>
            {mlStatus.is_training ? (
              <span className="flex items-center gap-2 text-xs font-bold text-amber-400 bg-amber-900/30 px-3 py-1.5 rounded-full border border-amber-700/30 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                Model is training...
              </span>
            ) : (
              <span className="flex items-center gap-2 text-xs font-bold text-emerald-400 bg-emerald-900/30 px-3 py-1.5 rounded-full border border-emerald-700/30">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                Model Ready
              </span>
            )}
          </div>
          
          <div className="rounded-2xl border border-slate-700 overflow-hidden bg-slate-800/50 shadow-lg">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-800 border-b border-slate-700 text-slate-400 text-xs tracking-widest uppercase">
                <tr>
                  <th className="px-5 py-3.5 font-semibold">Student</th>
                  <th className="px-5 py-3.5 font-semibold">Face Model Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {students.map((s, i) => {
                  const isTrained = mlStatus.trained_classes?.includes(s.name)
                  const isCollected = mlStatus.classes?.includes(s.name)
                  
                  return (
                    <tr key={s._id} className="hover:bg-slate-700/30 transition-colors group">
                      <td className="px-5 py-3">
                        <div className="font-semibold text-slate-200 group-hover:text-emerald-300 transition-colors">{s.name}</div>
                        <div className="text-xs text-slate-500">{s.email}</div>
                      </td>
                      <td className="px-5 py-3">
                        {isTrained ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-900/40 text-emerald-400 border border-emerald-700/50">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                            Trained
                          </span>
                        ) : isCollected ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-900/40 text-amber-400 border border-amber-700/50">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                            Data Collected
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-900/40 text-rose-400 border border-rose-700/50">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                            Not Registered
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {students.length === 0 && (
                  <tr>
                    <td colSpan="2" className="px-5 py-8 text-center text-slate-500 font-medium">
                      No students found in the database.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════
// RECORDS TAB
// ═════════════════════════════════════════════════════════════════════
function RecordsTab({ isTeacher }) {
  const { t } = useLanguage()
  const [records,  setRecords]  = useState([])
  const [students, setStudents] = useState([])
  const [classes,  setClasses]  = useState([])
  const [filter,   setFilter]   = useState({ studentId: '', classGroupId: '', from: '', to: '' })
  const [loading,  setLoading]  = useState(false)
  const [search,   setSearch]   = useState('')
  const [stats,    setStats]    = useState([])

  // ── Mark Absent modal state ──────────────────────────────────────
  const [showAbsentModal, setShowAbsentModal] = useState(false)
  const [absentForm, setAbsentForm] = useState({ studentId: '', date: new Date().toISOString().slice(0, 10), classGroupId: '' })
  const [absentLoading, setAbsentLoading] = useState(false)
  const [absentMsg, setAbsentMsg] = useState(null)
  const [absentErr, setAbsentErr] = useState(null)

  async function load() {
    setLoading(true)
    try {
      if (isTeacher) {
        const params = {}
        if (filter.studentId)   params.studentId   = filter.studentId
        if (filter.classGroupId) params.classGroupId = filter.classGroupId
        if (filter.from)        params.from        = filter.from
        if (filter.to)          params.to          = filter.to

        const [recRes, statRes, stuRes, clsRes] = await Promise.all([
          api.get('/attendance/records', { params }),
          api.get('/attendance/stats', { params: filter.classGroupId ? { classGroupId: filter.classGroupId } : {} }),
          api.get('/attendance/students'),
          api.get('/classes'),
        ])
        setRecords(recRes.data.records || [])
        setStats(statRes.data.stats || [])
        setStudents(stuRes.data.students || [])
        setClasses(clsRes.data.classes || [])
      } else {
        const res = await api.get('/attendance/my')
        setRecords(res.data.records || [])
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  // ── Submit manual absent ─────────────────────────────────────────
  async function submitMarkAbsent() {
    if (!absentForm.studentId) { setAbsentErr('Please select a student.'); return }
    setAbsentLoading(true); setAbsentErr(null); setAbsentMsg(null)
    try {
      const res = await api.post('/attendance/mark-absent', {
        studentId: absentForm.studentId,
        date: absentForm.date,
        classGroupId: absentForm.classGroupId || undefined,
      })
      setAbsentMsg(res.data.message)
      load() // refresh records
    } catch (err) {
      setAbsentErr(err?.response?.data?.error || err.message)
    } finally {
      setAbsentLoading(false)
    }
  }

  const filtered = records.filter(r => {
    const name = (r.user?.name || '').toLowerCase()
    return name.includes(search.toLowerCase())
  })

  return (
    <div className="space-y-6">
      {/* Teacher stats grid */}
      {isTeacher && stats.length > 0 && (        <div>
          <h3 className="text-xs font-bold tracking-widest uppercase text-slate-400 mb-3">
            {t('student_summary')}
          </h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {stats.map(s => (
              <div
                key={s.student._id}
                className="rounded-xl bg-slate-800 border border-slate-700 p-4 flex items-center gap-4"
              >
                <div className="w-10 h-10 rounded-full bg-emerald-700/30 flex items-center justify-center text-emerald-400 font-bold text-sm shrink-0">
                  {s.student.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-slate-100 text-sm truncate">{s.student.name}</div>
                  <div className="text-xs text-slate-400">{s.present}/{s.total} days &nbsp;·&nbsp;
                    <span className={s.percentage >= 75 ? 'text-emerald-400' : 'text-rose-400'}>
                      {s.percentage}%
                    </span>
                  </div>
                  {/* mini progress bar */}
                  <div className="mt-1.5 h-1 bg-slate-700 rounded-full overflow-hidden w-full">
                    <div
                      className={`h-full rounded-full ${s.percentage >= 75 ? 'bg-emerald-500' : 'bg-rose-500'}`}
                      style={{ width: `${s.percentage}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters (teacher only) */}
      {isTeacher && (
        <>
          {/* Mark Absent button */}
          <div className="flex justify-end">
            <button
              onClick={() => { setShowAbsentModal(true); setAbsentMsg(null); setAbsentErr(null) }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-700 hover:bg-rose-600 active:scale-95 text-white text-sm font-bold tracking-wide shadow-lg transition-all"
            >
              🚫 Mark Student Absent
            </button>
          </div>

          {/* Mark Absent Modal */}
          {showAbsentModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-white">Mark Student Absent</h3>
                  <button onClick={() => setShowAbsentModal(false)} className="text-slate-400 hover:text-white text-xl leading-none">✕</button>
                </div>

                {/* Student selector */}
                <div>
                  <label className="block text-xs font-bold tracking-widest uppercase text-slate-400 mb-1.5">Student *</label>
                  <select
                    value={absentForm.studentId}
                    onChange={e => setAbsentForm(f => ({ ...f, studentId: e.target.value }))}
                    className="w-full rounded-xl bg-slate-700 border border-slate-600 text-slate-100 px-4 py-2.5 outline-none focus:border-rose-500 transition-colors text-sm"
                  >
                    <option value="">Select a student…</option>
                    {students.map(s => (
                      <option key={s._id} value={s._id}>{s.name} ({s.email})</option>
                    ))}
                  </select>
                </div>

                {/* Date picker */}
                <div>
                  <label className="block text-xs font-bold tracking-widest uppercase text-slate-400 mb-1.5">Date *</label>
                  <input
                    type="date"
                    value={absentForm.date}
                    max={new Date().toISOString().slice(0, 10)}
                    onChange={e => setAbsentForm(f => ({ ...f, date: e.target.value }))}
                    className="w-full rounded-xl bg-slate-700 border border-slate-600 text-slate-100 px-4 py-2.5 outline-none focus:border-rose-500 transition-colors text-sm"
                  />
                </div>

                {/* Class selector (optional) */}
                <div>
                  <label className="block text-xs font-bold tracking-widest uppercase text-slate-400 mb-1.5">Class Section <span className="normal-case font-normal">(optional)</span></label>
                  <select
                    value={absentForm.classGroupId}
                    onChange={e => setAbsentForm(f => ({ ...f, classGroupId: e.target.value }))}
                    className="w-full rounded-xl bg-slate-700 border border-slate-600 text-slate-100 px-4 py-2.5 outline-none focus:border-rose-500 transition-colors text-sm"
                  >
                    <option value="">No specific class</option>
                    {classes.map(c => (
                      <option key={c._id} value={c._id}>{c.name}{c.section ? ` · ${c.section}` : ''}</option>
                    ))}
                  </select>
                </div>

                {absentErr && (
                  <div className="p-3 rounded-xl bg-rose-900/30 border border-rose-500/40 text-rose-300 text-sm">{absentErr}</div>
                )}
                {absentMsg && (
                  <div className="p-3 rounded-xl bg-emerald-900/30 border border-emerald-500/40 text-emerald-300 text-sm">✅ {absentMsg}</div>
                )}

                <div className="flex gap-3 pt-1">
                  <button
                    onClick={submitMarkAbsent}
                    disabled={absentLoading}
                    className="flex-1 py-2.5 rounded-xl bg-rose-700 hover:bg-rose-600 disabled:opacity-50 text-white font-bold text-sm tracking-wide transition-all"
                  >
                    {absentLoading ? 'Saving…' : 'Confirm Absent'}
                  </button>
                  <button
                    onClick={() => setShowAbsentModal(false)}
                    className="flex-1 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold text-sm tracking-wide transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Filters (teacher only) */}
      {isTeacher && (
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[160px]">
            <label className="text-xs text-slate-400 uppercase tracking-widest font-bold block mb-1">Class Section</label>
            <select
              value={filter.classGroupId}
              onChange={e => setFilter(f => ({ ...f, classGroupId: e.target.value }))}
              className="w-full rounded-xl bg-slate-700 border border-slate-600 text-slate-100 px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
            >
              <option value="">All Classes</option>
              {classes.map(c => <option key={c._id} value={c._id}>{c.name}{c.section ? ` · ${c.section}` : ''}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="text-xs text-slate-400 uppercase tracking-widest font-bold block mb-1">Student</label>
            <select
              value={filter.studentId}
              onChange={e => setFilter(f => ({ ...f, studentId: e.target.value }))}
              className="w-full rounded-xl bg-slate-700 border border-slate-600 text-slate-100 px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
            >
              <option value="">All Students</option>
              {students.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400 uppercase tracking-widest font-bold block mb-1">From</label>
            <input
              type="date"
              value={filter.from}
              onChange={e => setFilter(f => ({ ...f, from: e.target.value }))}
              className="rounded-xl bg-slate-700 border border-slate-600 text-slate-100 px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 uppercase tracking-widest font-bold block mb-1">To</label>
            <input
              type="date"
              value={filter.to}
              onChange={e => setFilter(f => ({ ...f, to: e.target.value }))}
              className="rounded-xl bg-slate-700 border border-slate-600 text-slate-100 px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
            />
          </div>
          <button
            onClick={load}
            className="px-6 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-bold tracking-wide transition-colors"
          >
            Apply
          </button>
        </div>
      )}

      {/* Search bar */}
      {isTeacher && (
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name…"
          className="w-full rounded-xl bg-slate-700 border border-slate-600 text-slate-100 px-4 py-3 outline-none focus:border-emerald-500 text-sm"
        />
      )}

      {/* Records table */}
      <div className="rounded-2xl overflow-hidden border border-slate-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-800 text-slate-400 text-xs uppercase tracking-widest">
              {isTeacher && <th className="text-left px-4 py-3">Student</th>}
              {isTeacher && <th className="text-left px-4 py-3">Class</th>}
              <th className="text-left px-4 py-3">Date &amp; Time</th>
              <th className="text-left px-4 py-3">Status</th>
              {isTeacher && <th className="text-left px-4 py-3">Action</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={isTeacher ? 5 : 2} className="px-4 py-8 text-center text-slate-500 animate-pulse">
                  {t('loading_records')}
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={isTeacher ? 5 : 2} className="px-4 py-8 text-center text-slate-500">
                  {t('no_records')}
                </td>
              </tr>
            ) : (
              filtered.map((r, i) => (
                <tr
                  key={r._id}
                  className={`border-t border-slate-700/50 transition-colors hover:bg-slate-700/20 ${
                    i % 2 === 0 ? 'bg-slate-800/30' : 'bg-slate-800/10'
                  }`}
                >
                  {isTeacher && (
                    <td className="px-4 py-3 font-medium text-slate-200">
                      {r.user?.name || '—'}
                      <div className="text-xs text-slate-500">{r.user?.email}</div>
                    </td>
                  )}
                  {isTeacher && (
                    <td className="px-4 py-3 text-slate-300 text-xs">
                      {r.classGroup ? (
                        <span className="bg-emerald-900/30 text-emerald-400 border border-emerald-700/30 px-2 py-1 rounded-lg">
                          {r.classGroup.name}{r.classGroup.section ? ` · ${r.classGroup.section}` : ''}
                        </span>
                      ) : '—'}
                    </td>
                  )}
                  <td className="px-4 py-3 text-slate-300">
                    <div className="font-medium">{fmtDate(r.date)}</div>
                    <div className="text-xs text-slate-400 mt-0.5">🕐 {fmtTime(r.date)}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                      r.status === 'Present'
                        ? 'bg-emerald-900/50 text-emerald-400 border border-emerald-600/30'
                        : 'bg-rose-900/50 text-rose-400 border border-rose-600/30'
                    }`}>
                      {r.status}
                    </span>
                  </td>
                  {isTeacher && (
                    <td className="px-4 py-3">
                      {r.status === 'Present' ? (
                        <button
                          onClick={async () => {
                            if (!window.confirm(`Mark ${r.user?.name} as Absent on ${fmtDate(r.date)}?`)) return
                            try {
                              await api.post('/attendance/mark-absent', {
                                studentId: r.user?._id,
                                date: new Date(r.date).toISOString().slice(0, 10),
                                classGroupId: r.classGroup?._id,
                              })
                              load()
                            } catch (err) {
                              alert(err?.response?.data?.error || 'Failed to mark absent')
                            }
                          }}
                          className="px-3 py-1 rounded-lg bg-rose-900/40 hover:bg-rose-700/60 text-rose-400 hover:text-rose-200 text-xs font-bold border border-rose-700/40 transition-all"
                        >
                          Mark Absent
                        </button>
                      ) : (
                        <span className="text-xs text-slate-600">—</span>
                      )}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>Showing {filtered.length} record{filtered.length !== 1 ? 's' : ''}</span>
        {isTeacher && <button onClick={load} className="text-emerald-400 hover:text-emerald-300 font-bold transition-colors">↻ Refresh</button>}
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═════════════════════════════════════════════════════════════════════
export function AttendancePage() {
  const { user } = useAuth()
  const isTeacher = user?.role === 'teacher'
  const [tab, setTab] = useState(isTeacher ? 'records' : 'mark')

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-6 md:p-10 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black text-white tracking-tight">
          Attendance System
        </h1>
        <p className="text-slate-400 mt-1 text-sm">
          {isTeacher
            ? 'Register students and manage attendance records.'
            : 'Mark your attendance and view your history.'}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 bg-slate-800/60 p-1.5 rounded-2xl w-fit border border-slate-700">
        {!isTeacher && (
          <Tab active={tab === 'mark'} onClick={() => setTab('mark')}>
            📸 Mark Attendance
          </Tab>
        )}
        {isTeacher && (
          <Tab active={tab === 'register'} onClick={() => setTab('register')}>
            👤 Register Student
          </Tab>
        )}
        <Tab active={tab === 'records'} onClick={() => setTab('records')}>
          📋 Records
        </Tab>
        {isTeacher && (
          <Tab active={tab === 'classes'} onClick={() => setTab('classes')}>
            🏫 Manage Classes
          </Tab>
        )}
      </div>

      {/* Tab content */}
      <div className="bg-slate-800/40 border border-slate-700 rounded-3xl p-6 md:p-8 backdrop-blur-sm">
        {tab === 'mark'     && !isTeacher && <MarkAttendanceTab />}
        {tab === 'register' && isTeacher && <RegisterStudentTab />}
        {tab === 'records'  && <RecordsTab isTeacher={isTeacher} />}
        {tab === 'classes'  && isTeacher && <ManageClassesTab />}
      </div>
    </div>
  )
}
