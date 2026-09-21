import { Link } from 'react-router-dom';

export default function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2.5 font-semibold text-white">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-slate-950 shadow-lg shadow-black/20">DH</span>
      <span className="tracking-tight">Digital Heroes</span>
    </Link>
  );
}
