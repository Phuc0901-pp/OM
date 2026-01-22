import axios from 'axios';

// Cấu hình Axios instance
const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '/api', // Use relative path as fallback
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add JWT token to all requests
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
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
            // Clear invalid token and redirect to login
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            // Only redirect if not already on login page
            if (!window.location.pathname.includes('/login')) {
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

export interface WorkOrder {
    id: number;
    title: string;
    description?: string;
    status: 'open' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled';
    priority: 'low' | 'medium' | 'high';
    assignee_name?: string;     // Map từ backend response
    asset_name?: string;        // Map từ backend response
    due_date?: string;
    created_at: string;
}

export const workOrderService = {
    // Lấy danh sách (có hỗ trợ lọc status sau này)
    getAll: async (status?: string) => {
        const params = status ? { status } : {};
        const response = await api.get('/v1/work-orders', { params });
        return response.data;
    },

    // Tạo mới
    create: async (data: any) => {
        const response = await api.post('/v1/work-orders', data);
        return response.data;
    }
};

export const stationService = {
    getAll: async (mainCategoryId: string, projectId?: string) => {
        const params: any = { main_category_id: mainCategoryId };
        if (projectId) params.project_id = projectId;
        const response = await api.get('/stations', { params });
        return response.data;
    },
    getById: async (id: string) => {
        const response = await api.get(`/stations/${id}`);
        return response.data;
    },
    create: async (data: { name: string; main_category_id: string; project_id: string }) => {
        const response = await api.post('/stations', data);
        return response.data;
    },
    update: async (id: string, data: { name: string }) => {
        const response = await api.put(`/stations/${id}`, data);
        return response.data;
    },
    delete: async (id: string) => {
        const response = await api.delete(`/stations/${id}`);
        return response.data;
    }
};

export default api;

