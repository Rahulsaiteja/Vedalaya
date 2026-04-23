export function TextInput({ label, ...props }) {
  return (
    <label className="block">
      <div className="mb-1.5 text-xs font-bold tracking-widest text-slate-500 uppercase">{label}</div>
      <input
        {...props}
        className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-slate-800 outline-none placeholder:text-slate-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10 transition-all font-medium"
      />
    </label>
  )
}

export function Select({ label, children, ...props }) {
  return (
    <label className="block">
      <div className="mb-1.5 text-xs font-bold tracking-widest text-slate-500 uppercase">{label}</div>
      <select
        {...props}
        className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-slate-800 outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10 transition-all font-medium appearance-none"
      >
        {children}
      </select>
    </label>
  )
}

export function PrimaryButton({ children, ...props }) {
  return (
    <button
      {...props}
      className={`rounded-full bg-emerald-800 px-6 py-3 text-xs font-bold tracking-widest text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 transition-colors shadow-md ${props.className || ''}`}
    >
      {children}
    </button>
  )
}

export function Card({ children }) {
  return <div className={`rounded-[2rem] bg-white p-6 md:p-8 shadow-sm border border-slate-100 relative overflow-hidden`}>{children}</div>
}

