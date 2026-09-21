import { Routes, Route } from 'react-router-dom';
import AppShell from './components/AppShell';
import ProtectedRoute from './components/ProtectedRoute';
import HomePage from './pages/HomePage';
import CharitiesPage from './pages/CharitiesPage';
import CharityDetailPage from './pages/CharityDetailPage';
import DrawsPage from './pages/DrawsPage';
import DrawDetailPage from './pages/DrawDetailPage';
import DashboardPage from './pages/DashboardPage';
import ScoresPage from './pages/ScoresPage';
import SubscriptionPage from './pages/SubscriptionPage';
import WinningsPage from './pages/WinningsPage';
import SettingsPage from './pages/SettingsPage';
import { LoginPage, SignupPage } from './pages/AuthPages';
import AdminDashboardPage from './pages/AdminDashboardPage';
import AdminUsersPage from './pages/AdminUsersPage';
import AdminSubscriptionsPage from './pages/AdminSubscriptionsPage';
import AdminDrawsPage from './pages/AdminDrawsPage';
import AdminWinnersPage from './pages/AdminWinnersPage';
import AdminCharitiesPage from './pages/AdminCharitiesPage';
import NotFoundPage from './pages/NotFoundPage';

export default function App(){
  return <Routes>
    <Route element={<AppShell />}>
      <Route index element={<HomePage />} />
      <Route path="charities" element={<CharitiesPage />} />
      <Route path="charities/:id" element={<CharityDetailPage />} />
      <Route path="draws" element={<DrawsPage />} />
      <Route path="draws/:id" element={<DrawDetailPage />} />
      <Route path="login" element={<LoginPage />} />
      <Route path="signup" element={<SignupPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="scores" element={<ScoresPage />} />
        <Route path="subscription" element={<SubscriptionPage />} />
        <Route path="winnings" element={<WinningsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route element={<ProtectedRoute admin />}>
        <Route path="admin" element={<AdminDashboardPage />} />
        <Route path="admin/users" element={<AdminUsersPage />} />
        <Route path="admin/subscriptions" element={<AdminSubscriptionsPage />} />
        <Route path="admin/draws" element={<AdminDrawsPage />} />
        <Route path="admin/winners" element={<AdminWinnersPage />} />
        <Route path="admin/charities" element={<AdminCharitiesPage />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Route>
  </Routes>;
}
