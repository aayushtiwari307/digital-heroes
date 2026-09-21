import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { endpoints } from '../api/endpoints';
import { extractApiError } from '../api/client';
import Button from '../components/Button';
import Alert from '../components/Alert';
import Badge from '../components/Badge';
import Loading from '../components/Loading';
import SectionHeading from '../components/SectionHeading';
import { formatMoney, formatDate, statusLabel } from '../lib/format';

export default function SubscriptionPage() {
  const [searchParams] = useSearchParams();
  const preselectedCharity = searchParams.get('charity') || '';
  const checkoutCancelled = searchParams.get('checkout') === 'cancelled';
  const [plans, setPlans] = useState([]);
  const [charities, setCharities] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [planId, setPlanId] = useState('');
  const [charityId, setCharityId] = useState(preselectedCharity);
  const [charityPct, setCharityPct] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState(checkoutCancelled ? 'Stripe checkout was cancelled; no subscription was created by that return.' : '');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [planRes, charityRes, subRes] = await Promise.all([
        endpoints.plans.list(),
        endpoints.charities.list(),
        endpoints.subscription.mine(),
      ]);
      const nextPlans = planRes.data.plans || [];
      const nextCharities = charityRes.data.charities || [];
      setPlans(nextPlans);
      setCharities(nextCharities);
      setSubscription(subRes.data.subscription ?? null);
      if (!planId && nextPlans[0]) setPlanId(nextPlans[0].id);
      if ((!charityId || !nextCharities.some((c) => String(c.id) === String(charityId))) && nextCharities[0]) setCharityId(nextCharities[0].id);
    } catch (e) {
      setError(extractApiError(e, 'Could not load subscription options.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const chosenCharity = useMemo(
    () => charities.find((x) => String(x.id) === String(charityId)),
    [charities, charityId],
  );

  useEffect(() => {
    if (chosenCharity) {
      setCharityPct((current) => current === '' ? String(chosenCharity.min_pct) : current);
    }
  }, [chosenCharity]);

  const active = subscription?.status === 'active' && (!subscription.current_period_end || new Date(subscription.current_period_end) > new Date());
  const charityMinimum = Number(chosenCharity?.min_pct || 10);
  const pctNumber = Number(charityPct);
  const allocationValid = Number.isInteger(pctNumber) && pctNumber >= charityMinimum && pctNumber <= 100;

  async function checkout() {
    if (!planId || !chosenCharity || !allocationValid) {
      setError(`Choose a plan and a charity percentage between ${charityMinimum}% and 100%.`);
      return;
    }
    setError('');
    setMessage('');
    setBusy(true);
    try {
      const res = await endpoints.subscription.checkout({ planId, charityId, charityPct: pctNumber });
      if (!res.data?.url) throw new Error('Stripe Checkout did not return a redirect URL.');
      window.location.href = res.data.url;
    } catch (e) {
      setError(extractApiError(e, 'Could not start Stripe Checkout.'));
      setBusy(false);
    }
  }

  async function cancel() {
    if (!window.confirm('Request cancellation of the active subscription?')) return;
    setBusy(true);
    setError('');
    try {
      await endpoints.subscription.cancel();
      setMessage('Cancellation requested. Stripe lifecycle events determine the final subscription state.');
      await load();
    } catch (e) {
      setError(extractApiError(e, 'Could not request cancellation.'));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Loading label="Loading plans..." />;
  return (
    <div>
      <SectionHeading eyebrow="Membership" title="Choose your plan and cause." description="Pick a recurring plan and the charity share you want to contribute. Stripe handles payment and the backend finalizes membership state from verified events." />
      {error && <Alert>{error}</Alert>}
      {message && <Alert type="success">{message}</Alert>}

      {active ? (
        <section className="mb-8 rounded-3xl border border-emerald-400/15 bg-emerald-400/[0.06] p-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-2"><Badge tone="green">Active</Badge><span className="text-sm text-slate-400">Your membership is live.</span></div>
              <p className="mt-3 text-sm text-slate-300">Charity contribution: <strong>{subscription.charity_pct}%</strong> · Prize pool: <strong>{subscription.pool_pct_snapshot}%</strong></p>
              <p className="mt-1 text-sm text-slate-500">Current period ends {formatDate(subscription.current_period_end)}</p>
            </div>
            <Button variant="danger" disabled={busy} onClick={cancel}>{busy ? 'Processing...' : 'Request cancellation'}</Button>
          </div>
        </section>
      ) : (
        <section className="grid gap-5 md:grid-cols-2">
          {plans.map((plan) => (
            <button type="button" key={plan.id} onClick={() => setPlanId(plan.id)} aria-pressed={String(planId) === String(plan.id)} className={`rounded-3xl border p-6 text-left transition ${String(planId) === String(plan.id) ? 'border-cyan-300/50 bg-cyan-300/[0.06]' : 'border-white/10 bg-white/[0.035] hover:bg-white/[0.055]'}`}>
              <div className="flex items-center justify-between"><h2 className="text-xl font-semibold text-white">{plan.name}</h2>{String(planId) === String(plan.id) && <Badge tone="cyan">Selected</Badge>}</div>
              <p className="mt-4 text-3xl font-semibold text-white">{formatMoney(plan.price_minor, plan.currency)}<span className="text-sm font-normal text-slate-500"> / {statusLabel(plan.interval)}</span></p>
              <p className="mt-3 text-sm leading-6 text-slate-400">Recurring membership with monthly draw participation while the subscription remains entitled.</p>
            </button>
          ))}
        </section>
      )}

      {!active && (
        <section className="mt-7 rounded-3xl border border-white/10 bg-white/[0.035] p-6">
          <h2 className="text-xl font-semibold text-white">Charity allocation</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">The minimum share is set by the selected charity. The backend also enforces the platform's overall allocation ceiling.</p>
          <form onSubmit={(e) => { e.preventDefault(); checkout(); }} className="mt-6 grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
            <label className="text-sm text-slate-300"><span className="mb-2 block text-xs uppercase tracking-wide text-slate-500">Charity</span><select required value={charityId} onChange={(e) => { setCharityId(e.target.value); setCharityPct(''); }} className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/20"><option value="">Select charity</option>{charities.map((charity) => <option key={charity.id} value={charity.id}>{charity.name} · min {charity.min_pct}%</option>)}</select></label>
            <label className="text-sm text-slate-300"><span className="mb-2 block text-xs uppercase tracking-wide text-slate-500">Charity contribution %</span><input required type="number" min={charityMinimum} max="100" step="1" value={charityPct} onChange={(e) => setCharityPct(e.target.value)} className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/20" aria-describedby="charity-help" /><span id="charity-help" className="mt-1 block text-xs text-slate-500">Allowed: {charityMinimum}%–100%.</span></label>
            <Button type="submit" disabled={busy || !planId || !charityId || !allocationValid}>{busy ? 'Opening Checkout...' : 'Continue to Stripe'}</Button>
          </form>
        </section>
      )}
      <p className="mt-6 text-xs text-slate-500">Payment card details are handled by Stripe Checkout; this frontend never collects or stores card data.</p>
    </div>
  );
}
