import { useEffect, useState } from 'react'
import { api } from '../utils/api.js'

// ── Shared helpers ───────────────────────────────────────────────────────
function StatCard({ label, value, color = 'emerald', icon }) {
  const colors = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    rose: 'bg-rose-50 text-rose-700 border-rose-100',
    violet: 'bg-violet-50 text-violet-700 border-violet-100',
    slate: 'bg-slate-50 text-slate-700 border-slate-100',
  }
  return (
    <div className={`rounded-2xl border-2 p-5 ${colors[color]}`}>
      <div className="text-3xl font-black">{value}</div>
      <div className="text-xs font-bold tracking-widest uppercase mt-1 opacity-70">{label}</div>
    </div>
  )
}

function Badge({ children, color = 'slate' }) {
  const map = {
    emerald: 'bg-emerald-100 text-emerald-800',
    rose: 'bg-rose-100 text-rose-800',
    amber: 'bg-amber-100 text-amber-800',
    blue: 'bg-blue-100 text-blue-800',
    violet: 'bg-violet-100 text-violet-800',
    slate: 'bg-slate-100 text-slate-600',
  }
  return <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${map[color]}`}>{children}</span>
}

function Tab({ active, onClick, children, badge }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-full text-xs font-bold tracking-widest uppercase transition-all flex items-center gap-2 ${
        active ? 'bg-emerald-800 text-white shadow' : 'text-slate-500 hover:text-emerald-800 hover:bg-emerald-50'
      }`}
    >
      {children}
      {badge > 0 && (
        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${active ? 'bg-white/30 text-white' : 'bg-rose-500 text-white'}`}>
          {badge}
        </span>
      )}
    </button>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// OVERVIEW TAB
// ═══════════════════════════════════════════════════════════════════════
function OverviewTab() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/admin/stats').then(r => { setStats(r.data); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="text-slate-400 text-center py-16 animate-pulse">Loading stats…</div>
  if (!stats) return <div className="text-rose-600 text-center py-16">Failed to load stats.</div>

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-slate-700">Platform Overview</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        <StatCard label="Total Users" value={stats.totalUsers} color="slate" />
        <StatCard label="Students" value={stats.totalStudents} color="blue" />
        <StatCard label="Teachers" value={stats.totalTeachers} color="emerald" />
        <StatCard label="Pending Approval" value={stats.pendingTeachers} color="amber" />
        <StatCard label="Classes" value={stats.totalClasses} color="violet" />
        <StatCard label="Attendance Records" value={stats.totalAttendance} color="slate" />
        <StatCard label="Attendance Rate" value={`${stats.attendanceRate}%`} color={stats.attendanceRate >= 75 ? 'emerald' : 'rose'} />
      </div>
      {stats.pendingTeachers > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 font-medium flex items-center gap-3">
          <span className="text-2xl">⏳</span>
          <span><strong>{stats.pendingTeachers} teacher{stats.pendingTeachers > 1 ? 's' : ''}</strong> waiting for approval. Go to the <strong>Users</strong> tab to approve.</span>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// USERS TAB
// ═══════════════════════════════════════════════════════════════════════
function UsersTab() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState(null)

  async function load() {
    setLoading(true)
    try {
      const params = {}
      if (roleFilter) params.role = roleFilter
      if (search) params.search = search
      const res = await api.get('/admin/users', { params })
      setUsers(res.data.users || [])
    } catch { setError('Failed to load users.') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function patch(userId, update) {
    setBusyId(userId); setError(null)
    try {
      const res = await api.patch(`/admin/users/${userId}`, update)
      setUsers(prev => prev.map(u => u._id === userId ? res.data.user : u))
    } catch (err) { setError(err?.response?.data?.error || 'Update failed.') }
    finally { setBusyId(null) }
  }

  async function deleteUser(userId, name) {
    if (!confirm(`Delete user "${name}"? This cannot be undone.`)) return
    setBusyId(userId)
    try {
      await api.delete(`/admin/users/${userId}`)
      setUsers(prev => prev.filter(u => u._id !== userId))
    } catch (err) { setError(err?.response?.data?.error || 'Delete failed.') }
    finally { setBusyId(null) }
  }

  const filtered = users.filter(u => {
    const term = search.toLowerCase()
    return u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term)
  })

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or email…"
          className="flex-1 min-w-[200px] border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-emerald-500"
        />
        <select
          value={roleFilter} onChange={e => { setRoleFilter(e.target.value) }}
          className="border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-emerald-500"
        >
          <option value="">All Roles</option>
          <option value="student">Students</option>
          <option value="teacher">Teachers</option>
          <option value="admin">Admins</option>
        </select>
        <button onClick={load} className="px-4 py-2.5 rounded-xl bg-emerald-700 text-white text-sm font-bold hover:bg-emerald-600 transition-colors">Search</button>
      </div>

      {error && <div className="text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3 text-sm">{error}</div>}

      {loading ? (
        <div className="text-slate-400 text-center py-12 animate-pulse">Loading…</div>
      ) : (
        <div className="rounded-2xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-400 text-xs uppercase tracking-widest border-b border-slate-200">
                <th className="text-left px-4 py-3">User</th>
                <th className="text-left px-4 py-3">Role</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={4} className="text-center text-slate-400 py-10">No users found.</td></tr>
              ) : filtered.map((u, i) => (
                <tr key={u._id} className={`border-t border-slate-100 hover:bg-slate-50 transition-colors ${i % 2 === 0 ? '' : 'bg-slate-50/50'}`}>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-800">{u.name}</div>
                    <div className="text-xs text-slate-400">{u.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={u.role}
                      disabled={busyId === u._id}
                      onChange={e => patch(u._id, { role: e.target.value })}
                      className="border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold outline-none focus:border-emerald-500"
                    >
                      <option value="student">Student</option>
                      <option value="teacher">Teacher</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {u.isVerified ? <Badge color="emerald">Verified</Badge> : <Badge color="slate">Unverified</Badge>}
                      {u.role === 'teacher' && (u.isApproved ? <Badge color="blue">Approved</Badge> : <Badge color="amber">Pending</Badge>)}
                      {u.isActive ? null : <Badge color="rose">Deactivated</Badge>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {u.role === 'teacher' && !u.isApproved && (
                        <button
                          onClick={() => patch(u._id, { isApproved: true })}
                          disabled={busyId === u._id}
                          className="px-3 py-1.5 rounded-lg bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-600 disabled:opacity-50 transition-colors"
                        >
                          ✓ Approve
                        </button>
                      )}
                      <button
                        onClick={() => patch(u._id, { isActive: !u.isActive })}
                        disabled={busyId === u._id}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-50 transition-colors ${
                          u.isActive ? 'bg-amber-100 text-amber-800 hover:bg-amber-200' : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                        }`}
                      >
                        {u.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        onClick={() => deleteUser(u._id, u.name)}
                        disabled={busyId === u._id}
                        className="px-3 py-1.5 rounded-lg bg-rose-100 text-rose-700 text-xs font-bold hover:bg-rose-200 disabled:opacity-50 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// CLASSES TAB
// ═══════════════════════════════════════════════════════════════════════
function ClassesTab() {
  const [classes, setClasses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({ name: '', section: '' })

  useEffect(() => {
    api.get('/admin/classes')
      .then(r => { setClasses(r.data.classes || []); setLoading(false) })
      .catch(() => { setError('Failed to load.'); setLoading(false) })
  }, [])

  function startEdit(c) { setEditingId(c._id); setEditForm({ name: c.name, section: c.section || '' }) }

  async function saveEdit(id) {
    setBusyId(id)
    try {
      const res = await api.patch(`/admin/classes/${id}`, editForm)
      setClasses(prev => prev.map(c => c._id === id ? res.data.classGroup : c))
      setEditingId(null)
    } catch (err) { setError(err?.response?.data?.error || 'Update failed.') }
    finally { setBusyId(null) }
  }

  async function deleteClass(id, name) {
    if (!confirm(`Delete class "${name}"?`)) return
    setBusyId(id)
    try {
      await api.delete(`/admin/classes/${id}`)
      setClasses(prev => prev.filter(c => c._id !== id))
    } catch (err) { setError(err?.response?.data?.error || 'Delete failed.') }
    finally { setBusyId(null) }
  }

  if (loading) return <div className="text-slate-400 text-center py-12 animate-pulse">Loading…</div>

  return (
    <div className="space-y-4">
      {error && <div className="text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3 text-sm">{error}</div>}
      {classes.length === 0 ? (
        <div className="text-slate-400 text-center py-12 border-2 border-dashed rounded-2xl">No classes found.</div>
      ) : (
        <div className="space-y-3">
          {classes.map(c => (
            <div key={c._id} className="rounded-2xl border-2 border-slate-100 bg-white p-5">
              {editingId === c._id ? (
                <div className="flex flex-wrap gap-3 items-end">
                  <div className="flex-1 min-w-[150px]">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-1">Name</label>
                    <input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-emerald-500" />
                  </div>
                  <div className="flex-1 min-w-[120px]">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-1">Section</label>
                    <input value={editForm.section} onChange={e => setEditForm(f => ({ ...f, section: e.target.value }))}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-emerald-500" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => saveEdit(c._id)} disabled={busyId === c._id}
                      className="px-4 py-2 rounded-xl bg-emerald-700 text-white text-sm font-bold hover:bg-emerald-600 disabled:opacity-50">Save</button>
                    <button onClick={() => setEditingId(null)}
                      className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-800">{c.name}</span>
                      {c.section && <Badge color="blue">{c.section}</Badge>}
                      <Badge color="slate">{c.students?.length || 0} students</Badge>
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      Teacher: <span className="text-slate-600 font-medium">{c.teacher?.name || '—'}</span>
                      {' · '}{c.teacher?.email}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => startEdit(c)}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors">Edit</button>
                    <button onClick={() => deleteClass(c._id, c.name)} disabled={busyId === c._id}
                      className="px-3 py-1.5 rounded-lg bg-rose-100 text-rose-700 text-xs font-bold hover:bg-rose-200 disabled:opacity-50 transition-colors">Delete</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// ATTENDANCE TAB
// ═══════════════════════════════════════════════════════════════════════
function AttendanceTab() {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState({ from: '', to: '' })
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState(null)

  async function load() {
    setLoading(true); setError(null)
    try {
      const params = {}
      if (filter.from) params.from = filter.from
      if (filter.to) params.to = filter.to
      const res = await api.get('/admin/attendance', { params })
      setRecords(res.data.records || [])
    } catch { setError('Failed to load attendance.') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function toggleStatus(r) {
    setBusyId(r._id)
    try {
      const res = await api.patch(`/admin/attendance/${r._id}`, { status: r.status === 'Present' ? 'Absent' : 'Present' })
      setRecords(prev => prev.map(x => x._id === r._id ? res.data.record : x))
    } catch (err) { setError(err?.response?.data?.error || 'Update failed.') }
    finally { setBusyId(null) }
  }

  async function deleteRecord(id) {
    if (!confirm('Delete this attendance record?')) return
    setBusyId(id)
    try {
      await api.delete(`/admin/attendance/${id}`)
      setRecords(prev => prev.filter(r => r._id !== id))
    } catch (err) { setError(err?.response?.data?.error || 'Delete failed.') }
    finally { setBusyId(null) }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-1">From</label>
          <input type="date" value={filter.from} onChange={e => setFilter(f => ({ ...f, from: e.target.value }))}
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-emerald-500" />
        </div>
        <div>
          <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-1">To</label>
          <input type="date" value={filter.to} onChange={e => setFilter(f => ({ ...f, to: e.target.value }))}
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-emerald-500" />
        </div>
        <button onClick={load} className="px-4 py-2 rounded-xl bg-emerald-700 text-white text-sm font-bold hover:bg-emerald-600 transition-colors">Apply</button>
      </div>

      {error && <div className="text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3 text-sm">{error}</div>}

      {loading ? (
        <div className="text-slate-400 text-center py-12 animate-pulse">Loading…</div>
      ) : (
        <div className="rounded-2xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-400 text-xs uppercase tracking-widest border-b border-slate-200">
                <th className="text-left px-4 py-3">Student</th>
                <th className="text-left px-4 py-3">Class</th>
                <th className="text-left px-4 py-3">Date</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr><td colSpan={5} className="text-center text-slate-400 py-10">No records found.</td></tr>
              ) : records.map(r => (
                <tr key={r._id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800">{r.user?.name || '—'}</div>
                    <div className="text-xs text-slate-400">{r.user?.email}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {r.classGroup ? `${r.classGroup.name}${r.classGroup.section ? ' · ' + r.classGroup.section : ''}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    {new Date(r.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3">
                    <Badge color={r.status === 'Present' ? 'emerald' : 'rose'}>{r.status}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => toggleStatus(r)} disabled={busyId === r._id}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors">
                        Toggle
                      </button>
                      <button onClick={() => deleteRecord(r._id)} disabled={busyId === r._id}
                        className="px-3 py-1.5 rounded-lg bg-rose-100 text-rose-700 text-xs font-bold hover:bg-rose-200 disabled:opacity-50 transition-colors">
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="text-xs text-slate-400 text-right">Showing {records.length} records</div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════
export function AdminDashboard() {
  const [tab, setTab] = useState('overview')
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    api.get('/admin/stats').then(r => setPendingCount(r.data.pendingTeachers || 0)).catch(() => {})
  }, [])

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-emerald-900 tracking-tight">Admin Dashboard</h1>
        <p className="mt-2 text-slate-500 font-medium">Manage users, classes, and attendance across the platform.</p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 bg-slate-100 p-1.5 rounded-2xl w-fit">
        <Tab active={tab === 'overview'} onClick={() => setTab('overview')}>Overview</Tab>
        <Tab active={tab === 'users'} onClick={() => setTab('users')} badge={pendingCount}>Users</Tab>
        <Tab active={tab === 'classes'} onClick={() => setTab('classes')}>Classes</Tab>
        <Tab active={tab === 'attendance'} onClick={() => setTab('attendance')}>Attendance</Tab>
      </div>

      <div>
        {tab === 'overview'   && <OverviewTab />}
        {tab === 'users'      && <UsersTab />}
        {tab === 'classes'    && <ClassesTab />}
        {tab === 'attendance' && <AttendanceTab />}
      </div>
    </div>
  )
}
