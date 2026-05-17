import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from './store/store';
import { Layout } from './layout/Layout';
import { LoginPage } from './features/auth/LoginPage';
import { UsersTab } from './features/admin/UsersTab';
import { ScheduleTab } from './features/admin/ScheduleTab';
import { ChangeRequestsTab } from './features/admin/ChangeRequestsTab';
import { LimitsTab } from './features/admin/LimitsTab';
import { StatsTab } from './features/admin/StatsTab';
import { DashboardPage } from './features/operator/DashboardPage';
import { useAuth } from './hooks/useAuth';
import { AppToast } from './components/common/Toast';
import { useMeQuery } from './api/api';
import { useEffect } from 'react';

function MeSync() {
  const { data: me } = useMeQuery();
  useEffect(() => {
    if (me) localStorage.setItem('mvp_user', JSON.stringify(me));
  }, [me]);
  return null;
}

function ProtectedRoute() {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <><MeSync /><Outlet /></>;
}

function RequireAdmin() {
  const { role } = useAuth();
  if (role !== 'admin') return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

function RequireStaff() {
  const { role } = useAuth();
  if (role === 'admin') return <Navigate to="/admin/employees" replace />;
  return <Outlet />;
}

function CatchAll() {
  const { isAuthenticated, role } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (role === 'admin') return <Navigate to="/admin/employees" replace />;
  return <Navigate to="/dashboard" replace />;
}

export default function App() {
  return (
    <Provider store={store}>
      <BrowserRouter>
        <AppToast />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route element={<RequireAdmin />}>
                <Route path="/admin/employees" element={<UsersTab />} />
                <Route path="/admin/schedule" element={<ScheduleTab />} />
                <Route path="/admin/requests" element={<ChangeRequestsTab />} />
                <Route path="/admin/limits" element={<LimitsTab />} />
                <Route path="/admin/stats" element={<StatsTab />} />
                <Route path="/admin" element={<Navigate to="/admin/employees" replace />} />
              </Route>
              <Route element={<RequireStaff />}>
                <Route path="/dashboard" element={<DashboardPage />} />
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<CatchAll />} />
        </Routes>
      </BrowserRouter>
    </Provider>
  );
}
