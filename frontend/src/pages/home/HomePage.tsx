import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminDashboard from './AdminDashboard';
import ManagerDashboard from './ManagerDashboard';
import UserDashboard from './UserDashboard';

const HomePage = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const userString = localStorage.getItem('user');
        if (!userString) {
            navigate('/login');
            return;
        }
        try {
            setUser(JSON.parse(userString));
        } catch (e) {
            console.error('Failed to parse user from localStorage:', e);
            localStorage.removeItem('user');
            localStorage.removeItem('token');
            navigate('/login');
        } finally {
            setLoading(false);
        }
    }, [navigate]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-gray-500">Đang tải...</p>
                </div>
            </div>
        );
    }

    if (!user) return null;

    const renderDashboard = () => {
        switch (user.role) {
            case 'admin':
                return <AdminDashboard />;
            case 'manager':
                return <ManagerDashboard />;
            case 'engineer':
            case 'user':
                return <UserDashboard />;
            default:
                return (
                    <div className="flex flex-col items-center justify-center p-12 text-center text-gray-500">
                        <h3 className="text-xl font-semibold mb-2">Unknown Role</h3>
                        <p>Your account role ({user.role}) is not mapped to a dashboard.</p>
                    </div>
                );
        }
    };

    return renderDashboard();
};

export default HomePage;
