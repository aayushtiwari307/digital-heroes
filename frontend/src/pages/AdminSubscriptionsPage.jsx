import { useEffect, useState } from 'react';
import { endpoints } from '../api/endpoints';
import { extractApiError } from '../api/client';
import SectionHeading from '../components/SectionHeading';
import Loading from '../components/Loading';
import Alert from '../components/Alert';
import Badge from '../components/Badge';
import Button from '../components/Button';
import AdminNav from '../components/AdminNav';
import { formatDate, statusLabel } from '../lib/format';

export default function AdminSubscriptionsPage() {
  const [rows, setRows] = useState([]); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(''); const [error, setError] = useState('');
  async function load() { setLoading(true); try { const r = await endpoints.admin.subscriptions(); setRows(r.data.subscriptions || []); } catch (e) { setError(extractApiError(e, 'Could not load subscriptions.')); } finally { setLoading(false); } }
  useEffect(() => { load(); }, []);
  async function cancel(id) { if (!window.confirm('Request Stripe cancellation for this subscription?')) return; setBusy(id); setError(''); try { await endpoints.admin.cancelSubscription(id); await load(); } catch (e) { setError(extractApiError(e, 'Could not cancel subscription.')); } finally { setBusy(''); } }
  if (loading) return <Loading label="Loading subscriptions..." />;
  return <div><AdminNav /><SectionHeading eyebrow="Administration" title="Subscriptions" description="Inspect plan, charity allocation, current entitlement, and Stripe lifecycle status." />{error && <Alert>{error}</Alert>}<section className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035]"><div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-left text-sm"><thead><tr className="border-b border-white/10 text-xs uppercase tracking-wider text-slate-500"><th className="px-4 py-4">User</th><th className="px-4 py-4">Plan</th><th className="px-4 py-4">Charity</th><th className="px-4 py-4">Allocation</th><th className="px-4 py-4">Period</th><th className="px-4 py-4">Status</th><th className="px-4 py-4">Action</th></tr></thead><tbody>{rows.map((s) => <tr key={s.id} className="border-b border-white/5"><td className="px-4 py-4 text-slate-200">{s.email}</td><td className="px-4 py-4 text-slate-400">{s.plan_name}</td><td className="px-4 py-4 text-slate-400">{s.charity_name || '—'}</td><td className="px-4 py-4 text-slate-400">{s.charity_pct}% / {s.pool_pct_snapshot}%</td><td className="px-4 py-4 text-xs text-slate-500">{formatDate(s.current_period_start)} → {formatDate(s.current_period_end)}</td><td className="px-4 py-4"><Badge tone={s.status === 'active' ? 'green' : 'yellow'}>{statusLabel(s.status)}</Badge></td><td className="px-4 py-4">{s.status === 'active' && <Button variant="danger" disabled={busy === s.user_id} onClick={() => cancel(s.user_id)}>{busy === s.user_id ? 'Cancelling...' : 'Cancel'}</Button>}</td></tr>)}</tbody></table></div></section></div>;
}
