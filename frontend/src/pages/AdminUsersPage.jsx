import { useEffect, useState } from 'react';
import { endpoints } from '../api/endpoints';
import { extractApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import SectionHeading from '../components/SectionHeading';
import Loading from '../components/Loading';
import Alert from '../components/Alert';
import Badge from '../components/Badge';
import Button from '../components/Button';
import AdminNav from '../components/AdminNav';
import { formatDate, localDateInputValue } from '../lib/format';

const blankScore = { date: '', value: '' };

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [scores, setScores] = useState([]);
  const [email, setEmail] = useState('');
  const [scoreForm, setScoreForm] = useState(blankScore);
  const [editingScore, setEditingScore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function load() {
    setLoading(true);
    try {
      const r = await endpoints.admin.users();
      setUsers(r.data.users || []);
    } catch (e) {
      setError(extractApiError(e, 'Could not load users.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function openUser(user) {
    setSelected(user);
    setEmail(user.email || '');
    setError('');
    setMessage('');
    try {
      const r = await endpoints.admin.userScores(user.id);
      setScores(r.data.scores || []);
    } catch (e) {
      setScores([]);
      setError(extractApiError(e, 'Could not load this user\'s scores.'));
    }
  }

  async function saveProfile(event) {
    event.preventDefault();
    if (!selected) return;
    setBusy(`profile-${selected.id}`);
    setError('');
    try {
      await endpoints.admin.updateUser(selected.id, { email: email.trim().toLowerCase() });
      setMessage('Profile updated.');
      await load();
    } catch (e) {
      setError(extractApiError(e, 'Could not update profile.'));
    } finally {
      setBusy('');
    }
  }

  async function changeRole(user) {
    const nextRole = user.role === 'admin' ? 'subscriber' : 'admin';
    if (!window.confirm(`Change ${user.email} role to ${nextRole}?`)) return;
    setBusy(`role-${user.id}`);
    setError('');
    try {
      await endpoints.admin.setRole(user.id, nextRole);
      setMessage('Role updated.');
      await load();
      if (selected?.id === user.id) setSelected((current) => current ? { ...current, role: nextRole } : current);
    } catch (e) {
      setError(extractApiError(e, 'Could not update role.'));
    } finally {
      setBusy('');
    }
  }

  function startEditScore(score) {
    setEditingScore(score.id);
    setScoreForm({ date: score.date || '', value: String(score.value ?? '') });
  }

  async function saveScore(event) {
    event.preventDefault();
    if (!selected || !editingScore) return;
    setBusy(`score-${editingScore}`);
    setError('');
    try {
      await endpoints.admin.updateUserScore(selected.id, editingScore, { date: scoreForm.date, value: Number(scoreForm.value) });
      const r = await endpoints.admin.userScores(selected.id);
      setScores(r.data.scores || []);
      setEditingScore(null);
      setScoreForm(blankScore);
      setMessage('Score updated.');
    } catch (e) {
      setError(extractApiError(e, 'Could not update score.'));
    } finally {
      setBusy('');
    }
  }

  async function deleteScore(scoreId) {
    if (!selected || !window.confirm('Delete this score?')) return;
    setBusy(`delete-score-${scoreId}`);
    setError('');
    try {
      await endpoints.admin.deleteUserScore(selected.id, scoreId);
      const r = await endpoints.admin.userScores(selected.id);
      setScores(r.data.scores || []);
      setMessage('Score deleted.');
    } catch (e) {
      setError(extractApiError(e, 'Could not delete score.'));
    } finally {
      setBusy('');
    }
  }

  if (loading) return <Loading label="Loading users..." />;
  return <div><AdminNav /><SectionHeading eyebrow="Administration" title="Users" description="Review account profiles, roles, subscription status, and score records." />{error && <Alert>{error}</Alert>}{message && <Alert type="success">{message}</Alert>}<section className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035]"><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead><tr className="border-b border-white/10 text-xs uppercase tracking-wider text-slate-500"><th className="px-5 py-4">Email</th><th className="px-5 py-4">Role</th><th className="px-5 py-4">Subscription</th><th className="px-5 py-4">Created</th><th className="px-5 py-4">Actions</th></tr></thead><tbody>{users.map((u) => <tr key={u.id} className="border-b border-white/5"><td className="px-5 py-4 text-slate-200">{u.email}</td><td className="px-5 py-4"><Badge tone={u.role === 'admin' ? 'cyan' : 'slate'}>{u.role}</Badge></td><td className="px-5 py-4 text-slate-400">{u.subscription_status || 'none'}</td><td className="px-5 py-4 text-slate-500">{formatDate(u.created_at)}</td><td className="px-5 py-4"><div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={() => openUser(u)}>View</Button><Button variant="ghost" disabled={busy === `role-${u.id}` || currentUser?.id === u.id} onClick={() => changeRole(u)}>{currentUser?.id === u.id ? 'Current admin' : u.role === 'admin' ? 'Make subscriber' : 'Make admin'}</Button></div></td></tr>)}</tbody></table></div></section>
    {selected && <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.035] p-6"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs uppercase tracking-wide text-slate-500">User detail</p><h2 className="mt-2 text-2xl font-semibold text-white">{selected.email}</h2></div><Button variant="ghost" onClick={() => setSelected(null)}>Close</Button></div><form onSubmit={saveProfile} className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end"><label className="flex-1 text-sm text-slate-300"><span className="mb-2 block text-xs uppercase tracking-wide text-slate-500">Email</span><input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white focus:ring-2 focus:ring-cyan-300/20" /></label><Button type="submit" disabled={busy === `profile-${selected.id}`}>{busy === `profile-${selected.id}` ? 'Saving...' : 'Save profile'}</Button></form><div className="mt-8"><div className="flex items-center justify-between gap-3"><h3 className="text-lg font-semibold text-white">Scores</h3>{editingScore && <Button variant="ghost" onClick={() => { setEditingScore(null); setScoreForm(blankScore); }}>Cancel edit</Button>}</div>{editingScore && <form onSubmit={saveScore} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]"><label className="text-sm text-slate-300"><span className="mb-2 block text-xs uppercase tracking-wide text-slate-500">Date</span><input required max={localDateInputValue()} type="date" value={scoreForm.date} onChange={(e) => setScoreForm({ ...scoreForm, date: e.target.value })} className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white" /></label><label className="text-sm text-slate-300"><span className="mb-2 block text-xs uppercase tracking-wide text-slate-500">Stableford</span><input required min="1" max="45" type="number" value={scoreForm.value} onChange={(e) => setScoreForm({ ...scoreForm, value: e.target.value })} className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white" /></label><Button type="submit" disabled={busy === `score-${editingScore}`}>{busy === `score-${editingScore}` ? 'Saving...' : 'Save score'}</Button></form>}
      {scores.length ? <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead><tr className="border-b border-white/10 text-xs uppercase tracking-wider text-slate-500"><th className="px-3 py-3">Date</th><th className="px-3 py-3">Score</th><th className="px-3 py-3">Actions</th></tr></thead><tbody>{scores.map((score) => <tr key={score.id} className="border-b border-white/5"><td className="px-3 py-3 text-slate-300">{score.date}</td><td className="px-3 py-3 font-medium text-white">{score.value}</td><td className="px-3 py-3"><div className="flex gap-2"><Button variant="ghost" onClick={() => startEditScore(score)}>Edit</Button><Button variant="danger" disabled={busy === `delete-score-${score.id}`} onClick={() => deleteScore(score.id)}>Delete</Button></div></td></tr>)}</tbody></table></div> : <p className="mt-4 text-sm text-slate-500">No score records.</p>}</div></section>}
  </div>;
}
