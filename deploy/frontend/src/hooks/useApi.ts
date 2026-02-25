import { useState, useCallback, useEffect } from 'react';
import api from '../services/api';

interface UseApiOptions<T> {
    initialData?: T;
    immediate?: boolean;
}

interface UseApiReturn<T> {
    data: T | null;
    loading: boolean;
    error: string | null;
    execute: (...args: any[]) => Promise<T | undefined>;
    refresh: () => Promise<void>;
}

/**
 * Generic hook for API calls with loading/error state management
 * @param endpoint - API endpoint (e.g., '/users')
 * @param options - Configuration options
 */
export function useApi<T = any>(
    endpoint: string,
    options: UseApiOptions<T> = {}
): UseApiReturn<T> {
    const { initialData = null, immediate = true } = options;

    const [data, setData] = useState<T | null>(initialData);
    const [loading, setLoading] = useState(immediate);
    const [error, setError] = useState<string | null>(null);

    const execute = useCallback(async (...args: any[]) => {
        setLoading(true);
        setError(null);
        try {
            const response = await api.get(endpoint, ...args);
            setData(response.data);
            return response.data as T;
        } catch (err: any) {
            const message = err.response?.data?.error?.message || err.message || 'An error occurred';
            setError(message);
            console.error(`API Error [${endpoint}]:`, err);
            return undefined;
        } finally {
            setLoading(false);
        }
    }, [endpoint]);

    const refresh = useCallback(async () => {
        await execute();
    }, [execute]);

    useEffect(() => {
        if (immediate) {
            execute();
        }
    }, [immediate, execute]);

    return { data, loading, error, execute, refresh };
}

/**
 * Hook for mutating data (POST, PUT, DELETE)
 */
export function useApiMutation<TRequest = any, TResponse = any>(
    method: 'post' | 'put' | 'delete',
    endpoint: string
) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const mutate = useCallback(async (data?: TRequest, pathSuffix?: string): Promise<TResponse | undefined> => {
        setLoading(true);
        setError(null);
        try {
            const fullEndpoint = pathSuffix ? `${endpoint}${pathSuffix}` : endpoint;
            let response;
            if (method === 'delete') {
                response = await api.delete(fullEndpoint);
            } else if (method === 'put') {
                response = await api.put(fullEndpoint, data);
            } else {
                response = await api.post(fullEndpoint, data);
            }
            return response.data as TResponse;
        } catch (err: any) {
            const message = err.response?.data?.error?.message || err.message || 'An error occurred';
            setError(message);
            console.error(`API Mutation Error [${method.toUpperCase()} ${endpoint}]:`, err);
            return undefined;
        } finally {
            setLoading(false);
        }
    }, [method, endpoint]);

    return { mutate, loading, error };
}

export default useApi;
