import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { endpoints } from '../api/endpoints';
import { extractApiError } from '../api/client';
import Loading from '../components/Loading';
import Alert from '../components/Alert';
import Badge from '../components/Badge';
import { formatMoney, formatMonth, statusLabel } from '../lib/format';

export default function DrawDetailPage() {
  const { id } = useParams();
  const [draw, setDraw] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    endpoints.draws.get(id)
      .then((res) => alive && setDraw(res.data))
      .catch((e) => alive && setError(extractApiError(e, 'Could not load draw.')))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [id]);

  if (loading) return <Loading label="Loading draw result..." />;
  if (error) return <Alert>{error}</Alert>;
  if (!draw) return <Alert>Draw not found.</Alert>;

  const winningNumbers = draw.winning_numbers || draw.winningNumbers || [];
  return (
    <div className="space-y-8">
      <Link to="/draws" className="text-sm text-slate-400 hover:text-white">← Back to draws</Link>
      <section className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-7 md:p-10">
        <div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs uppercase tracking-[0.18em] text-cyan-300">Published draw</p><h1 className="mt-2 text-4xl font-semibold text-white">{formatMonth(draw.month)}</h1></div><Badge tone="green">{statusLabel(draw.status)}</Badge></div>
        <div className="mt-9 grid gap-5 sm:grid-cols-2 lg:grid-cols-3"><Metric label="Prize pool" value={formatMoney(draw.total_pool_minor)} /><Metric label="Jackpot carry out" value={formatMoney(draw.jackpot_carry_out)} /><Metric label="Unawarded" value={formatMoney(draw.unawarded_minor)} /></div>
        <div className="mt-8 rounded-3xl border border-white/10 bg-slate-950/40 p-6"><p className="text-xs uppercase tracking-wide text-slate-500">Winning numbers</p>{winningNumbers.length ? <div className="mt-5 flex flex-wrap gap-3">{winningNumbers.map((n, index) => <span key={`${n}-${index}`} className="grid h-14 w-14 place-items-center rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.05] text-xl font-semibold text-cyan-100">{n}</span>)}</div> : <p className="mt-4 text-sm text-slate-500">Winning numbers are not available for this draw.</p>}</div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[5, 4, 3].map((tier) => <div key={tier} className="rounded-2xl border border-white/10 bg-white/[0.025] p-5"><p className="text-sm text-slate-500">Tier {tier}</p><p className="mt-2 text-2xl font-semibold text-white">{tier === 5 ? '40%' : tier === 4 ? '35%' : '25%'}</p><p className="mt-1 text-xs text-slate-500">Prize share for matching {tier} numbers</p></div>)}
        </div>

        <div className="mt-7 rounded-3xl border border-white/10 bg-cyan-300/[0.04] p-6"><h2 className="text-lg font-semibold text-white">How prizes work</h2><p className="mt-2 text-sm leading-6 text-slate-400">A five-match result receives 40% of the eligible prize pool, four matches receive 35%, and three matches receive 25%. Multiple winners share their tier equally. An unclaimed five-match jackpot rolls forward to a later published draw; lower-tier unawarded amounts do not become jackpot carry-in.</p></div>

        {draw.my_entry && <div className="mt-5 rounded-3xl border border-white/10 bg-slate-950/40 p-6"><p className="text-xs uppercase tracking-wide text-slate-500">Your frozen entry</p><div className="mt-4 flex flex-wrap gap-2">{draw.my_entry.ticketNumbers?.map((n, index) => <span key={`${n}-${index}`} className="rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-200">{n}</span>)}</div>{Array.isArray(draw.my_winnings) && draw.my_winnings.length > 0 && <p className="mt-4 text-sm text-emerald-200">You have a winning entry in this draw. Open Winnings for proof and payout status.</p>}</div>}
      </section>
    </div>
  );
}

function Metric({ label, value }) { return <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-4"><p className="text-xs text-slate-500">{label}</p><p className="mt-2 text-lg font-semibold text-white">{value}</p></div>; }
