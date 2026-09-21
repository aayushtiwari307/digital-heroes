import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Loading from './Loading';

export default function ProtectedRoute({ admin = false }) {
  const { user, booting } = useAuth();
  const location = useLocation();

  if (booting) return <Loading label="Checking your session..." />;
  if (!user) {
    const next = `${location.pathname}${location.search || ''}${location.hash || ''}`;
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }
  if (admin && user.role !== 'admin') return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
