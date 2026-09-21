import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Logo from './Logo';
import Button from './Button';

function NavItem({ to, children, end = false }) {
  return <NavLink to={to} end={end} className={({ isActive }) => `rounded-lg px-3 py-2 text-sm transition ${isActive ? 'bg-white/10 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>{children}</NavLink>;
}

export default function AppShell() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const adminArea = location.pathname.startsWith('/admin');
  return <div className="min-h-screen bg-slate-950 text-slate-100">
    <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-6">
        <div className="flex items-center gap-6"><Logo /><nav className="hidden items-center gap-1 md:flex"><NavItem to="/charities">Charities</NavItem><NavItem to="/draws">Draws</NavItem>{user && <NavItem to="/dashboard">Dashboard</NavItem>}{user?.role === 'admin' && <NavItem to="/admin">Admin</NavItem>}</nav></div>
        <div className="flex items-center gap-2">{user ? <><span className="hidden max-w-48 truncate text-xs text-slate-500 md:block">{user.email}</span><Link to="/settings" className="hidden rounded-lg px-3 py-2 text-sm text-slate-400 hover:bg-white/5 hover:text-white md:block">Account</Link><Button variant="ghost" onClick={logout}>Log out</Button></> : <><Link to="/login" className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-300 hover:text-white">Log in</Link><Link to="/signup" className="rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-slate-950 hover:bg-slate-200">Get started</Link></>}</div>
      </div>
      <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 pb-3 md:hidden md:px-6"><NavItem to="/charities">Charities</NavItem><NavItem to="/draws">Draws</NavItem>{user && <NavItem to="/dashboard">Dashboard</NavItem>}{user && <NavItem to="/settings">Account</NavItem>}{user?.role === 'admin' && <NavItem to="/admin">Admin</NavItem>}</div>
      {adminArea && <div className="border-t border-white/5 bg-black/10"><div className="mx-auto max-w-7xl px-4 py-2 text-xs text-slate-500 md:px-6">Administration area · server-side admin authorization remains authoritative.</div></div>}
    </header>
    <main className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-10"><Outlet /></main>
    <footer className="mt-12 border-t border-white/10"><div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-7 text-sm text-slate-500 md:flex-row md:items-center md:justify-between md:px-6"><p>Digital Heroes · play with purpose</p><Link to="/charities" className="hover:text-slate-200">Explore charities</Link></div></footer>
  </div>;
}
