import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/auth.service';

export const useLogin = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [showSupport, setShowSupport] = useState(false);
    const navigate = useNavigate();
    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            const data = await authService.login(email, password);

            const { token, user } = data;

            localStorage.setItem('token', token);
            localStorage.setItem('user', JSON.stringify(user));

            navigate('/');
        } catch (err: any) {
            console.error('Login failed:', err);
            // Construct a meaningful error message
            // Construct a meaningful error message
            const serverError = err.response?.data?.error;
            let errorMessage = 'Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.';

            if (typeof serverError === 'string') {
                errorMessage = serverError;
            } else if (serverError && typeof serverError === 'object' && serverError.message) {
                errorMessage = serverError.message;
            } else if (err.message) {
                errorMessage = err.message;
            }

            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    return {
        email,
        setEmail,
        password,
        setPassword,
        isLoading,
        error,
        showSupport,
        setShowSupport,
        handleLogin
    };
};
