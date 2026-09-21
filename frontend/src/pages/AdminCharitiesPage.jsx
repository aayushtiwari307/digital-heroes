import { useEffect, useState } from 'react';
import { endpoints } from '../api/endpoints';
import { extractApiError } from '../api/client';
import SectionHeading from '../components/SectionHeading';
import Alert from '../components/Alert';
import Button from '../components/Button';
import Badge from '../components/Badge';
import AdminNav from '../components/AdminNav';
import { formatDate } from '../lib/format';

const blank = { name: '', description: '', minPct: 10 };
const blankEvent = { title: '', date: '', description: '' };
const blankMedia = { mediaType: 'image', url: '', title: '' };

export default function AdminCharitiesPage() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState(null);
  const [contentCharity, setContentCharity] = useState(null);
  const [eventForm, setEventForm] = useState(blankEvent);
  const [mediaForm, setMediaForm] = useState(blankMedia);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function load() {
    try {
      const r = await endpoints.charities.list();
      setRows(r.data.charities || []);
    } catch (e) {
      setError(extractApiError(e, 'Could not load charities.'));
    }
  }

  useEffect(() => { load(); }, []);

  async function submit(e) {
    e.preventDefault();
    setBusy('charity'); setError(''); setMessage('');
    try {
      const payload = { name: form.name.trim(), description: form.description.trim(), minPct: Number(form.minPct) };
      if (editing) await endpoints.charities.update(editing, payload); else await endpoints.charities.create(payload);
      setForm(blank); setEditing(null); setMessage(editing ? 'Charity updated.' : 'Charity created.'); await load();
    } catch (err) {
      setError(extractApiError(err, 'Could not save charity.'));
    } finally { setBusy(''); }
  }

  async function deactivate(id) {
    if (!window.confirm('Deactivate this charity? Historical records remain.')) return;
    setBusy(`deactivate-${id}`); setError('');
    try { await endpoints.charities.deactivate(id); await load(); setMessage('Charity deactivated.'); } catch (e) { setError(extractApiError(e, 'Could not deactivate charity.')); } finally { setBusy(''); }
  }

  async function openContent(charity) {
    setError(''); setMessage(''); setBusy(`content-${charity.id}`);
    try {
      const r = await endpoints.charities.adminGet(charity.id);
      setContentCharity(r.data);
    } catch (e) {
      setError(extractApiError(e, 'Could not load charity content.'));
    } finally { setBusy(''); }
  }

  async function createEvent(e) {
    e.preventDefault();
    if (!contentCharity) return;
    setBusy('event'); setError('');
    try {
      await endpoints.charities.createEvent(contentCharity.id, { ...eventForm, date: eventForm.date || null });
      const r = await endpoints.charities.adminGet(contentCharity.id);
      setContentCharity(r.data); setEventForm(blankEvent); setMessage('Event added.');
    } catch (err) { setError(extractApiError(err, 'Could not create event.')); } finally { setBusy(''); }
  }

  async function deleteEvent(id) {
    if (!contentCharity || !window.confirm('Delete this event?')) return;
    setBusy(`delete-event-${id}`); setError('');
    try { await endpoints.charities.deleteEvent(contentCharity.id, id); const r = await endpoints.charities.adminGet(contentCharity.id); setContentCharity(r.data); setMessage('Event deleted.'); } catch (e) { setError(extractApiError(e, 'Could not delete event.')); } finally { setBusy(''); }
  }

  async function createMedia(e) {
    e.preventDefault();
    if (!contentCharity) return;
    setBusy('media'); setError('');
    try { await endpoints.charities.createMedia(contentCharity.id, mediaForm); const r = await endpoints.charities.adminGet(contentCharity.id); setContentCharity(r.data); setMediaForm(blankMedia); setMessage('Media added.'); } catch (err) { setError(extractApiError(err, 'Could not add media.')); } finally { setBusy(''); }
  }

  async function deleteMedia(id) {
    if (!contentCharity || !window.confirm('Delete this media item?')) return;
    setBusy(`delete-media-${id}`); setError('');
    try { await endpoints.charities.deleteMedia(contentCharity.id, id); const r = await endpoints.charities.adminGet(contentCharity.id); setContentCharity(r.data); setMessage('Media deleted.'); } catch (e) { setError(extractApiError(e, 'Could not delete media.')); } finally { setBusy(''); }
  }

  return <div><AdminNav /><SectionHeading eyebrow="Administration" title="Charities" description="Manage participating charity details and the public events/media associated with them." />{error && <Alert>{error}</Alert>}{message && <Alert type="success">{message}</Alert>}<section className="mb-7 rounded-3xl border border-white/10 bg-white/[0.035] p-6"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold text-white">{editing ? 'Edit charity' : 'Add charity'}</h2>{editing && <Button variant="ghost" onClick={() => { setEditing(null); setForm(blank); }}>Cancel</Button>}</div><form onSubmit={submit} className="mt-5 space-y-4"><label className="block text-sm text-slate-300"><span className="mb-2 block text-xs uppercase tracking-wide text-slate-500">Name</span><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white focus:ring-2 focus:ring-cyan-300/20" /></label><label className="block text-sm text-slate-300"><span className="mb-2 block text-xs uppercase tracking-wide text-slate-500">Description</span><textarea rows="4" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white focus:ring-2 focus:ring-cyan-300/20" /></label><div className="flex flex-wrap items-end gap-4"><label className="text-sm text-slate-300"><span className="mb-2 block text-xs uppercase tracking-wide text-slate-500">Minimum %</span><input required type="number" min="10" max="100" step="1" value={form.minPct} onChange={(e) => setForm({ ...form, minPct: e.target.value })} className="w-32 rounded-xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white" /></label><Button type="submit" disabled={busy === 'charity'}>{busy === 'charity' ? 'Saving...' : editing ? 'Save charity' : 'Create charity'}</Button></div></form></section><div className="grid gap-5 md:grid-cols-2">{rows.map((c) => <article key={c.id} className="rounded-3xl border border-white/10 bg-white/[0.035] p-6"><div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-semibold text-white">{c.name}</h2><p className="mt-1 text-xs text-slate-500">Minimum contribution {c.min_pct}%</p></div><Badge tone={c.is_active === false ? 'red' : 'green'}>{c.is_active === false ? 'Inactive' : 'Active'}</Badge></div><p className="mt-4 line-clamp-3 text-sm leading-6 text-slate-400">{c.description || 'No description.'}</p><div className="mt-5 flex flex-wrap gap-2"><Button variant="secondary" onClick={() => { setEditing(c.id); setForm({ name: c.name, description: c.description || '', minPct: c.min_pct }); }}>Edit</Button>{c.is_active !== false && <Button variant="danger" disabled={busy === `deactivate-${c.id}`} onClick={() => deactivate(c.id)}>Deactivate</Button>}<Button variant="ghost" disabled={busy === `content-${c.id}`} onClick={() => openContent(c)}>{busy === `content-${c.id}` ? 'Loading...' : 'Manage content'}</Button></div></article>)}</div>
    {contentCharity && <section className="mt-7 rounded-3xl border border-cyan-300/10 bg-cyan-300/[0.03] p-6"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs uppercase tracking-wide text-cyan-300">Content manager</p><h2 className="mt-2 text-2xl font-semibold text-white">{contentCharity.name}</h2></div><Button variant="ghost" onClick={() => setContentCharity(null)}>Close</Button></div><div className="mt-7 grid gap-6 lg:grid-cols-2"><div><h3 className="text-lg font-semibold text-white">Events</h3><form onSubmit={createEvent} className="mt-4 space-y-3"><input required placeholder="Event title" value={eventForm.title} onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })} className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white" /><input type="date" value={eventForm.date} onChange={(e) => setEventForm({ ...eventForm, date: e.target.value })} className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white" /><textarea rows="3" placeholder="Description" value={eventForm.description} onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })} className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white" /><Button type="submit" disabled={busy === 'event'}>{busy === 'event' ? 'Adding...' : 'Add event'}</Button></form><div className="mt-5 space-y-3">{contentCharity.events?.length ? contentCharity.events.map((event) => <div key={event.id} className="rounded-2xl border border-white/10 bg-slate-950/30 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-medium text-white">{event.title}</p>{event.date && <p className="mt-1 text-xs text-slate-500">{formatDate(event.date)}</p>}</div><Button variant="danger" disabled={busy === `delete-event-${event.id}`} onClick={() => deleteEvent(event.id)}>Delete</Button></div>{event.description && <p className="mt-2 text-sm leading-6 text-slate-400">{event.description}</p>}</div>) : <p className="text-sm text-slate-500">No events yet.</p>}</div></div><div><h3 className="text-lg font-semibold text-white">Media</h3><form onSubmit={createMedia} className="mt-4 space-y-3"><select value={mediaForm.mediaType} onChange={(e) => setMediaForm({ ...mediaForm, mediaType: e.target.value })} className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white"><option value="image">Image</option><option value="video">Video</option><option value="link">Link</option></select><input required type="url" placeholder="https://..." value={mediaForm.url} onChange={(e) => setMediaForm({ ...mediaForm, url: e.target.value })} className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white" /><input placeholder="Title" value={mediaForm.title} onChange={(e) => setMediaForm({ ...mediaForm, title: e.target.value })} className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white" /><Button type="submit" disabled={busy === 'media'}>{busy === 'media' ? 'Adding...' : 'Add media'}</Button></form><div className="mt-5 space-y-3">{contentCharity.media?.length ? contentCharity.media.map((item) => <div key={item.id} className="rounded-2xl border border-white/10 bg-slate-950/30 p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-medium text-white">{item.title || item.media_type}</p><p className="mt-1 break-all text-xs text-slate-500">{item.url}</p></div><Button variant="danger" disabled={busy === `delete-media-${item.id}`} onClick={() => deleteMedia(item.id)}>Delete</Button></div></div>) : <p className="text-sm text-slate-500">No media yet.</p>}</div></div></div></section>}
  </div>;
}
