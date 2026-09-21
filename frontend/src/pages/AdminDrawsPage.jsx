import { useEffect, useState } from 'react';
import { endpoints } from '../api/endpoints';
import { extractApiError } from '../api/client';
import SectionHeading from '../components/SectionHeading';
import Button from '../components/Button';
import Alert from '../components/Alert';
import Badge from '../components/Badge';
import AdminNav from '../components/AdminNav';
import { formatMoney, formatMonth, statusLabel } from '../lib/format';

const STORAGE_KEY = 'dh_admin_simulated_draw_id';

export default function AdminDrawsPage() {
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  const [strategy, setStrategy] = useState('random');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const drawId = sessionStorage.getItem(STORAGE_KEY);
    if (!drawId) return;
    endpoints.draws.adminGet(drawId)
      .then((res) => setResult(normalizeResult(res.data)))
      .catch(() => sessionStorage.removeItem(STORAGE_KEY));
  }, []);

  async function simulate() {
    if (!/^\d{4}-\d{2}$/.test(month)) { setError('Choose a valid draw month.'); return; }
    setBusy(true); setError('');
    try {
      const r = await endpoints.draws.simulate({ month, strategy });
      const next = normalizeResult(r.data);
      setResult(next);
      if (next.draw?.id) sessionStorage.setItem(STORAGE_KEY, next.draw.id);
    } catch (e) { setError(extractApiError(e, 'Could not simulate draw.')); } finally { setBusy(false); }
  }

  async function publish() {
    const drawId = result?.draw?.id;
    if (!drawId || result.draw.status === 'published') return;
    if (!window.confirm(`Publish the ${formatMonth(result.draw.month)} draw? Published draws are immutable.`)) return;
    setBusy(true); setError('');
    try {
      const r = await endpoints.draws.publish(drawId);
      setResult((current) => ({ ...current, draw: r.data?.draw || r.data }));
      sessionStorage.removeItem(STORAGE_KEY);
    } catch (e) { setError(extractApiError(e, 'Could not publish draw.')); } finally { setBusy(false); }
  }

  return <div><AdminNav /><SectionHeading eyebrow="Administration" title="Draw operations" description="Simulate a month, review its frozen entry set and settlement, then publish it. The backend enforces chronological publishing." />{error && <Alert>{error}</Alert>}<section className="rounded-3xl border border-white/10 bg-white/[0.035] p-6"><div className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end"><label className="text-sm text-slate-300"><span className="mb-2 block text-xs uppercase tracking-wide text-slate-500">Draw month</span><input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white focus:ring-2 focus:ring-cyan-300/20" /></label><label className="text-sm text-slate-300"><span className="mb-2 block text-xs uppercase tracking-wide text-slate-500">Strategy</span><select value={strategy} onChange={(e) => setStrategy(e.target.value)} className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white"><option value="random">Random</option><option value="algorithmic">Algorithmic</option></select></label><Button disabled={busy} onClick={simulate}>{busy ? 'Working...' : 'Simulate draw'}</Button></div></section>{result && <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.035] p-6"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs uppercase tracking-wide text-slate-500">{formatMonth(result.draw.month)}</p><h2 className="mt-2 text-2xl font-semibold text-white">{statusLabel(result.draw.status)}</h2></div><div className="flex gap-2"><Badge tone="cyan">{result.entryCount} entries</Badge>{result.seed && <Badge>{result.seed.slice(0, 12)}…</Badge>}</div></div><div className="mt-6 flex flex-wrap gap-3">{(result.winningNumbers || []).map((n, i) => <span key={`${n}-${i}`} className="grid h-12 w-12 place-items-center rounded-xl border border-cyan-300/10 bg-cyan-300/5 font-semibold text-cyan-100">{n}</span>)}</div><div className="mt-7 grid gap-4 sm:grid-cols-4"><Metric label="Pool" value={formatMoney(result.draw.total_pool_minor)} /><Metric label="Carry in" value={formatMoney(result.draw.jackpot_carry_in)} /><Metric label="Carry out" value={formatMoney(result.draw.jackpot_carry_out)} /><Metric label="Unawarded" value={formatMoney(result.draw.unawarded_minor)} /></div><div className="mt-6 overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead><tr className="border-b border-white/10 text-xs uppercase tracking-wider text-slate-500"><th className="px-3 py-3">Winner</th><th className="px-3 py-3">Tier</th><th className="px-3 py-3">Payout</th><th className="px-3 py-3">Status</th></tr></thead><tbody>{(result.winners || []).map((w) => <tr key={w.id} className="border-b border-white/5"><td className="px-3 py-3 max-w-[22rem] truncate text-xs text-slate-400">{w.user_id}</td><td className="px-3 py-3 text-white">{w.tier}</td><td className="px-3 py-3 text-slate-300">{formatMoney(w.payout_minor)}</td><td className="px-3 py-3"><Badge>{statusLabel(w.status)}</Badge></td></tr>)}</tbody></table></div>{result.draw.status !== 'published' && <div className="mt-6 flex justify-end"><Button disabled={busy} onClick={publish}>{busy ? 'Publishing...' : 'Publish draw'}</Button></div>}</section>}</div>;
}

function normalizeResult(data) {
  if (!data) return null;
  const draw = data.draw || data;
  return {
    ...data,
    draw,
    winningNumbers: data.winningNumbers || data.winning_numbers || draw.winningNumbers || draw.winning_numbers || [],
    winners: data.winners || draw.winners || [],
    entryCount: data.entryCount ?? data.entries?.length ?? draw.entries?.length ?? 0,
    seed: data.seed || draw.seed,
  };
}

function Metric({ label, value }) { return <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4"><p className="text-xs text-slate-500">{label}</p><p className="mt-2 text-lg font-semibold text-white">{value}</p></div>; }
