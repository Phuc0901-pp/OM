import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import MainLayout from './layouts/MainLayout';
import { WebSocketProvider } from './contexts/WebSocketContext';
// Theme and Language are now managed via Zustand stores (src/stores/)
// No Provider needed — just import and use the store hooks directly
import { useState } from 'react';
import './index.css';
import SplashScreen from './components/common/SplashScreen';
import PageLoader from './components/common/PageLoader';

// Lazy load all page components for code splitting
const LoginPage = lazy(() => import('./pages/login/LoginPage'));
const HomePage = lazy(() => import('./pages/home/HomePage'));



// Manager pages
const ProjectSetupPage = lazy(() => import('./pages/manager/management/projectSetup'));
const ManagerProfilePage = lazy(() => import('./pages/manager/profile/ManagerProfilePage'));
const ManagerManagementPage = lazy(() => import('./pages/manager/management/ManagementPage'));
const ManagerReportsPage = lazy(() => import('./pages/manager/reports/ReportsPage'));
const ManagerAllocationPage = lazy(() => import('./pages/manager/allocation/AllocationPage'));
const ManagerOperationsPage = lazy(() => import('./pages/manager/operations/OperationsPage'));
const ManagerPersonnelPage = lazy(() => import('./pages/manager/personnel/PersonnelPage'));
const ManagerHistoryPage = lazy(() => import('./pages/manager/history/HistoryPage'));
const SmartReportPage = lazy(() => import('./pages/manager/reports/smart-report/SmartReportPage'));
const PublicReportPage = lazy(() => import('./pages/public/PublicReportPage'));
const PublicBulkReportPage = lazy(() => import('./pages/public/PublicBulkReportPage'));

// User pages
const UserProfilePage = lazy(() => import('./pages/user/profile/UserProfilePage'));
const EnvironmentPage = lazy(() => import('./pages/user/environment/EnvironmentPage'));
const StatisticsPage = lazy(() => import('./pages/user/statistics/StatisticsPage'));
const UserHistoryPage = lazy(() => import('./pages/user/history/UserHistoryPage'));
const SettingsPage = lazy(() => import('./pages/user/settings/SettingsPage'));



// Protected Route: redirects to /login if no token
const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
 const token = sessionStorage.getItem('token');
 if (!token) {
 return <Navigate to="/login" replace />;
 }
 return children;
};

// Public Route: redirects to / if already logged in
const PublicRoute = ({ children }: { children: JSX.Element }) => {
 const token = sessionStorage.getItem('token');
 if (token) {
 return <Navigate to="/" replace />;
 }
 return children;
};

// Root Route: if logged in → go to /, else → go to /login
const RootRedirect = () => {
 const token = sessionStorage.getItem('token');
 return <Navigate to={token ? '/' : '/login'} replace />;
};

const AppRoutes = () => {
 return (
 <Suspense fallback={<PageLoader />}>
 <Routes>
 {/* Root: smart redirect based on auth */}
 <Route path="/" element={<RootRedirect />} />

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
 {/* WebSocketProvider đặt ở đây đảm bảo chỉ có 1 WS connection duy nhất khi user đã login */}
 <Route element={
 <ProtectedRoute>
 <WebSocketProvider>
 <MainLayout />
 </WebSocketProvider>
 </ProtectedRoute>
 }>
 <Route path="/home" element={<HomePage />} />

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

 {/* Public Routes — no auth required */}
 <Route path="/share/report/:assignId" element={<PublicReportPage />} />
 <Route path="/share/bulk-report/:assignId" element={<PublicBulkReportPage />} />
 <Route path="/share/generated-report/:reportId" element={<PublicBulkReportPage />} />

 {/* Fallback */}
 <Route path="*" element={<Navigate to="/login" replace />} />
 </Routes>
 </Suspense>
 );
};



function App() {
 const [isLoading, setIsLoading] = useState(true);

 return (
 <>
 {isLoading ? (
 <SplashScreen onFinish={() => setIsLoading(false)} duration={2000} />
 ) : (
 <BrowserRouter>
 <>
 <AppRoutes />
 </>
 </BrowserRouter>
 )}
 </>
 );
}

export default App;
