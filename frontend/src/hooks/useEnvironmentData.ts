import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { Assign } from '../pages/user/environment/types';
import useAutoRefresh from './useAutoRefresh';

interface UseEnvironmentDataReturn {
 assigns: Assign[];
 loading: boolean;
 error: string | null;
 selectedAssignId: string;
 setSelectedAssignId: (id: string) => void;
 refreshData: (onSync?: () => void) => Promise<void>;
 selectedAssign: Assign | undefined;
 processDetails: any[]; // instead of taskDetails 
 getUserId: () => string | null;
}

export const useEnvironmentData = (): UseEnvironmentDataReturn => {
 const [searchParams] = useSearchParams();
 const queryAssignId = searchParams.get('assignId');

 // State
 const [assigns, setAssigns] = useState<Assign[]>([]);
 const [selectedAssignId, setSelectedAssignId] = useState<string>(() => {
 return queryAssignId || localStorage.getItem('lastSelectedAssignId') || '';
 });

 // Update state if URL param changes
 useEffect(() => {
 if (queryAssignId) {
 setSelectedAssignId(queryAssignId);
 }
 }, [queryAssignId]);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);

 // Helpers
 const getUserId = useCallback(() => {
 try {
 const userStr = sessionStorage.getItem('user');
 return userStr ? JSON.parse(userStr).id : null;
 } catch { return null; }
 }, []);

 // Data Fetching
 const fetchData = useCallback(async (onSync?: () => void) => {
 const userId = getUserId();
 if (!userId) {
 setLoading(false);
 setError("Không tìm thấy thông tin người dùng");
 return;
 }

 try {
 const assignsRes = await api.get('/assigns', {
 params: {
 user_id: userId,
 _t: Date.now(), // Cache-buster: forces mobile browsers to always fetch fresh data
 }
 });
 const allAssigns: Assign[] = Array.isArray(assignsRes.data) ? assignsRes.data : [];

 // Lọc ra các nhiệm vụ chưa hoàn thành trước
 const assignsData = allAssigns.filter(a => {
 if (a.status_assign === true) return false;
 return true;
 });

 if (onSync) onSync();
 setAssigns(assignsData);

 if (assignsData.length > 0) {
 // If we have a saved ID, verify it exists in the new list
 const savedId = localStorage.getItem('lastSelectedAssignId');
 const exists = assignsData.some(a => a.id === savedId);

 if (savedId && exists) {
 setSelectedAssignId(savedId);
 } else if (!selectedAssignId) {
 // Fallback to first if no saved ID or saved ID is invalid
 setSelectedAssignId(assignsData[0].id);
 }
 }
 } catch (err) {
 console.error("Error fetching data:", err);
 setError("Không thể tải danh sách phân công");
 } finally {
 setLoading(false);
 }
 }, [getUserId, selectedAssignId]);

 useEffect(() => {
 fetchData();
 }, [fetchData]);

 // Auto-refresh every 5 minutes
 useAutoRefresh(() => fetchData(), 5 * 60 * 1000);

 // Persist Selection Effect
 useEffect(() => {
 if (selectedAssignId) {
 localStorage.setItem('lastSelectedAssignId', selectedAssignId);
 }
 }, [selectedAssignId]);

 // Derived Selection
 const selectedAssign = useMemo(() => assigns.find(a => a.id === selectedAssignId), [assigns, selectedAssignId]);
 const processDetails = useMemo(() => selectedAssign?.details || [], [selectedAssign]); // map details

 return {
 assigns,
 loading,
 error,
 selectedAssignId,
 setSelectedAssignId,
 refreshData: fetchData,
 selectedAssign,
 processDetails,
 getUserId
 };
};
