import { useAuth } from '../context/AuthContext';
import SectionHeading from '../components/SectionHeading';
import Badge from '../components/Badge';

export default function SettingsPage() {
  const { user } = useAuth();
  return <div><SectionHeading eyebrow="Account" title="Your account settings." description="Your identity and role are loaded from the authenticated backend session."/><section className="max-w-2xl rounded-3xl border border-white/10 bg-white/[0.035] p-6"><div className="space-y-5"><Row label="Email" value={user?.email}/><Row label="Role"><Badge tone={user?.role==='admin'?'cyan':'slate'}>{user?.role}</Badge></Row></div><p className="mt-7 rounded-2xl border border-white/10 bg-slate-950/30 p-4 text-sm leading-6 text-slate-400">Subscription access, draw eligibility, winner ownership, and payout state are validated by the backend. Account email changes are managed through the admin workflow in this assignment build.</p></section></div>;
}
function Row({label,value,children}){return <div className="flex flex-col gap-2 border-b border-white/5 pb-5 last:border-0 sm:flex-row sm:items-center sm:justify-between"><span className="text-sm text-slate-500">{label}</span>{children||<span className="break-all text-sm text-slate-200">{value}</span>}</div>}
