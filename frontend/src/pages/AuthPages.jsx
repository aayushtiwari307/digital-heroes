import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Button from '../components/Button';
import Alert from '../components/Alert';
import { useAuth } from '../context/AuthContext';

function AuthLayout({ title, subtitle, children }) {
  return (
    <div className="mx-auto max-w-md py-6 md:py-14">
      <div className="mb-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">Digital Heroes</p>
        <h1 className="mt-3 text-3xl font-semibold text-white">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">{subtitle}</p>
      </div>
      <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6 shadow-glow md:p-8">{children}</div>
    </div>
  );
}

function safeNext(value) {
  if (
    !value ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\') ||
    /[\u0000-\u001F\u007F]/.test(value)
  ) {
    return '/dashboard';
  }
  return value;
}

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const next = safeNext(params.get('next'));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login({ email: email.trim().toLowerCase(), password });
      navigate(user.role === 'admin' ? '/admin' : next, { replace: true });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout title="Welcome back" subtitle="Log in to manage your scores, subscription, and draw activity.">
      {error && <Alert>{error}</Alert>}
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email" type="email" value={email} onChange={setEmail} required autoComplete="email" />
        <Field label="Password" type="password" value={password} onChange={setPassword} required autoComplete="current-password" />
        <Button type="submit" className="w-full" disabled={loading}>{loading ? 'Signing in...' : 'Sign in'}</Button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500">New here? <Link to="/signup" className="text-white hover:underline">Create an account</Link></p>
    </AuthLayout>
  );
}

export function SignupPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const next = safeNext(params.get('next'));
  const charity = params.get('charity');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError('');
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await signup({ email: email.trim().toLowerCase(), password });
      const target = charity ? `/subscription?charity=${encodeURIComponent(charity)}` : next;
      navigate(target, { replace: true });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout title="Create your account" subtitle="Join the platform, choose your charity, then keep your scorecard ready for the monthly draw.">
      {error && <Alert>{error}</Alert>}
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email" type="email" value={email} onChange={setEmail} required autoComplete="email" />
        <Field label="Password" type="password" value={password} onChange={setPassword} required minLength={8} autoComplete="new-password" />
        <Field label="Confirm password" type="password" value={confirm} onChange={setConfirm} required minLength={8} autoComplete="new-password" />
        <Button type="submit" className="w-full" disabled={loading}>{loading ? 'Creating account...' : 'Create account'}</Button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500">Already have an account? <Link to="/login" className="text-white hover:underline">Sign in</Link></p>
    </AuthLayout>
  );
}

function Field({ label, value, onChange, type = 'text', ...props }) {
  return (
    <label className="block text-sm text-slate-300">
      <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">{label}</span>
      <input {...props} type={type} value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white placeholder:text-slate-600 focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/20" />
    </label>
  );
}
