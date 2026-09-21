import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { endpoints } from '../api/endpoints';
import { extractApiError } from '../api/client';
import SectionHeading from '../components/SectionHeading';
import Loading from '../components/Loading';
import Alert from '../components/Alert';
import EmptyState from '../components/EmptyState';
import Badge from '../components/Badge';
import { formatMoney, formatMonth } from '../lib/format';

export default function DrawsPage() {
  const [draws,setDraws]=useState([]); const [loading,setLoading]=useState(true); const [error,setError]=useState('');
  useEffect(()=>{ endpoints.draws.list().then(r=>setDraws(r.data.draws||[])).catch(e=>setError(extractApiError(e,'Could not load draws.'))).finally(()=>setLoading(false)); },[]);
  if(loading) return <Loading label="Loading published draws..."/>;
  return <div><SectionHeading eyebrow="Draw history" title="Published draw results." description="Published months are immutable. Winning numbers and any personal winnings are served by the backend." />{error&&<Alert>{error}</Alert>}{draws.length===0?<EmptyState title="No published draws" description="The first published monthly draw will appear here."/>:<div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{draws.map(draw=><Link key={draw.id} to={`/draws/${draw.id}`} className="rounded-3xl border border-white/10 bg-white/[0.035] p-6 hover:bg-white/[0.055]"><div className="flex items-center justify-between"><span className="text-xs uppercase tracking-wide text-slate-600">{formatMonth(draw.month)}</span><Badge tone="green">Published</Badge></div><p className="mt-6 text-3xl font-semibold tracking-tight text-white">{formatMoney(draw.total_pool_minor)}</p><p className="mt-1 text-sm text-slate-500">Total pool</p><div className="mt-5 flex items-center justify-between text-xs text-slate-500"><span>Jackpot rollover</span><span>{formatMoney(draw.jackpot_carry_out)}</span></div><p className="mt-6 text-sm font-medium text-slate-300">Open result →</p></Link>)}</div>}</div>;
}
