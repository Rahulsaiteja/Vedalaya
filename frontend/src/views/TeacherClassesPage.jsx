import { useEffect, useState } from 'react'
import { api } from '../utils/api.js'

// ── helpers ─────────────────────────────────────────────────────────────
function Badge({ children, color = 'emerald' }) {
  const map = {
    emerald: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    blue: 'bg-blue-100 text-blue-800 border-blue-200',
    rose: 'bg-rose-100 text-rose-800 border-rose-200',
    slate: 'bg-slate-100 text-slate-700 border-slate-200',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${map[color]}`}>
      {children}
    </span>
  )
}

// ── Create class modal ───────────────────────────────────────────────────
function CreateClassModal({ onClose, onCreated }) {
  const [name, setName] = useState('')
  const [section, setSection] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function submit(e) {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true); setError(null)
    try {
      const res = await api.post('/classes', { name: name.trim(), section: section.trim() })
      onCreated(res.data.classGroup)
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to create class.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5 border border-slate-700">
        <h2 className="text-xl font-bold text-white">Create New Class</h2>
        {error && <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3">{error}</div>}
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold tracking-widest uppercase text-slate-400 mb-1">Class Name *</label>
            <input
              id="class-name-input"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Computer Science"
              className="w-full bg-slate-700 border border-slate-600 text-white rounded-xl px-4 py-2.5 text-sm outline-none focus:border-emerald-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-bold tracking-widest uppercase text-slate-400 mb-1">Section</label>
            <input
              id="class-section-input"
              type="text"
              value={section}
              onChange={e => setSection(e.target.value)}
              placeholder="e.g. Section A, 10th Grade"
              className="w-full bg-slate-700 border border-slate-600 text-white rounded-xl px-4 py-2.5 text-sm outline-none focus:border-emerald-500 transition-colors"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-slate-600 px-4 py-2.5 text-sm font-semibold text-slate-300 hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              id="create-class-submit-btn"
              type="submit"
              disabled={busy || !name.trim()}
              className="flex-1 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-600 disabled:opacity-50 transition-colors"
            >
              {busy ? 'Creating…' : 'Create Class'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Add student modal ────────────────────────────────────────────────────
function AddStudentModal({ classId, existingStudentIds, onClose, onAdded }) {
  const [allStudents, setAllStudents] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.get('/classes/all/students')
      .then(r => setAllStudents(r.data.students || []))
      .catch(() => {})
  }, [])

  const available = allStudents.filter(s => !existingStudentIds.includes(s._id))

  async function submit(e) {
    e.preventDefault()
    if (!selectedId) return
    setBusy(true); setError(null)
    try {
      const res = await api.post(`/classes/${classId}/students`, { studentId: selectedId })
      onAdded(res.data.classGroup)
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to add student.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5 border border-slate-700">
        <h2 className="text-xl font-bold text-white">Add Student to Class</h2>
        {error && <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3">{error}</div>}
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold tracking-widest uppercase text-slate-400 mb-1">Select Student</label>
            <select
              id="add-student-select"
              value={selectedId}
              onChange={e => setSelectedId(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 text-white rounded-xl px-4 py-2.5 text-sm outline-none focus:border-emerald-500 transition-colors"
            >
              <option value="">— Choose a student —</option>
              {available.map(s => (
                <option key={s._id} value={s._id}>{s.name} ({s.email})</option>
              ))}
            </select>
            {available.length === 0 && (
              <p className="text-xs text-slate-400 mt-2">All registered students are already in this class.</p>
            )}
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-slate-600 px-4 py-2.5 text-sm font-semibold text-slate-300 hover:bg-slate-700 transition-colors">Cancel</button>
            <button
              id="add-student-submit-btn"
              type="submit"
              disabled={busy || !selectedId}
              className="flex-1 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-600 disabled:opacity-50 transition-colors"
            >
              {busy ? 'Adding…' : 'Add Student'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Class card ───────────────────────────────────────────────────────────
function ClassCard({ classGroup, onUpdate, onDelete }) {
  const [showAddStudent, setShowAddStudent] = useState(false)
  const [removingId, setRemovingId] = useState(null)
  const [expanded, setExpanded] = useState(true)

  async function removeStudent(studentId) {
    setRemovingId(studentId)
    try {
      const res = await api.delete(`/classes/${classGroup._id}/students/${studentId}`)
      onUpdate(res.data.classGroup)
    } catch (err) {
      console.error(err)
    } finally {
      setRemovingId(null)
    }
  }

  async function deleteClass() {
    if (!confirm(`Delete class "${classGroup.name}"? This cannot be undone.`)) return
    try {
      await api.delete(`/classes/${classGroup._id}`)
      onDelete(classGroup._id)
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <>
      <div className="rounded-2xl border border-slate-700 bg-slate-800/50 shadow-sm transition-shadow">
        {/* Header */}
        <div className="p-5 flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h3 className="text-lg font-bold text-slate-100">{classGroup.name}</h3>
              {classGroup.section && <Badge color="blue">{classGroup.section}</Badge>}
              <Badge color="slate">{classGroup.students?.length || 0} students</Badge>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Created {new Date(classGroup.createdAt).toLocaleDateString()}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setExpanded(v => !v)}
              className="p-2 rounded-lg text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
              title={expanded ? 'Collapse' : 'Expand'}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {expanded ? <path d="M18 15l-6-6-6 6"/> : <path d="M6 9l6 6 6-6"/>}
              </svg>
            </button>
            <button
              onClick={deleteClass}
              className="p-2 rounded-lg text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition-colors"
              title="Delete class"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Student list */}
        {expanded && (
          <div className="border-t border-slate-700 px-5 pb-5 pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold tracking-widest uppercase text-slate-400">Students</span>
              <button
                id={`add-student-btn-${classGroup._id}`}
                onClick={() => setShowAddStudent(true)}
                className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 hover:text-emerald-300 bg-emerald-900/30 hover:bg-emerald-800/40 border border-emerald-500/20 px-3 py-1.5 rounded-lg transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Add Student
              </button>
            </div>

            {classGroup.students?.length === 0 ? (
              <div className="text-sm text-slate-400 py-6 text-center bg-slate-800/30 rounded-xl border border-dashed border-slate-600">
                No students yet. Click "Add Student" to enroll.
              </div>
            ) : (
              <div className="space-y-2">
                {classGroup.students.map(s => (
                  <div key={s._id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-800/40 border border-slate-700 px-4 py-2.5 group">
                    <div>
                      <div className="text-sm font-semibold text-slate-200">{s.name}</div>
                      <div className="text-xs text-slate-400">{s.email}</div>
                    </div>
                    <button
                      onClick={() => removeStudent(s._id)}
                      disabled={removingId === s._id}
                      className="text-slate-300 hover:text-rose-500 transition-colors disabled:opacity-50 opacity-0 group-hover:opacity-100"
                      title="Remove from class"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {showAddStudent && (
        <AddStudentModal
          classId={classGroup._id}
          existingStudentIds={(classGroup.students || []).map(s => s._id)}
          onClose={() => setShowAddStudent(false)}
          onAdded={(updated) => { onUpdate(updated); setShowAddStudent(false) }}
        />
      )}
    </>
  )
}

// ═════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═════════════════════════════════════════════════════════════════════════
export function TeacherClassesPage() {
  const [classes, setClasses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showCreate, setShowCreate] = useState(false)

  async function load() {
    setLoading(true); setError(null)
    try {
      const res = await api.get('/classes')
      setClasses(res.data.classes || [])
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to load classes.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  function handleCreated(newClass) {
    setClasses(prev => [newClass, ...prev])
    setShowCreate(false)
  }

  function handleUpdate(updated) {
    setClasses(prev => prev.map(c => c._id === updated._id ? updated : c))
  }

  function handleDelete(deletedId) {
    setClasses(prev => prev.filter(c => c._id !== deletedId))
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Manage Classes</h2>
          <p className="text-slate-400 text-sm">Create class sections and enroll students.</p>
        </div>
        <button
          id="create-class-btn"
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-full bg-emerald-700 px-6 py-2.5 text-sm font-bold text-white hover:bg-emerald-600 transition-colors shadow-sm"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Create Class
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 font-medium">{error}</div>
      )}

      {loading ? (
        <div className="text-slate-400 text-center py-20 animate-pulse">Loading classes…</div>
      ) : classes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-600 bg-slate-800/30 p-12 text-center space-y-4">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-700">No classes yet</h3>
            <p className="text-slate-400 text-sm mt-1">Create your first class section to start organizing students.</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 rounded-full bg-emerald-700 px-6 py-2.5 text-sm font-bold text-white hover:bg-emerald-600 transition-colors"
          >
            Create First Class
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {classes.map(c => (
            <ClassCard
              key={c._id}
              classGroup={c}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateClassModal
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  )
}
