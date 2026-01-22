// Custom hook for ProjectSetupPage data and state management
// Encapsulates all data fetching, state, and core logic

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import api from '../../../../services/api';
import {
    Project,
    MainCategory,
    ChildCategory,
    Station,
    Process,
    ProjectClassification,
    ConfigFormState
} from './types';
import {
    createEmptyConfigForm,
    parseConfigToFormState,
    getChildConfig,
    buildConfigPayload,
    updateStationsMapAfterSave,
    safeJsonParse
} from './helpers';

export const useProjectSetup = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const location = useLocation();

    // Core data states
    const [project, setProject] = useState<Project | null>(null);
    const [categories, setCategories] = useState<MainCategory[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Station data
    const [stationsMap, setStationsMap] = useState<Record<string, Station[]>>({});
    const [childCategoriesMap, setChildCategoriesMap] = useState<Record<string, ChildCategory>>({});

    // Selection states
    const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(new Set());
    const [selectedChild, setSelectedChild] = useState<ChildCategory | null>(null);
    const [selectedStationId, setSelectedStationId] = useState<string | null>(null);

    // UI states
    const [expandedMain, setExpandedMain] = useState<string | null>(null);
    const [expandedStation, setExpandedStation] = useState<string | null>(null);

    // Form state
    const [configForm, setConfigForm] = useState<ConfigFormState>(createEmptyConfigForm());

    // Reference data
    const [availableProcesses, setAvailableProcesses] = useState<Process[]>([]);
    const [availableClassifications, setAvailableClassifications] = useState<ProjectClassification[]>([]);
    const [projectCharacteristics, setProjectCharacteristics] = useState<Record<string, any>>({});

    // Navigation helpers
    const isManagerRoute = location.pathname.includes('/manager');

    const handleBack = useCallback(() => {
        navigate(isManagerRoute ? '/manager/management' : '/admin/management');
    }, [navigate, isManagerRoute]);

    // Data fetching
    const fetchProcesses = useCallback(async () => {
        try {
            const res = await api.get('/admin/tables/process');
            setAvailableProcesses(Array.isArray(res.data) ? res.data : []);
        } catch (error) {
            console.error("Failed to fetch processes", error);
        }
    }, []);

    const fetchClassifications = useCallback(async () => {
        try {
            const res = await api.get('/admin/tables/project_classification');
            setAvailableClassifications(Array.isArray(res.data) ? res.data : []);
        } catch (error) {
            console.error("Failed to fetch classifications", error);
        }
    }, []);

    const fetchSelectedCategories = useCallback(async () => {
        if (!id) return;
        try {
            const res = await api.get(`/projects/${id}/checklists`);
            if (Array.isArray(res.data)) {
                const ids = res.data.map((item: any) => item.child_category_id);
                setSelectedCategoryIds(new Set(ids));
            }
        } catch (error) {
            console.warn("Could not fetch bulk checklists", error);
        }
    }, [id]);

    const fetchStationsForMain = useCallback(async (mainCategoryId: string) => {
        if (!id) return;
        try {
            const res = await api.get('/stations', {
                params: { main_category_id: mainCategoryId, project_id: id }
            });
            const stations: Station[] = Array.isArray(res.data) ? res.data : [];
            setStationsMap(prev => ({ ...prev, [mainCategoryId]: stations }));
        } catch (error) {
            console.error("Failed to fetch stations for main category", error);
        }
    }, [id]);

    const fetchData = useCallback(async () => {
        if (!id) return;
        setLoading(true);
        setError(null);

        try {
            const [projRes, mainCatsRes] = await Promise.all([
                api.get(`/projects/${id}`),
                api.get('/main-categories')
            ]);

            if (!projRes.data) throw new Error("Project not found");
            setProject(projRes.data);

            // Fetch project characteristics
            try {
                const charRes = await api.get(`/projects/${id}/characteristics`);
                if (charRes.data) {
                    setProjectCharacteristics(charRes.data);

                    const savedChar = charRes.data;
                    const loadedCharacteristics: Record<string, any> = {};

                    if (savedChar.child_category_data) {
                        const childData = safeJsonParse(savedChar.child_category_data, {});
                        Object.assign(loadedCharacteristics, childData);
                    }

                    if (savedChar.inverter !== undefined) {
                        loadedCharacteristics['inverter'] = savedChar.inverter;
                    }
                    if (savedChar.inverter_sub_area_count) {
                        loadedCharacteristics['inverter_sub_area_count'] = savedChar.inverter_sub_area_count;
                    }
                    if (savedChar.inverter_details) {
                        loadedCharacteristics['inverter_details'] = safeJsonParse(savedChar.inverter_details, {});
                    }
                    if (savedChar.area_name) {
                        loadedCharacteristics['area_name'] = savedChar.area_name;
                    }

                    const processIds = safeJsonParse(savedChar.process_ids, []);

                    setConfigForm(prev => ({
                        ...prev,
                        process_ids: Array.isArray(processIds) ? processIds : [],
                        characteristics: {
                            ...prev.characteristics,
                            ...loadedCharacteristics
                        }
                    }));
                }
            } catch (charErr) {
                console.warn("Could not fetch project characteristics", charErr);
            }

            // Fetch children for each main category
            const mainCats = mainCatsRes.data;
            if (Array.isArray(mainCats)) {
                const catsWithChildren = await Promise.all(mainCats.map(async (cat: MainCategory) => {
                    try {
                        const childRes = await api.get(`/main-categories/${cat.id}/children`);
                        return { ...cat, children: childRes.data };
                    } catch {
                        return { ...cat, children: [] };
                    }
                }));
                setCategories(catsWithChildren);

                // Build childCategoriesMap
                const childMap: Record<string, ChildCategory> = {};
                catsWithChildren.forEach(cat => {
                    cat.children?.forEach((child: ChildCategory) => {
                        childMap[child.id] = child;
                    });
                });
                setChildCategoriesMap(childMap);

                if (catsWithChildren.length > 0) {
                    const firstCatId = catsWithChildren[0].id;
                    setExpandedMain(firstCatId);
                    fetchStationsForMain(firstCatId);
                }
            }
        } catch (error: any) {
            console.error("Failed to fetch setup data", error);
            setError(error.response?.data?.error || "Không thể tải dữ liệu dự án. Vui lòng thử lại.");
        } finally {
            setLoading(false);
        }
    }, [id, fetchStationsForMain]);

    // Handlers
    const handleSelectChild = useCallback((child: ChildCategory) => {
        setSelectedChild(child);

        let targetStation: Station | null = null;

        for (const key of Object.keys(stationsMap)) {
            const stationList = stationsMap[key];
            if (!Array.isArray(stationList)) continue;

            if (selectedStationId) {
                const found = stationList.find(s => s.id === selectedStationId);
                if (found) {
                    targetStation = found;
                    break;
                }
            }

            const foundByChild = stationList.find(s => (s.child_category_ids || []).includes(child.id));
            if (foundByChild) {
                targetStation = foundByChild;
                setSelectedStationId(foundByChild.id);
                break;
            }
        }

        if (targetStation) {
            const config = getChildConfig(targetStation.child_configs, child.id);
            setConfigForm(parseConfigToFormState(config));
        } else {
            setConfigForm(createEmptyConfigForm());
        }

        setSelectedCategoryIds(prev => new Set(prev).add(child.id));
    }, [stationsMap, selectedStationId]);

    const handleSaveConfig = useCallback(async () => {
        if (!selectedChild || !id || !selectedStationId) {
            alert("Vui lòng chọn một hạng mục từ khu vực để cấu hình.");
            return;
        }

        try {
            const configPayload = buildConfigPayload(selectedChild.id, configForm);
            await api.put(`/stations/${selectedStationId}/child-config`, configPayload);

            const newConfig = {
                child_category_id: selectedChild.id,
                ...configPayload.config
            };

            setStationsMap(prev => updateStationsMapAfterSave(
                prev,
                selectedStationId,
                selectedChild.id,
                newConfig
            ));

            setSelectedCategoryIds(prev => new Set(prev).add(selectedChild.id));
            alert("Đã lưu cấu hình thành công!");
        } catch (error) {
            console.error(error);
            alert("Lưu thất bại! Vui lòng thử lại.");
        }
    }, [selectedChild, id, selectedStationId, configForm]);

    const handleToggleCategory = useCallback(async (childId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!id) return;

        const isSelected = selectedCategoryIds.has(childId);

        try {
            if (isSelected) {
                await api.delete(`/projects/${id}/checklist/${childId}`);
                setSelectedCategoryIds(prev => {
                    const next = new Set(prev);
                    next.delete(childId);
                    return next;
                });
            } else {
                const payload = {
                    project_id: id,
                    child_category_id: childId,
                    process_id: "",
                    characteristics: { process_ids: [] }
                };
                await api.post('/checklists', payload);
                setSelectedCategoryIds(prev => new Set(prev).add(childId));
            }
        } catch (err) {
            console.error("Failed to toggle category", err);
            alert("Không thể cập nhật trạng thái hạng mục.");
        }
    }, [id, selectedCategoryIds]);

    const handleToggleMainCategory = useCallback(async (main: MainCategory, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!id || !main.children || main.children.length === 0) return;

        const childrenIds = main.children.map(c => c.id);
        const selectedCount = childrenIds.filter(cid => selectedCategoryIds.has(cid)).length;
        const isAllSelected = selectedCount === childrenIds.length;

        try {
            if (isAllSelected) {
                await Promise.all(childrenIds.map(cid => {
                    if (selectedCategoryIds.has(cid)) {
                        return api.delete(`/projects/${id}/checklist/${cid}`).catch(console.warn);
                    }
                    return Promise.resolve();
                }));

                setSelectedCategoryIds(prev => {
                    const next = new Set(prev);
                    childrenIds.forEach(cid => next.delete(cid));
                    return next;
                });
            } else {
                const toAdd = childrenIds.filter(cid => !selectedCategoryIds.has(cid));
                await Promise.all(toAdd.map(cid => {
                    const payload = {
                        project_id: id,
                        child_category_id: cid,
                        process_id: "",
                        characteristics: { process_ids: [] }
                    };
                    return api.post('/checklists', payload).catch(console.warn);
                }));

                setSelectedCategoryIds(prev => {
                    const next = new Set(prev);
                    childrenIds.forEach(cid => next.add(cid));
                    return next;
                });
            }
        } catch (error) {
            console.error("Bulk toggle failed", error);
            alert("Thao tác hàng loạt thất bại.");
        }
    }, [id, selectedCategoryIds]);

    const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!selectedChild || !id || !selectedStationId || !e.target.files) return;

        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        const formData = new FormData();
        files.forEach(file => formData.append("files", file));
        formData.append("child_category_name", selectedChild.name);
        formData.append("child_category_id", selectedChild.id);

        try {
            const res = await api.post(`/stations/${selectedStationId}/upload-guide`, formData, {
                headers: { "Content-Type": "multipart/form-data" }
            });

            const newImages = res.data.uploaded_paths || [];
            if (newImages.length > 0) {
                const currentImages = (configForm.characteristics.guide_images as string[]) || [];
                const updatedImages = [...currentImages, ...newImages];

                setConfigForm(prev => ({
                    ...prev,
                    characteristics: {
                        ...prev.characteristics,
                        guide_images: updatedImages
                    }
                }));
                alert(`Đã upload ${newImages.length} ảnh thành công!`);
            }
        } catch (error: any) {
            console.error("Upload failed", error);
            alert(`Upload ảnh thất bại: ${error.response?.data?.error || error.message}`);
        }
    }, [selectedChild, id, selectedStationId, configForm]);

    // Update characteristic helper
    const updateCharacteristic = useCallback((key: string, value: any) => {
        setConfigForm(prev => ({
            ...prev,
            characteristics: { ...prev.characteristics, [key]: value }
        }));
    }, []);

    const updateProcessIds = useCallback((newIds: string[]) => {
        setConfigForm(prev => ({ ...prev, process_ids: newIds }));
    }, []);

    // Effects
    useEffect(() => {
        if (id) {
            fetchData();
            fetchProcesses();
            fetchClassifications();
            fetchSelectedCategories();
        }
    }, [id, fetchData, fetchProcesses, fetchClassifications, fetchSelectedCategories]);

    return {
        // Data
        id,
        project,
        categories,
        stationsMap,
        childCategoriesMap,
        availableProcesses,
        availableClassifications,
        projectCharacteristics,

        // States
        loading,
        error,
        selectedCategoryIds,
        selectedChild,
        selectedStationId,
        expandedMain,
        expandedStation,
        configForm,
        isManagerRoute,

        // Setters
        setExpandedMain,
        setExpandedStation,
        setSelectedStationId,

        // Handlers
        handleBack,
        handleSelectChild,
        handleSaveConfig,
        handleToggleCategory,
        handleToggleMainCategory,
        handleFileUpload,
        updateCharacteristic,
        updateProcessIds,
        fetchData,
        fetchStationsForMain
    };
};
