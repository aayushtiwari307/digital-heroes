export default function Badge({ children, tone = 'slate' }) {
  const styles = {
    slate: 'bg-slate-500/10 text-slate-300 border-slate-400/10',
    green: 'bg-emerald-400/10 text-emerald-200 border-emerald-300/10',
    yellow: 'bg-amber-400/10 text-amber-200 border-amber-300/10',
    red: 'bg-rose-400/10 text-rose-200 border-rose-300/10',
    cyan: 'bg-cyan-400/10 text-cyan-200 border-cyan-300/10',
  };
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${styles[tone] || styles.slate}`}>{children}</span>;
}
