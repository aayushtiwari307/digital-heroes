export default function Loading({ label = 'Loading...' }) {
  return (
    <div className="flex min-h-40 items-center justify-center rounded-3xl border border-white/10 bg-white/[0.03] text-sm text-slate-300">
      <div className="flex items-center gap-3">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
        {label}
      </div>
    </div>
  );
}
