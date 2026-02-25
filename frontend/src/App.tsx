import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import MainLayout from './layouts/MainLayout';
import { ThemeProvider } from './context/ThemeContext';
import { LanguageProvider } from './context/LanguageContext';
import { NotificationProvider } from './context/NotificationContext';
import { useState } from 'react';
import './index.css';
import SplashScreen from './components/common/SplashScreen';
import PageLoader from './components/common/PageLoader';

// Lazy load all page components for code splitting
const LoginPage = lazy(() => import('./pages/login/LoginPage'));
const HomePage = lazy(() => import('./pages/home/HomePage'));

// Admin pages
const AdminProfilePage = lazy(() => import('./pages/admin/profile/AdminProfilePage'));
const AdminManagementPage = lazy(() => import('./pages/admin/management/ManagementPage'));
const AdminReportsPage = lazy(() => import('./pages/admin/reports/ReportsPage'));
const AdminOperationsPage = lazy(() => import('./pages/admin/operations/OperationsPage'));
const AdminDatabasePage = lazy(() => import('./pages/admin/database/AdminDatabasePage'));
const ProjectSetupPage = lazy(() => import('./pages/admin/management/projectSetup'));
const NotificationMonitoringPage = lazy(() => import('./pages/admin/operations/NotificationMonitoringPage'));

// Manager pages
const ManagerProfilePage = lazy(() => import('./pages/manager/profile/ManagerProfilePage'));
const ManagerManagementPage = lazy(() => import('./pages/manager/management/ManagementPage'));
const ManagerReportsPage = lazy(() => import('./pages/manager/reports/ReportsPage'));
const ManagerAllocationPage = lazy(() => import('./pages/manager/allocation/AllocationPage'));
const ManagerOperationsPage = lazy(() => import('./pages/manager/operations/OperationsPage'));
const ManagerPersonnelPage = lazy(() => import('./pages/manager/personnel/PersonnelPage'));
const ManagerHistoryPage = lazy(() => import('./pages/manager/history/HistoryPage'));
const SmartReportPage = lazy(() => import('./pages/manager/reports/smart-report/SmartReportPage'));

// User pages
const UserProfilePage = lazy(() => import('./pages/user/profile/UserProfilePage'));
const EnvironmentPage = lazy(() => import('./pages/user/environment/EnvironmentPage'));
const StatisticsPage = lazy(() => import('./pages/user/statistics/StatisticsPage'));
const UserHistoryPage = lazy(() => import('./pages/user/history/UserHistoryPage'));
const SettingsPage = lazy(() => import('./pages/user/settings/SettingsPage'));



// Simple Protected Route Component
const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
    const token = localStorage.getItem('token');
    if (!token) {
        return <Navigate to="/login" replace />;
    }
    return children;
};

// Public Route (redirect to home if already logged in)
const PublicRoute = ({ children }: { children: JSX.Element }) => {
    const token = localStorage.getItem('token');
    if (token) {
        return <Navigate to="/" replace />;
    }
    return children;
};

const AppRoutes = () => {
    return (
        <Suspense fallback={<PageLoader />}>
            <Routes>
                {/* Public Routes */}
                <Route
                    path="/login"
                    element={
                        <PublicRoute>
                            <LoginPage />
                        </PublicRoute>
                    }
                />

                {/* Protected Routes with MainLayout as Wrapper */}
                <Route element={
                    <ProtectedRoute>
                        <MainLayout />
                    </ProtectedRoute>
                }>
                    <Route path="/" element={<HomePage />} />

                    {/* Admin Routes */}
                    <Route path="/admin/profile" element={<AdminProfilePage />} />
                    <Route path="/admin/management" element={<AdminManagementPage />} />
                    <Route path="/admin/projects/:id/setup" element={<ProjectSetupPage />} />
                    <Route path="/admin/reports" element={<AdminReportsPage />} />
                    <Route path="/admin/operations" element={<AdminOperationsPage />} />
                    <Route path="/admin/database" element={<AdminDatabasePage />} />
                    <Route path="/admin/notification-monitoring" element={<NotificationMonitoringPage />} />

                    {/* Manager Routes */}
                    <Route path="/manager/profile" element={<ManagerProfilePage />} />
                    <Route path="/manager/management" element={<ManagerManagementPage />} />
                    <Route path="/manager/projects/:id/setup" element={<ProjectSetupPage />} />
                    <Route path="/manager/reports" element={<ManagerReportsPage />} />
                    <Route path="/manager/allocation" element={<ManagerAllocationPage />} />
                    <Route path="/manager/operations" element={<ManagerOperationsPage />} />
                    <Route path="/manager/personnel" element={<ManagerPersonnelPage />} />
                    <Route path="/manager/history" element={<ManagerHistoryPage />} />

                    {/* User/Engineer Routes */}
                    <Route path="/user/profile" element={<UserProfilePage />} />
                    <Route path="/user/environment" element={<EnvironmentPage />} />
                    <Route path="/user/statistics" element={<StatisticsPage />} />
                    <Route path="/user/history" element={<UserHistoryPage />} />
                    <Route path="/user/settings" element={<SettingsPage />} />
                </Route>

                {/* Fallback */}
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </Suspense>
    );
};



function App() {
    const [isLoading, setIsLoading] = useState(true);

    return (
        <ThemeProvider>
            <LanguageProvider>
                {isLoading ? (
                    <SplashScreen onFinish={() => setIsLoading(false)} duration={2000} />
                ) : (
                    <BrowserRouter>
                        <NotificationProvider>
                            <AppRoutes />
                        </NotificationProvider>
                    </BrowserRouter>
                )}
            </LanguageProvider>
        </ThemeProvider>
    );
}

export default App;

