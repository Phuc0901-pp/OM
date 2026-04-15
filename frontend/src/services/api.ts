import axios from 'axios';

// Cấu hình Axios instance
const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '/api', // Use relative path as fallback
    headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
    },
});

// Add JWT token to all requests
api.interceptors.request.use(
    (config) => {
        const token = sessionStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Handle 401 errors (token expired or invalid)
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            // Clear invalid token
            sessionStorage.removeItem('token');
            sessionStorage.removeItem('user');
            // Only redirect if NOT on the login page AND NOT on a public share page
            const path = window.location.pathname;
            if (!path.includes('/login') && !path.includes('/share/')) {
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

export default api;

