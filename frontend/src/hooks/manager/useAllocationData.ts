import { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../../services/api';
import useAutoRefresh from '../useAutoRefresh';
import type { Project, User, Asset, Work, ModelProject } from '../../types/models';

export interface CustomTask {
    id: string; // temp ID for UI
    id_asset: string;
    task_name: string;
    id_process: string[];
    status_set_image_count: boolean;
    image_count: number;
    guide_text: string;
    guide_images: string[];
}

export interface Template {
    id: string;
    name: string;
    id_project: string;
    id_model_project?: string;
    id_config?: string[];
}

export function useAllocationData() {
    // Data States
    const [projects, setProjects] = useState<Project[]>([]);
    const [assets, setAssets] = useState<Asset[]>([]);
    const [works, setWorks] = useState<Work[]>([]);
    const [subWorks, setSubWorks] = useState<any[]>([]);
    const [configs, setConfigs] = useState<any[]>([]);
    const [processes, setProcesses] = useState<any[]>([]);

    const [modelProjects, setModelProjects] = useState<ModelProject[]>([]);
    const [allTemplates, setAllTemplates] = useState<Template[]>([]); // Raw fetch from server
    const [templates, setTemplates] = useState<Template[]>([]); // Filtered by modelProject
    const [users, setUsers] = useState<User[]>([]);
    const [roles, setRoles] = useState<any[]>([]); // New state for roles
    const [owners, setOwners] = useState<any[]>([]); // New state for owners

    // Selection States
    const [selectedProject, setSelectedProject] = useState('');
    const [selectedConfigs, setSelectedConfigs] = useState<string[]>([]); // Default tree selections
    const [customTasks, setCustomTasks] = useState<CustomTask[]>([]); // Custom config tasks
    const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
    const [selectedModelProject, setSelectedModelProject] = useState('');
    const [selectedTemplate, setSelectedTemplate] = useState('');
    const [note, setNote] = useState('');
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');

    // UI States
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedOwnerFilter, setSelectedOwnerFilter] = useState(''); // New state
    const [selectedLocationFilter, setSelectedLocationFilter] = useState(''); // Location state

    const filteredProjects = projects.filter(p => {
        const matchSearch =
            p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.owner?.name?.toLowerCase().includes(searchTerm.toLowerCase());

        const matchOwner = selectedOwnerFilter ? p.id_owner === selectedOwnerFilter : true;
        const matchLocation = selectedLocationFilter ? p.location === selectedLocationFilter : true;

        return matchSearch && matchOwner && matchLocation;
    });

    const uniqueLocations = Array.from(new Set(projects.map(p => p.location).filter(Boolean)));

    const fetchInitialData = useCallback(async () => {
        try {
            const storedUser = sessionStorage.getItem('user');
            const currentUser = storedUser ? JSON.parse(storedUser) : null;

            const [projRes, userRes, modelRes, ownerRes, roleRes] = await Promise.all([
                api.get('/projects'),
                api.get('/users'),
                api.get('/model-projects').catch(() => ({ data: [] })),
                api.get('/owners').catch(() => ({ data: [] })),
                api.get('/roles').catch(() => ({ data: [] })),
            ]);
            setProjects(Array.isArray(projRes.data) ? projRes.data : []);
            setUsers(Array.isArray(userRes.data) ? userRes.data : []);
            setModelProjects(Array.isArray(modelRes.data) ? modelRes.data : []);
            setOwners(Array.isArray(ownerRes.data) ? ownerRes.data : []);
            setRoles(Array.isArray(roleRes.data) ? roleRes.data : []);
        } catch (error) {
            console.error('Failed to load allocation data', error);
        }
    }, []);

    // Load project tree (works, subWorks, assets, configs, processes) when project is selected
    useEffect(() => {
        if (!selectedProject) {
            setAssets([]);
            setWorks([]);
            setSubWorks([]);
            setConfigs([]);
            setProcesses([]);
            setTemplates([]);
            setSelectedConfigs([]);
            setSelectedTemplate('');
            return;
        }
        const fetchProjectTree = async () => {
            try {
                // Fetch assets, works, sub-works, configs, and processes related to the project
                // In a real V2 approach we might fetch these concurrently based on project_id/asset_id
                const assetsRes = await api.get(`/assets`, { params: { project_id: selectedProject } });
                const fetchedAssets = Array.isArray(assetsRes.data) ? assetsRes.data : [];
                setAssets(fetchedAssets);

                // Fetch other dictionaries (works, subWorks, configs, processes)
                const [worksRes, subWorksRes, configsRes, processesRes, templatesRes] = await Promise.all([
                    api.get('/works').catch(() => ({ data: [] })),
                    api.get('/sub-works').catch(() => ({ data: [] })),
                    api.get('/configs').catch(() => ({ data: [] })),
                    api.get('/process').catch(() => ({ data: [] })),
                    api.get('/templates').catch(() => ({ data: [] }))
                ]);

                setWorks(Array.isArray(worksRes.data) ? worksRes.data : []);
                setSubWorks(Array.isArray(subWorksRes.data) ? subWorksRes.data : []);

                // V2: Send straight Array of Configs fetched, the Tree Component in UI handles display filtering checks.
                const allConfigs = Array.isArray(configsRes.data) ? configsRes.data : [];
                setConfigs(allConfigs);

                setProcesses(Array.isArray(processesRes.data) ? processesRes.data : []);

                // Store all templates fetched for this project (filter applied later by modelProject)
                const allTpls = Array.isArray(templatesRes.data) ? templatesRes.data : [];
                setAllTemplates(allTpls);
                // Show all templates for this project on initial load
                const filteredTpls = allTpls.filter((t: any) => t.id_project === selectedProject);
                setTemplates(filteredTpls);
                setSelectedTemplate('');
                setSelectedConfigs([]);

            } catch (error) {
                console.error('Failed to load project tree', error);
            }
        };
        fetchProjectTree();
    }, [selectedProject]);

    // Re-filter templates client-side when selectedModelProject changes.
    // If no model project is selected → show ALL templates for this project.
    // If model project is selected → show only templates whose id_model_project matches.
    useEffect(() => {
        if (!selectedProject) return;
        const filteredTpls = allTemplates.filter((t: any) => {
            if (t.id_project !== selectedProject) return false;
            if (!selectedModelProject) return true; // show all project templates
            return t.id_model_project === selectedModelProject
                || !t.id_model_project // also include non-typed templates
                || t.id_model_project === '00000000-0000-0000-0000-000000000000';
        });
        setTemplates(filteredTpls);
        setSelectedTemplate('');
        setSelectedConfigs([]);
    }, [selectedModelProject, allTemplates, selectedProject]);

    useAutoRefresh(fetchInitialData, 60000);

    useEffect(() => {
        fetchInitialData();
    }, [fetchInitialData]);

    const toggleConfig = (configId: string) => {
        setSelectedConfigs(prev =>
            prev.includes(configId) ? prev.filter(id => id !== configId) : [...prev, configId]
        );
    };

    const toggleUser = (userId: string) => {
        setSelectedUsers(prev =>
            prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
        );
    };

    const isCustomModel = useMemo(() => {
        if (!selectedModelProject) return false;
        const mp = modelProjects.find(m => m.id === selectedModelProject);
        if (!mp) return false;
        const n = mp.name.toLowerCase();
        return n.includes('khác') || n.includes('khắc phục') || n.includes('đột xuất');
    }, [selectedModelProject, modelProjects]);

    const handleTemplateChange = (templateId: string) => {
        setSelectedTemplate(templateId);
        if (!templateId) {
            setSelectedConfigs([]);
            return;
        }
        const tmpl = templates.find(t => t.id === templateId);
        if (tmpl && tmpl.id_config) {
            setSelectedConfigs(tmpl.id_config);
        } else {
            setSelectedConfigs([]);
        }
    };

    const handleSubmit = async () => {
        if (!selectedProject) return alert('Vui lòng chọn dự án');
        if (!selectedModelProject) return alert('Vui lòng chọn loại hình dự án');
        if (selectedUsers.length === 0) return alert('Vui lòng chọn ít nhất một nhân sự');
        if (!isCustomModel && selectedConfigs.length === 0) return alert('Vui lòng chọn ít nhất một thiết bị (Tree)');
        if (isCustomModel && !selectedTemplate && customTasks.length === 0) return alert('Vui lòng chọn mẫu hoặc cập nhật ít nhất một công việc vào danh sách (Khác)');
        if (!startTime || !endTime) return alert('Vui lòng cập nhật thời gian triển khai');

        if (new Date(startTime) >= new Date(endTime)) {
            return alert('Thời gian kết thúc phải diễn ra sau thời gian bắt đầu');
        }

        setLoading(true);
        try {
            const formattedStartTime = new Date(startTime).toISOString();
            const formattedEndTime = new Date(endTime).toISOString();

            // ── AUTO-CREATE TEMPLATE ──────────────────────────────────────────────
            // Khi chưa chọn template và không phải loại Khác/custom
            // → tự tạo template mới để lưu bộ config đã chọn cho lần sau.
            let resolvedTemplateId: string | undefined = selectedTemplate || undefined;
            let finalTemplateName = 'Thủ công';

            if (selectedTemplate) {
                finalTemplateName = templates.find(t => t.id === selectedTemplate)?.name || 'Thủ công';
            }

            if (!selectedTemplate && !isCustomModel && selectedConfigs.length > 0) {
                try {
                    const mp = modelProjects.find(m => m.id === selectedModelProject);
                    const now = new Date();
                    const dateStr = now.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
                    const timeStr = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
                    const typeName = mp?.name ?? 'Phân bổ thủ công';
                    const autoName = `${typeName} - ${dateStr} ${timeStr}`;
                    finalTemplateName = autoName;

                    const tplRes = await api.post('/templates', {
                        name: autoName,
                        id_project: selectedProject,
                        id_model_project: selectedModelProject || null,
                        id_config: selectedConfigs,
                    });

                    if (tplRes.data?.id) {
                        resolvedTemplateId = tplRes.data.id;
                        // Cập nhật danh sách template state
                        const allTplsRes = await api.get('/templates').catch(() => ({ data: [] }));
                        const allTpls = Array.isArray(allTplsRes.data) ? allTplsRes.data : [];
                        setAllTemplates(allTpls);
                        const filteredTpls = allTpls.filter((t: any) => t.id_project === selectedProject);
                        setTemplates(filteredTpls);
                    }
                } catch (e) {
                    // Non-fatal: vẫn tiếp tục submit nếu tạo template thất bại
                    console.warn('[AutoTemplate] Failed to auto-create template:', e);
                }
            }
            // ─────────────────────────────────────────────────────────────────────

            await api.post('/assigns', {
                id_users: selectedUsers,
                id_project: selectedProject,
                id_configs: resolvedTemplateId || !isCustomModel ? selectedConfigs : [],
                custom_configs: isCustomModel && !resolvedTemplateId ? customTasks : [],
                id_model_project: selectedModelProject || undefined,
                id_template: resolvedTemplateId,
                start_time: formattedStartTime,
                end_time: formattedEndTime,
                note_assign: note || undefined,
            });

            // ── LARK INTEGRATION: Push to 'PHÂN BỔ CÔNG VIỆC' Base ───────────
            const projObj = projects.find(p => p.id === selectedProject);
            const invObj = projObj?.id_owner ? owners.find(o => o.id === projObj.id_owner) : null;
            const modelName = modelProjects.find(m => m.id === selectedModelProject)?.name || 'Khác';
            const selectedUserDetails = users.filter(u => selectedUsers.includes(u.id));

            try {
                // Push 1 bản ghi cho mỗi User được chọn
                for (const user of selectedUserDetails) {
                    const singleUserName = user.name || user.email;
                    
                    await api.post('/lark/push-allocation', {
                        app_token: 'JbTBbo3QQaz7r5smJZilen5EgXg',
                        table_id: 'tblq7sHNVykgxehm',
                        project: projObj?.name || 'Unknown',
                        investor: invObj?.name || '',
                        manager: singleUserName,
                        model: modelName,
                        template: finalTemplateName,
                        start_date: new Date(startTime).toLocaleString('vi-VN'),
                        end_date: new Date(endTime).toLocaleString('vi-VN')
                    });
                }
            } catch (err) {
                console.error('Failed to push to Lark base:', err);
            }
            // ─────────────────────────────────────────────────────────────────

            alert(`Đã ghi nhận phân bổ công việc thành công!`);
            // Reset
            setSelectedConfigs([]);
            setCustomTasks([]);
            setSelectedUsers([]);
            setNote('');
            setStartTime('');
            setEndTime('');
        } catch (error: any) {
            const msg = error?.response?.data?.error || 'Triển khai thất bại';
            alert(msg);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveAsTemplate = async (templateName: string): Promise<boolean> => {
        if (!selectedProject || selectedConfigs.length === 0) return false;
        try {
            setLoading(true);
            const res = await api.post('/templates', {
                name: templateName,
                id_project: selectedProject,
                id_model_project: selectedModelProject || null,
                id_config: selectedConfigs,  // ← key phải là id_config (backend nhận key này)
            });
            // Reload templates then auto-select the new one
            const tplRes = await api.get('/templates').catch(() => ({ data: [] }));
            const allTpls = Array.isArray(tplRes.data) ? tplRes.data : [];
            setAllTemplates(allTpls);
            const filteredTpls = allTpls.filter((t: any) => t.id_project === selectedProject);
            setTemplates(filteredTpls);
            if (res.data?.id) {
                setSelectedTemplate(res.data.id);
            }
            return true;
        } catch {
            return false;
        } finally {
            setLoading(false);
        }
    };

    const handleCreateModelProject = async (name: string) => {
        try {
            await api.post('/model-projects', { name });
            // Refresh
            const modelRes = await api.get('/model-projects').catch(() => ({ data: [] }));
            setModelProjects(Array.isArray(modelRes.data) ? modelRes.data : []);
        } catch (error) {
            throw error;
        }
    };

    return {
        // Data
        projects,
        assets,
        works,
        subWorks,
        configs,
        processes,
        modelProjects,
        templates,
        allTemplates,
        users,
        roles,
        owners,
        filteredProjects,
        // Selection
        selectedProject,
        setSelectedProject,
        selectedConfigs,
        setSelectedConfigs, // Expose per user request for bulk toggle
        toggleConfig,
        customTasks,
        setCustomTasks,
        selectedUsers,
        toggleUser,
        selectedModelProject,
        setSelectedModelProject,
        selectedTemplate,
        handleTemplateChange,
        isCustomModel,
        note,
        setNote,
        startTime,
        setStartTime,
        endTime,
        setEndTime,
        // UI
        loading,
        searchTerm,
        setSearchTerm,
        selectedOwnerFilter,
        setSelectedOwnerFilter,
        selectedLocationFilter,
        setSelectedLocationFilter,
        uniqueLocations,
        // Actions
        handleSubmit,
        handleCreateModelProject,
        handleSaveAsTemplate,
    };
}
