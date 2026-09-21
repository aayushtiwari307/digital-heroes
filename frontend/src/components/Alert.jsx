export default function Alert({ type = 'error', children, onClose }) {
  const tone = type === 'success'
    ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-100'
    : 'border-rose-400/20 bg-rose-400/10 text-rose-100';
  return (
    <div role="alert" className={`mb-5 flex items-start justify-between gap-3 rounded-2xl border px-4 py-3 text-sm ${tone}`}>
      <span className="min-w-0 break-words">{typeof children === 'string' ? children : String(children ?? '')}</span>
      {onClose && <button type="button" onClick={onClose} className="text-white/60 hover:text-white" aria-label="Close">×</button>}
    </div>
  );
}
