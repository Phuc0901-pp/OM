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

 const isManagerRole = roleName === 'manager' || roleName === 'admin';

 if (isManagerRole) {
 return <ManagerDashboard />;
 }
 
 // Thu gọn: Tất cả các roles còn lại (engineer, technician, viewer...) đều chuyển về UserDashboard
 return <UserDashboard />;
};

export default HomePage;
