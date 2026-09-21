import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { endpoints } from '../api/endpoints';
import { extractApiError } from '../api/client';
import SectionHeading from '../components/SectionHeading';
import Loading from '../components/Loading';
import Alert from '../components/Alert';
import EmptyState from '../components/EmptyState';

function CharityCard({ charity }) {
  const image = Array.isArray(charity.images) ? charity.images[0] : null;
  return (
    <Link to={`/charities/${charity.id}`} className="group overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035] transition hover:-translate-y-0.5 hover:bg-white/[0.06]">
      <div className="aspect-[16/9] overflow-hidden bg-slate-900">
        {image ? <img src={image} alt={`${charity.name} charity`} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /> : <div className="grid h-full place-items-center text-sm text-slate-600">Charity image</div>}
      </div>
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold text-white">{charity.name}</h2>
          <span className="rounded-full bg-cyan-400/10 px-2 py-1 text-[11px] text-cyan-200">min {charity.min_pct}%</span>
        </div>
        <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-400">{charity.description || 'Learn more about this participating charity.'}</p>
        <p className="mt-4 text-sm font-medium text-slate-300 group-hover:text-white">View charity →</p>
      </div>
    </Link>
  );
}

export default function CharitiesPage() {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [charities, setCharities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true); setError('');
    endpoints.charities.list(query).then((res) => { if (alive) setCharities(res.data.charities || []); }).catch((e) => { if (alive) setError(extractApiError(e, 'Could not load charities.')); }).finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [query]);

  const countLabel = useMemo(() => `${charities.length} ${charities.length === 1 ? 'charity' : 'charities'}`, [charities.length]);

  return (
    <div>
      <SectionHeading eyebrow="Directory" title="Choose a cause worth backing." description="Search active charities, open their profiles, and see the minimum contribution percentage they require." />
      <div className="mb-7 flex gap-2">
        <input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && setQuery(search.trim())} placeholder="Search charities..." aria-label="Search charities" className="w-full rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/20" />
        <button onClick={() => setQuery(search.trim())} className="rounded-xl bg-white px-5 text-sm font-semibold text-slate-950 hover:bg-slate-200">Search</button>
      </div>
      {!loading && <p className="mb-4 text-xs text-slate-500">{countLabel}</p>}
      {error && <Alert>{error}</Alert>}
      {loading ? <Loading label="Loading charities..." /> : charities.length === 0 ? <EmptyState title="No charities found" description="Try a different search term or check back once more causes have joined the platform." /> : <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{charities.map((charity) => <CharityCard key={charity.id} charity={charity} />)}</div>}
    </div>
  );
}
