import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { endpoints } from '../api/endpoints';
import { extractApiError } from '../api/client';
import SectionHeading from '../components/SectionHeading';
import StatCard from '../components/StatCard';
import Loading from '../components/Loading';
import Alert from '../components/Alert';
import AdminNav from '../components/AdminNav';
import { formatMoney, formatMonth, statusLabel } from '../lib/format';

export default function AdminDashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    endpoints.admin.reports().then((r) => setData(r.data)).catch((e) => setError(extractApiError(e, 'Could not load admin reports.'))).finally(() => setLoading(false));
  }, []);
  if (loading) return <Loading label="Loading admin overview..." />;
  return <div><AdminNav /><SectionHeading eyebrow="Administration" title="Platform overview." description="Monitor accounts, subscriptions, prize-pool funding, payouts, charities, and published draw history." />{error && <Alert>{error}</Alert>}{data && <><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><StatCard label="Users" value={data.totalUsers ?? '—'} /><StatCard label="Active subscribers" value={data.activeSubscribers ?? '—'} /><StatCard label="Prize-pool funding" value={formatMoney(data.totalPrizePoolFunding)} /><StatCard label="Total payouts" value={formatMoney(data.totalPayouts)} /></div><div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3"><StatCard label="Charity contributions" value={formatMoney(data.totalCharityContributions)} /><StatCard label="Current jackpot rollover" value={formatMoney(data.currentJackpotRollover)} /><StatCard label="Published unawarded" value={formatMoney(data.totalUnawarded)} /></div><div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3"><Tile to="/admin/users" title="Users" text="Review profiles, roles, and score records."/><Tile to="/admin/subscriptions" title="Subscriptions" text="Inspect billing lifecycle and charity allocations."/><Tile to="/admin/draws" title="Draw operations" text="Simulate, inspect, and publish monthly results."/><Tile to="/admin/winners" title="Winner review" text="Review private proof and advance approved winners to paid."/><Tile to="/admin/charities" title="Charities" text="Manage descriptions, events, and media."/></div><section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.035] p-6"><h2 className="text-xl font-semibold text-white">Recent draw records</h2><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead><tr className="border-b border-white/10 text-xs uppercase tracking-wider text-slate-500"><th className="px-3 py-3">Month</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Pool</th><th className="px-3 py-3">Carry in</th><th className="px-3 py-3">Carry out</th><th className="px-3 py-3">Winners</th></tr></thead><tbody>{(data.drawStatistics || []).map((row) => <tr key={`${row.month}-${row.status}`} className="border-b border-white/5"><td className="px-3 py-3 text-slate-300">{formatMonth(row.month)}</td><td className="px-3 py-3 text-slate-400">{statusLabel(row.status)}</td><td className="px-3 py-3 text-slate-300">{formatMoney(row.total_pool_minor)}</td><td className="px-3 py-3 text-slate-300">{formatMoney(row.jackpot_carry_in)}</td><td className="px-3 py-3 text-slate-300">{formatMoney(row.jackpot_carry_out)}</td><td className="px-3 py-3 text-slate-300">{row.winner_count}</td></tr>)}</tbody></table></div></section></>}</div>;
}
function Tile({ to, title, text }) { return <Link to={to} className="rounded-3xl border border-white/10 bg-white/[0.035] p-6 hover:bg-white/[0.055]"><h3 className="text-lg font-semibold text-white">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-400">{text}</p><p className="mt-5 text-sm text-cyan-300">Open section →</p></Link>; }
