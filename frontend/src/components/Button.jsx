export default function Button({ variant = 'primary', className = '', children, type = 'button', ...props }) {
  const styles = {
    primary: 'bg-white text-slate-950 hover:bg-slate-200',
    secondary: 'border border-white/15 bg-white/[0.04] text-white hover:bg-white/[0.08]',
    ghost: 'text-slate-300 hover:bg-white/[0.05] hover:text-white',
    danger: 'bg-rose-500/15 text-rose-100 hover:bg-rose-500/25 border border-rose-400/20',
  };
  return (
    <button type={type} className={`inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}
