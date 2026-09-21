import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { endpoints } from '../api/endpoints';
import { extractApiError } from '../api/client';
import Loading from '../components/Loading';
import Alert from '../components/Alert';
import Badge from '../components/Badge';
import Button from '../components/Button';
import { useAuth } from '../context/AuthContext';
import { formatDate } from '../lib/format';

function safeHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : '';
  } catch {
    return '';
  }
}

export default function CharityDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [charity, setCharity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    endpoints.charities.get(id)
      .then((res) => alive && setCharity(res.data))
      .catch((e) => alive && setError(extractApiError(e, 'Could not load this charity.')))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [id]);

  if (loading) return <Loading label="Loading charity profile..." />;
  if (error) return <Alert>{error}</Alert>;
  if (!charity) return <Alert>Charity not found.</Alert>;

  return (
    <div className="space-y-8">
      <Link to="/charities" className="text-sm text-slate-400 hover:text-white">← Back to charities</Link>
      <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.03]">
        <div className="grid lg:grid-cols-[0.9fr_1.1fr]">
          <div className="min-h-72 bg-slate-900">
            {Array.isArray(charity.images) && charity.images[0] ? (
              <img src={charity.images[0]} alt={`${charity.name} charity`} className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full min-h-72 place-items-center text-sm text-slate-500">No image available</div>
            )}
          </div>
          <div className="p-7 md:p-10">
            <div className="flex flex-wrap items-center gap-2"><Badge tone="cyan">Minimum {charity.min_pct}%</Badge>{charity.is_active === false && <Badge tone="red">Inactive</Badge>}</div>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white">{charity.name}</h1>
            <p className="mt-5 whitespace-pre-line text-base leading-7 text-slate-300">{charity.description || 'Learn more about this participating charity.'}</p>
            {charity.is_active !== false && (
              <Link to={user ? `/subscription?charity=${encodeURIComponent(charity.id)}` : `/signup?charity=${encodeURIComponent(charity.id)}`}>
                <Button className="mt-7">Support this charity</Button>
              </Link>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <ContentCard title="Upcoming events">
          {charity.events?.length ? charity.events.map((event) => (
            <article key={event.id} className="border-b border-white/5 py-4 first:pt-0 last:border-0 last:pb-0">
              <div className="flex items-start justify-between gap-4"><h3 className="font-medium text-white">{event.title}</h3>{event.date && <span className="text-xs text-slate-500">{formatDate(event.date)}</span>}</div>
              {event.description && <p className="mt-2 text-sm leading-6 text-slate-400">{event.description}</p>}
            </article>
          )) : <p className="text-sm text-slate-500">No events have been published yet.</p>}
        </ContentCard>

        <ContentCard title="Media and updates">
          {charity.media?.length ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {charity.media.map((item) => {
                const href = safeHttpUrl(item.url);
                if (!href) return null;
                const type = String(item.media_type || 'image').toLowerCase();
                return <a key={item.id} href={href} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-2xl border border-white/10 bg-slate-950/40 p-3 hover:bg-white/[0.04]">
                  {type === 'image' ? <img src={href} alt={item.title || `${charity.name} media`} className="aspect-video w-full rounded-xl object-cover" onError={(e) => { e.currentTarget.alt = 'Media preview unavailable'; }} /> : <div className="grid aspect-video place-items-center rounded-xl bg-slate-900 text-sm text-slate-400">{type === 'video' ? 'Open video' : 'Open link'}</div>}
                  <p className="mt-3 text-sm text-slate-300 group-hover:text-white">{item.title || 'Open media'}</p>
                </a>;
              })}
            </div>
          ) : <p className="text-sm text-slate-500">No media has been published yet.</p>}
        </ContentCard>
      </section>
    </div>
  );
}

function ContentCard({ title, children }) {
  return <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-6"><h2 className="text-xl font-semibold text-white">{title}</h2><div className="mt-5">{children}</div></section>;
}
