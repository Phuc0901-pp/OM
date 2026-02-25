import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { Assign, StationChildConfig } from '../pages/user/environment/types';
import useAutoRefresh from './useAutoRefresh';

interface UseEnvironmentDataReturn {
    assigns: Assign[];
    loading: boolean;
    error: string | null;
    selectedAssignId: string;
    setSelectedAssignId: (id: string) => void;
    stationMap: Record<string, string>;
    childCategoryMap: Record<string, any>;
    mainCategoryMap: Record<string, string>;
    processMap: Record<string, string>;
    stationConfigsMap: Record<string, StationChildConfig>;
    refreshData: () => Promise<void>;
    selectedAssign: Assign | undefined;
    taskDetails: any[];
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

    // Lookup Maps
    const [stationMap, setStationMap] = useState<Record<string, string>>({});
    const [childCategoryMap, setChildCategoryMap] = useState<Record<string, any>>({});
    const [mainCategoryMap, setMainCategoryMap] = useState<Record<string, string>>({});
    const [processMap, setProcessMap] = useState<Record<string, string>>({});
    const [stationConfigsMap, setStationConfigsMap] = useState<Record<string, StationChildConfig>>({});

    // Helpers
    const getUserId = useCallback(() => {
        try {
            const userStr = localStorage.getItem('user');
            return userStr ? JSON.parse(userStr).id : null;
        } catch { return null; }
    }, []);

    // Data Fetching
    const fetchData = useCallback(async () => {
        const userId = getUserId();
        if (!userId) {
            setLoading(false);
            setError("Không tìm thấy thông tin người dùng");
            return;
        }

        try {
            // Parallel Fetch
            const [assignsRes, stationsRes, childCatsRes, mainCatsRes, processesRes, configsRes] = await Promise.all([
                api.get(`/allocations/user/${userId}`),
                api.get('/admin/tables/stations').catch(() => ({ data: [] })),
                api.get('/admin/tables/child_categories').catch(() => ({ data: [] })),
                api.get('/main-categories').catch(() => ({ data: [] })),
                api.get('/admin/tables/process').catch(() => ({ data: [] })),
                api.get('/admin/tables/station_child_configs').catch(() => ({ data: [] }))
            ]);

            const assignsData: Assign[] = Array.isArray(assignsRes.data) ? assignsRes.data : [];
            setAssigns(assignsData);

            // Maps Construction
            const sMap: Record<string, string> = {};
            (stationsRes.data || []).forEach((s: any) => s.id && (sMap[s.id] = s.name || 'Station'));
            setStationMap(sMap);

            const ccMap: Record<string, any> = {};
            (childCatsRes.data || []).forEach((c: any) => c.id && (ccMap[c.id] = c));
            setChildCategoryMap(ccMap);

            const mcMap: Record<string, string> = {};
            (mainCatsRes.data || []).forEach((m: any) => m.id && (mcMap[m.id] = m.name || 'Main Category'));
            setMainCategoryMap(mcMap);

            const pMap: Record<string, string> = {};
            (processesRes.data || []).forEach((p: any) => p.id && (pMap[p.id] = p.name || 'Process'));
            setProcessMap(pMap);

            // Config Map
            const cMap: Record<string, StationChildConfig> = {};
            (configsRes?.data || []).forEach((c: any) => {
                if (c.station_id && c.child_category_id) {
                    const key = `${c.station_id}_${c.child_category_id}`;
                    let imgs: string[] = [];
                    if (Array.isArray(c.guide_images)) imgs = c.guide_images;
                    else if (typeof c.guide_images === 'string') { try { imgs = JSON.parse(c.guide_images) } catch { } }

                    cMap[key] = {
                        id: c.id,
                        station_id: c.station_id,
                        child_category_id: c.child_category_id,
                        guide_text: c.guide_text,
                        guide_images: imgs,
                        image_count: c.image_count
                    };
                }
            });
            setStationConfigsMap(cMap);

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
    const taskDetails = useMemo(() => selectedAssign?.task_details || [], [selectedAssign]);

    return {
        assigns,
        loading,
        error,
        selectedAssignId,
        setSelectedAssignId,
        stationMap,
        childCategoryMap,
        mainCategoryMap,
        processMap,
        stationConfigsMap,
        refreshData: fetchData,
        selectedAssign,
        taskDetails,
        getUserId
    };
};
