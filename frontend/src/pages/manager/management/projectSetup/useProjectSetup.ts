// Custom hook for ProjectSetupPage data and state management
// Refactored for V2 schema to only load Project Info and simple states.

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import api from '../../../../services/api';
import { Project, Owner } from './types';

export const useProjectSetup = () => {
 const { id } = useParams<{ id: string }>();
 const navigate = useNavigate();
 const location = useLocation();

 // Core data states
 const [project, setProject] = useState<Project | null>(null);
 const [ownerName, setOwnerName] = useState<string>('');
 const [assets, setAssets] = useState<any[]>([]);
 const [works, setWorks] = useState<any[]>([]);
 const [subWorks, setSubWorks] = useState<any[]>([]);
 const [configs, setConfigs] = useState<any[]>([]);
 const [processes, setProcesses] = useState<any[]>([]);
 const [templates, setTemplates] = useState<any[]>([]);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);

 // Navigation helpers
 const isManagerRoute = location.pathname.includes('/manager');

 const handleBack = useCallback(() => {
 navigate(isManagerRoute ? '/manager/management' : '/admin/management');
 }, [navigate, isManagerRoute]);

 const fetchData = useCallback(async () => {
 if (!id) return;
 setLoading(true);
 setError(null);

 try {
 // Fetch project information
 const projRes = await api.get(`/projects/${id}`);
 if (!projRes.data) throw new Error("Project not found");
 const projectData: Project = projRes.data;
 setProject(projectData);

 // Fetch owner name
 if (projectData.id_owner) {
 try {
 const ownerRes = await api.get(`/owners`);
 const ownersList: Owner[] = Array.isArray(ownerRes.data) ? ownerRes.data : [];
 const found = ownersList.find(o => o.id === projectData.id_owner);
 setOwnerName(found?.name || '');
 } catch {
 setOwnerName(projectData.owner?.name || '');
 }
 } else if (projectData.owner?.name) {
 setOwnerName(projectData.owner.name);
 }

 // Fetch setup data concurrently
 const [assetsRes, worksRes, subWorksRes, configsRes, processesRes, templatesRes] = await Promise.all([
 api.get('/assets', { params: { project_id: id } }).catch(() => ({ data: [] })),
 api.get('/works').catch(() => ({ data: [] })),
 api.get('/sub-works').catch(() => ({ data: [] })),
 api.get('/configs').catch(() => ({ data: [] })),
 api.get('/process').catch(() => ({ data: [] })),
 api.get('/templates').catch(() => ({ data: [] }))
 ]);

 setAssets(assetsRes.data || []);
 setWorks(worksRes.data || []);
 setSubWorks(subWorksRes.data || []);
 setConfigs(configsRes.data || []);
 setProcesses(processesRes.data || []);

 // Filter templates: global (no project id) or specific to this project
 const rawTemplates = templatesRes.data || [];
 if (id) {
 setTemplates(rawTemplates.filter((t: any) => t.id_project === id || !t.id_project));
 } else {
 setTemplates(rawTemplates);
 }

 } catch (error: any) {
 console.error("Failed to fetch setup data", error);
 setError(error.response?.data?.error || "Không thể tải dữ liệu dự án. Vui lòng thử lại.");
 } finally {
 setLoading(false);
 }
 }, [id]);

 useEffect(() => {
 if (id) {
 fetchData();
 }
 }, [id, fetchData]);

 return {
 id,
 project,
 ownerName,
 assets,
 works,
 subWorks,
 configs,
 processes,
 templates,
 loading,
 error,
 isManagerRoute,
 handleBack,
 fetchData
 };
};
