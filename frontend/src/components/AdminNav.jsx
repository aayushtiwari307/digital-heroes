import { NavLink } from 'react-router-dom';

const items = [
  ['/admin', 'Overview', true],
  ['/admin/users', 'Users'],
  ['/admin/subscriptions', 'Subscriptions'],
  ['/admin/draws', 'Draws'],
  ['/admin/winners', 'Winners'],
  ['/admin/charities', 'Charities'],
];

export default function AdminNav() {
  return (
    <nav aria-label="Admin navigation" className="mb-8 flex gap-2 overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.025] p-2">
      {items.map(([to, label, end]) => (
        <NavLink key={to} to={to} end={end} className={({ isActive }) => `whitespace-nowrap rounded-xl px-3 py-2 text-sm transition ${isActive ? 'bg-white text-slate-950' : 'text-slate-400 hover:bg-white/[0.06] hover:text-white'}`}>
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
