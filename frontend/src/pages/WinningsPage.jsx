import { useEffect, useState } from 'react';
import { endpoints } from '../api/endpoints';
import { extractApiError } from '../api/client';
import SectionHeading from '../components/SectionHeading';
import Loading from '../components/Loading';
import Alert from '../components/Alert';
import EmptyState from '../components/EmptyState';
import Badge from '../components/Badge';
import Button from '../components/Button';
import { formatMoney, formatMonth, statusLabel } from '../lib/format';

const MAX_PROOF_BYTES = 5 * 1024 * 1024;
const VALID_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

export default function WinningsPage() {
  const [winnings, setWinnings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState('');

  async function load({ silent = false } = {}) {
    if (!silent) setLoading(true);
    try {
      const res = await endpoints.winners.mine();
      setWinnings(res.data.winnings || []);
    } catch (e) {
      setError(extractApiError(e, 'Could not load winnings.'));
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function upload(id, file) {
    if (!file) return;
    const input = document.querySelector(`[data-proof-input="${id}"]`);
    if (file.size > MAX_PROOF_BYTES) {
      setError('Proof image must be 5 MB or smaller.');
      if (input) input.value = '';
      return;
    }
    if (!VALID_TYPES.has(file.type)) {
      setError('Proof must be a PNG, JPEG, or WEBP image.');
      if (input) input.value = '';
      return;
    }
    setBusy(id);
    setError('');
    setMessage('');
    try {
      const form = new FormData();
      form.append('proof', file);
      await endpoints.winners.uploadProof(id, form);
      setMessage('Proof uploaded for admin review.');
      await load({ silent: true });
    } catch (e) {
      setError(extractApiError(e, 'Could not upload proof.'));
    } finally {
      setBusy('');
      if (input) input.value = '';
    }
  }

  async function viewProof(id) {
    // Open synchronously so browsers do not treat the signed URL as a popup.
    const popup = window.open('', '_blank', 'noopener,noreferrer');
    if (!popup) {
      setError('Your browser blocked the proof window. Allow popups for this site and try again.');
      return;
    }
    setBusy(`view-${id}`);
    setError('');
    try {
      const res = await endpoints.winners.proof(id);
      popup.location = res.data.url;
      popup.opener = null;
    } catch (e) {
      popup.close();
      setError(extractApiError(e, 'Could not open proof.'));
    } finally {
      setBusy('');
    }
  }

  if (loading) return <Loading label="Loading winnings..." />;
  return (
    <div>
      <SectionHeading eyebrow="Prize center" title="Your winnings and proof status." description="Proof images stay private and are only made available through an authorized, short-lived signed URL." />
      {error && <Alert>{error}</Alert>}
      {message && <Alert type="success">{message}</Alert>}
      {winnings.length === 0 ? <EmptyState title="No winnings yet" description="Published draw results will appear here when your retained ticket matches a winning tier." /> : <div className="grid gap-5 md:grid-cols-2">{winnings.map((win) => <article key={win.id} className="rounded-3xl border border-white/10 bg-white/[0.035] p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-wide text-slate-500">{formatMonth(win.month)}</p><h2 className="mt-2 text-2xl font-semibold text-white">Tier {win.tier}</h2></div><Badge tone={win.status === 'paid' ? 'green' : 'yellow'}>{statusLabel(win.status)}</Badge></div><p className="mt-4 text-3xl font-semibold text-white">{formatMoney(win.payout_minor)}</p><p className="mt-4 text-sm text-slate-500">Proof status: <span className="text-slate-300">{statusLabel(win.proof_status) || 'Not uploaded'}</span></p><div className="mt-6 flex flex-wrap gap-2">{win.proof_status && <Button variant="secondary" disabled={busy === `view-${win.id}`} onClick={() => viewProof(win.id)}>{busy === `view-${win.id}` ? 'Opening...' : 'View latest proof'}</Button>}{win.status !== 'paid' && win.proof_status !== 'approved' && <label className="inline-flex cursor-pointer items-center rounded-xl border border-white/15 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-white hover:bg-white/[0.08]">{busy === win.id ? 'Uploading...' : 'Upload proof'}<input data-proof-input={win.id} type="file" accept="image/png,image/jpeg,image/webp" hidden disabled={busy === win.id} onChange={(e) => upload(win.id, e.target.files?.[0])} /></label>}</div></article>)}</div>}
    </div>
  );
}
