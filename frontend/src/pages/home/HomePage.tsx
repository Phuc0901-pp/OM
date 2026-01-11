import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminDashboard from './AdminDashboard';
import ManagerDashboard from './ManagerDashboard';
import UserDashboard from './UserDashboard';

const HomePage = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        const userString = localStorage.getItem('user');
        if (!userString) {
            navigate('/login');
            return;
        }
        setUser(JSON.parse(userString));
    }, [navigate]);

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
