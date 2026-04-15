import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { useEnvironmentData } from './useEnvironmentData';
import api from '../services/api';

// Mock the API module
vi.mock('../services/api', () => ({
    default: {
        get: vi.fn(),
    },
}));

describe('useEnvironmentData', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        sessionStorage.clear();
        localStorage.clear();
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
        <BrowserRouter>
            {children}
        </BrowserRouter>
    );

    it('should return initial state correctly', async () => {
        const { result } = renderHook(() => useEnvironmentData(), { wrapper });

        // Wait for the hook to finish its initial fetch
        await vi.waitFor(() => {
            expect(result.current.loading).toBe(false);
        });
        
        expect(result.current.assigns).toEqual([]);
        expect(result.current.error).toBe("Không tìm thấy thông tin người dùng"); // Since it's testing initial state without user
    });

    it('should fetch assigns correctly if user is logged in', async () => {
        sessionStorage.setItem('user', JSON.stringify({ id: 'test-user-id' }));
        
        const mockAssigns = [
            { id: '1', projectName: 'Project 1', status_assign: false },
            { id: '2', projectName: 'Project 2', status_assign: true }
        ];

        (api.get as any).mockResolvedValueOnce({ data: mockAssigns });

        const { result } = renderHook(() => useEnvironmentData(), { wrapper });

        // Wait for next update after async fetch
        await vi.waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        // Should filter out status_assign === true
        expect(result.current.assigns).toHaveLength(1);
        expect(result.current.assigns[0].id).toBe('1');
        expect(result.current.selectedAssignId).toBe('1'); // Automatically selects the logic fallback
    });

    it('should set an error if no user is found', async () => {
        const { result } = renderHook(() => useEnvironmentData(), { wrapper });

        await vi.waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.error).toBe("Không tìm thấy thông tin người dùng");
    });
});
