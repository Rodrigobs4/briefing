
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './store/AuthContext';
import { SettingsProvider } from './store/SettingsContext';
import Login from './pages/auth/Login';
import MainLayout from './layouts/MainLayout';
import DashboardHub from './pages/dashboard/DashboardHub';
import AdminPanel from './pages/admin/AdminPanel';
import UsersPanel from './pages/admin/UsersPanel';
import SettingsPanel from './pages/admin/SettingsPanel';
import UserProfile from './pages/dashboard/UserProfile';

function App() {
    return (
        <SettingsProvider>
            <AuthProvider>
                <Routes>
                    <Route path="/login" element={<Login />} />

                    <Route element={<MainLayout />}>
                        <Route path="/dashboard" element={<DashboardHub />} />
                        <Route path="/dashboard/geral" element={<Navigate to="/dashboard" replace />} />
                        <Route path="/dashboard/regional" element={<Navigate to="/dashboard?view=regional" replace />} />
                        <Route path="/regional" element={<Navigate to="/dashboard?view=regional" replace />} />
                        <Route path="/admin" element={<AdminPanel />} />
                        <Route path="/admin/users" element={<UsersPanel />} />
                        <Route path="/admin/settings" element={<SettingsPanel />} />
                        <Route path="/profile" element={<UserProfile />} />
                        <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    </Route>
                </Routes>
            </AuthProvider>
        </SettingsProvider>
    );
}

export default App;
