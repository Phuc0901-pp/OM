import { useEffect, useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import ManagerDashboard from './ManagerDashboard';
import UserDashboard from './UserDashboard';

const HomePage = () => {
    const navigate = useNavigate();

    // Synchronous read so we never render a Dashboard for a null user
    const parseUser = () => {
        try {
            const raw = sessionStorage.getItem('user');
            return raw ? JSON.parse(raw) : null;
        } catch {
            sessionStorage.removeItem('user');
            sessionStorage.removeItem('token');
            return null;
        }
    };

    const [user] = useState<any>(parseUser);

    useEffect(() => {
        if (!user) {
            navigate('/login', { replace: true });
        }
    }, [user, navigate]);

    // Guard: never render dashboards without a valid user object
    if (!user) {
        return <Navigate to="/login" replace />;
    }

    const roleName = typeof user.role === 'object' ? (user.role?.name || '') : (user.role || '');

    switch (roleName) {
        case 'manager':
            return <ManagerDashboard />;
        case 'engineer':
        case 'user':
            return <UserDashboard />;
        default:
            return (
                <div className="flex flex-col items-center justify-center p-12 text-center text-gray-500">
                    <h3 className="text-xl font-semibold mb-2">Unknown Role</h3>
                    <p>Your account role ({String(roleName || 'unknown')}) is not mapped to a dashboard.</p>
                </div>
            );
    }
};

export default HomePage;
