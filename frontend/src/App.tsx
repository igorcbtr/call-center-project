import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from './store/store';
import { Layout } from './layout/Layout';
import { LoginPage } from './features/auth/LoginPage';
import { RegisterPage } from './features/auth/RegisterPage';
import { UsersTab } from './features/admin/UsersTab';
import { ScheduleTab } from './features/admin/ScheduleTab';
import { ChangeRequestsTab } from './features/admin/ChangeRequestsTab';
import { LimitsTab } from './features/admin/LimitsTab';
import { StatsTab } from './features/admin/StatsTab';
import { QrTab } from './features/admin/QrTab';
import { EmployeeProfile } from './features/admin/EmployeeProfile';
import { DashboardPage } from './features/operator/DashboardPage';
import { ScanPage } from './features/scan/ScanPage';
import { DocumentsPage } from './features/documents/DocumentsPage';
import { TasksPage } from './features/tasks/TasksPage';
import { AttendancePage } from './features/moderator/AttendancePage';
import { useAuth } from './hooks/useAuth';
import { AppToast } from './components/common/Toast';
import { useMeQuery } from './api/api';
import { useEffect } from 'react';

function MeSync() {
  const { data: me } = useMeQuery();
  useEffect(() => { if (me) localStorage.setItem('mvp_user', JSON.stringify(me)); }, [me]);
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

function RequireAdminOrMod() {
  const { role } = useAuth();
  if (!['admin','moderator'].includes(role||'')) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

function RequireStaff() {
  const { role } = useAuth();
  if (role === 'admin') return <Navigate to="/admin/employees" replace />;
  if (role === 'moderator') return <Navigate to="/mod/schedule" replace />;
  return <Outlet />;
}

function CatchAll() {
  const { isAuthenticated, role } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (role === 'admin') return <Navigate to="/admin/employees" replace />;
  if (role === 'moderator') return <Navigate to="/mod/schedule" replace />;
  return <Navigate to="/dashboard" replace />;
}

export default function App() {
  return (
    <Provider store={store}>
      <BrowserRouter>
        <AppToast />
        <Routes>
          <Route path="/login"    element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/scan"     element={<ScanPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/documents" element={<DocumentsPage />} />
              {/* Admin only */}
              <Route element={<RequireAdmin />}>
                <Route path="/admin/employees"     element={<UsersTab />} />
                <Route path="/admin/employees/:id" element={<EmployeeProfile />} />
                <Route path="/admin/schedule"      element={<ScheduleTab />} />
                <Route path="/admin/requests"      element={<ChangeRequestsTab />} />
                <Route path="/admin/limits"        element={<LimitsTab />} />
                <Route path="/admin/qr"            element={<QrTab />} />
                <Route path="/admin/stats"         element={<StatsTab />} />
                <Route path="/admin/attendance"    element={<AttendancePage />} />
                <Route path="/admin/tasks"         element={<TasksPage />} />
                <Route path="/admin/documents"     element={<DocumentsPage />} />
                <Route path="/admin"               element={<Navigate to="/admin/employees" replace />} />
              </Route>
              {/* Admin + Moderator */}
              <Route element={<RequireAdminOrMod />}>
                <Route path="/mod/schedule"      element={<ScheduleTab />} />
                <Route path="/mod/employees"     element={<UsersTab />} />
                <Route path="/mod/employees/:id" element={<EmployeeProfile />} />
                <Route path="/mod/requests"      element={<ChangeRequestsTab />} />
                <Route path="/mod/attendance"    element={<AttendancePage />} />
                <Route path="/mod/tasks"         element={<TasksPage />} />
                <Route path="/mod/documents"     element={<DocumentsPage />} />
                <Route path="/mod"               element={<Navigate to="/mod/schedule" replace />} />
              </Route>
              {/* Staff */}
              <Route element={<RequireStaff />}>
                <Route path="/dashboard"  element={<DashboardPage />} />
                <Route path="/attendance" element={<AttendancePage />} />
                <Route path="/tasks"      element={<TasksPage />} />
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<CatchAll />} />
        </Routes>
      </BrowserRouter>
    </Provider>
  );
}
