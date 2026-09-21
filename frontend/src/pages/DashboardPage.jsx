import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { endpoints } from '../api/endpoints';
import { extractApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { formatDate, formatMoney, formatMonth, statusLabel } from '../lib/format';
import SectionHeading from '../components/SectionHeading';
import StatCard from '../components/StatCard';
import Badge from '../components/Badge';
import Loading from '../components/Loading';
import Alert from '../components/Alert';

export default function DashboardPage() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const checkoutSuccess = params.get('checkout') === 'success';
  const checkoutCancelled = params.get('checkout') === 'cancelled';
  const [scores, setScores] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [winnings, setWinnings] = useState([]);
  const [draws, setDraws] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [webhookPending, setWebhookPending] = useState(checkoutSuccess);

  async function load({ silent = false } = {}) {
    if (silent) setRefreshing(true); else setLoading(true);
    setError('');
    const results = await Promise.allSettled([
      endpoints.scores.list(),
      endpoints.subscription.mine(),
      endpoints.winners.mine(),
      endpoints.draws.list(),
    ]);

    const errors = [];
    const [scoreRes, subRes, winRes, drawRes] = results;
    if (scoreRes.status === 'fulfilled') setScores(scoreRes.value.data);
    else errors.push(extractApiError(scoreRes.reason, 'Could not load scores.'));
    if (subRes.status === 'fulfilled') setSubscription(subRes.value.data.subscription ?? null);
    else errors.push(extractApiError(subRes.reason, 'Could not load subscription status.'));
    if (winRes.status === 'fulfilled') setWinnings(winRes.value.data.winnings || []);
    else errors.push(extractApiError(winRes.reason, 'Could not load winnings.'));
    if (drawRes.status === 'fulfilled') setDraws(drawRes.value.data.draws || []);
    else errors.push(extractApiError(drawRes.reason, 'Could not load draws.'));
    if (errors.length) setError(errors[0]);
    if (silent) setRefreshing(false); else setLoading(false);
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!checkoutSuccess) return undefined;
    let attempts = 0;
    let cancelled = false;
    const timer = window.setInterval(async () => {
      if (cancelled || attempts >= 10) {
        window.clearInterval(timer);
        setWebhookPending(false);
        return;
      }
      attempts += 1;
      try {
        const response = await endpoints.subscription.mine();
        if (cancelled) return;
        setSubscription(response.data.subscription ?? null);
        const active = response.data.subscription?.status === 'active';
        if (active) {
          setWebhookPending(false);
          window.clearInterval(timer);
        }
      } catch {
        // Keep polling briefly; the webhook may simply not have landed yet.
      }
    }, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [checkoutSuccess]);

  if (loading) return <Loading label="Loading your dashboard..." />;
  const active = subscription?.status === 'active' && (!subscription.current_period_end || new Date(subscription.current_period_end) > new Date());
  const latestDraw = draws[0];
  const pendingWinnings = winnings.filter((x) => x.status === 'pending').length;
  const displayScores = scores?.current || [];

  return (
    <div>
      <SectionHeading eyebrow="Member home" title={`Good to see you, ${user?.email?.split('@')[0] || 'Hero'}.`} description="Your membership, scorecard, and published draw activity in one place." action={<button type="button" onClick={() => load({ silent: true })} disabled={refreshing} className="rounded-xl border border-white/10 bg-white/[0.035] px-4 py-2.5 text-sm text-slate-300 hover:text-white disabled:opacity-50">{refreshing ? 'Refreshing...' : 'Refresh'}</button>} />
      {checkoutSuccess && <Alert type="success">Stripe checkout returned successfully. {webhookPending ? 'We are waiting for the verified subscription webhook to arrive.' : 'Your subscription is now active.'}</Alert>}
      {checkoutCancelled && <Alert type="success">Stripe checkout was cancelled. No subscription was created by this return.</Alert>}
      {error && <Alert>{error}</Alert>}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Subscription" value={active ? 'Active' : (statusLabel(subscription?.status) || 'Not active')} helper={subscription?.plan_id ? `Plan ${subscription.plan_id}` : 'Choose a plan to participate'} />
        <StatCard label="Scores" value={`${displayScores.length}/5`} helper={scores?.drawEligible ? 'Draw eligible' : 'Complete all five retained scores'} />
        <StatCard label="Winnings" value={winnings.length} helper={pendingWinnings ? `${pendingWinnings} awaiting action` : 'No pending winner action'} />
        <StatCard label="Latest draw" value={latestDraw ? formatMonth(latestDraw.month) : '—'} helper={latestDraw ? 'Published result' : 'No published draws yet'} />
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
          <div className="flex items-center justify-between gap-4"><h2 className="text-xl font-semibold text-white">Your five-score ticket</h2><Link to="/scores" className="text-sm text-cyan-300 hover:text-white">Manage scores →</Link></div>
          <div className="mt-6 grid grid-cols-5 gap-2">
            {displayScores.slice().sort((a, b) => String(b.date).localeCompare(String(a.date))).map((score) => <div key={score.id} className="rounded-2xl border border-white/10 bg-slate-950/50 px-3 py-5 text-center"><p className="text-2xl font-semibold text-white">{score.value}</p><p className="mt-1 text-[10px] text-slate-500">{score.date}</p></div>)}
            {Array.from({ length: Math.max(0, 5 - displayScores.length) }).map((_, i) => <div key={`empty-${i}`} className="grid min-h-20 place-items-center rounded-2xl border border-dashed border-white/10 text-slate-700">+</div>)}
          </div>
          <p className="mt-5 text-sm leading-6 text-slate-400">Your latest five retained scores form the draw entry. The backend calculates winning matches and payouts.</p>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
          <div className="flex items-center justify-between gap-4"><h2 className="text-xl font-semibold text-white">Membership</h2><Link to="/subscription" className="text-sm text-cyan-300 hover:text-white">Manage →</Link></div>
          {subscription ? <div className="mt-5 space-y-4 text-sm"><Row label="Status"><Badge tone={active ? 'green' : 'yellow'}>{statusLabel(subscription.status)}</Badge></Row><Row label="Charity share" value={`${subscription.charity_pct}%`} /><Row label="Prize pool share" value={`${subscription.pool_pct_snapshot}%`} /><Row label="Current period" value={`${formatDate(subscription.current_period_start)} → ${formatDate(subscription.current_period_end)}`} /></div> : <div className="mt-6 rounded-2xl border border-dashed border-white/10 p-5"><p className="font-medium text-white">No subscription yet</p><p className="mt-2 text-sm text-slate-500">Choose a plan and charity to unlock score mutations and draw participation.</p><Link to="/subscription" className="mt-4 inline-block text-sm text-cyan-300">Browse plans →</Link></div>}
        </section>
      </div>

      <section className="mt-5 rounded-3xl border border-white/10 bg-white/[0.035] p-6">
        <div className="flex items-center justify-between gap-4"><div><h2 className="text-xl font-semibold text-white">Recent winnings</h2><p className="mt-1 text-sm text-slate-500">Proof review and payout progress are managed by the winner workflow.</p></div><Link to="/winnings" className="text-sm text-cyan-300 hover:text-white">Open winnings →</Link></div>
        {winnings.length === 0 ? <p className="mt-6 text-sm text-slate-500">No winnings yet.</p> : <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead><tr className="border-b border-white/10 text-xs uppercase tracking-wider text-slate-500"><th className="px-3 py-3">Draw</th><th className="px-3 py-3">Tier</th><th className="px-3 py-3">Payout</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Proof</th></tr></thead><tbody>{winnings.slice(0,5).map((win) => <tr key={win.id} className="border-b border-white/5"><td className="px-3 py-3 text-slate-300">{formatMonth(win.month)}</td><td className="px-3 py-3 font-medium text-white">{win.tier}/5</td><td className="px-3 py-3 text-slate-300">{formatMoney(win.payout_minor)}</td><td className="px-3 py-3"><Badge tone={win.status === 'paid' ? 'green' : 'yellow'}>{statusLabel(win.status)}</Badge></td><td className="px-3 py-3 text-slate-400">{statusLabel(win.proof_status) || 'Not uploaded'}</td></tr>)}</tbody></table></div>}
      </section>
    </div>
  );
}

function Row({ label, value, children }) { return <div className="flex items-center justify-between gap-4 border-b border-white/5 pb-4 last:border-0"><span className="text-slate-500">{label}</span>{children || <span className="text-right text-slate-200">{value}</span>}</div>; }
