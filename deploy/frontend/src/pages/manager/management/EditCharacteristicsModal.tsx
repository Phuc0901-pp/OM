import React, { useEffect, useState } from 'react';
import api from '../../../services/api';
import { X, Save, CheckSquare } from 'lucide-react';

interface EditCharacteristicsModalProps {
    isOpen: boolean;
    onClose: () => void;
    projectId: string | null;
    projectName: string;
}

const EditCharacteristicsModal = ({ isOpen, onClose, projectId, projectName }: EditCharacteristicsModalProps) => {
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    // 23 fields as per ProjectCharacteristic struct
    const [data, setData] = useState<any>({
        pv_module: 0, dc_wire: 0, ac_wire: 0, inverter: 0,
        smdb: 0, sdb: 0, transformer_and_fco: 0, grounding: 0,
        water_system: 0, walkway: 0, fire_fight: 0, monitoring: 0,
        ups: 0, life_line: 0, cable_tray: 0, sensor: 0,
        heart_ladder: 0, ton_lay_sang: 0, combiner_box: 0, framework: 0,
        thermal: 0, report_image: 0, inv_station: 0
    });

    useEffect(() => {
        if (isOpen && projectId) {
            fetchData();
        }
    }, [isOpen, projectId]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/projects/${projectId}/characteristics`);
            // Exclude ID/ProjectID etc from state, just merge fields
            if (res.data) {
                const newData = { ...data };
                Object.keys(data).forEach(key => {
                    if (res.data[key] !== undefined) newData[key] = res.data[key];
                });
                setData(newData);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!projectId) return;
        setSaving(true);
        try {
            await api.put(`/projects/${projectId}/characteristics`, data);
            onClose();
        } catch (error) {
            alert("Failed to save data");
        } finally {
            setSaving(false);
        }
    };

    const handleChange = (key: string, value: string) => {
        setData((prev: any) => ({
            ...prev,
            [key]: parseInt(value) || 0
        }));
    };

    if (!isOpen) return null;

    const fields = [
        { key: 'pv_module', label: 'PV Module' },
        { key: 'dc_wire', label: 'DC Wire' },
        { key: 'ac_wire', label: 'AC Wire' },
        { key: 'inverter', label: 'Inverter' },
        { key: 'smdb', label: 'SMDB' },
        { key: 'sdb', label: 'SDB' },
        // ... grouping nicely?
        { key: 'transformer_and_fco', label: 'Transformer & FCO' },
        { key: 'grounding', label: 'Grounding' },
        { key: 'water_system', label: 'Water System' },
        { key: 'walkway', label: 'Walkway' },
        { key: 'fire_fight', label: 'Fire Fight' },
        { key: 'monitoring', label: 'Monitoring' },
        { key: 'ups', label: 'UPS' },
        { key: 'life_line', label: 'Life Line' },
        { key: 'cable_tray', label: 'Cable Tray' },
        { key: 'sensor', label: 'Sensor' },
        { key: 'heart_ladder', label: 'Heart Ladder' },
        { key: 'ton_lay_sang', label: 'Ton Lay Sang' },
        { key: 'combiner_box', label: 'Combiner Box' },
        { key: 'framework', label: 'Framework' },
        { key: 'thermal', label: 'Thermal' },
        { key: 'report_image', label: 'Report Image' },
        { key: 'inv_station', label: 'Inv Station' },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                            <CheckSquare className="w-5 h-5 text-blue-600" />
                            {projectName || 'Project'} - Characteristics
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">Configure asset counts and checklists for this project.</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body (Scrollable) */}
                <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                    {loading ? (
                        <div className="flex items-center justify-center h-40 text-gray-400">Loading data...</div>
                    ) : (
                        <div className="space-y-6">
                            {/* Master Inputs */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-blue-900">Số lượng nhà trạm (Default)</label>
                                    <input
                                        type="number"
                                        className="w-full px-3 py-2 bg-white border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-blue-900 font-medium"
                                        placeholder="Enter quantity..."
                                        min="0"
                                        onChange={(e) => {
                                            const val = parseInt(e.target.value) || 0;
                                            setData((prev: any) => {
                                                const next = { ...prev };
                                                Object.keys(next).forEach(key => {
                                                    if (key !== 'inverter') {
                                                        next[key] = val;
                                                    }
                                                });
                                                return next;
                                            });
                                        }}
                                    />
                                    <p className="text-xs text-blue-400">Áp dụng cho tất cả hạng mục trừ Inverter</p>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-blue-900">Số lượng Inverter (Default)</label>
                                    <input
                                        type="number"
                                        className="w-full px-3 py-2 bg-white border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-blue-900 font-medium"
                                        placeholder="Enter quantity..."
                                        min="0"
                                        onChange={(e) => {
                                            const val = parseInt(e.target.value) || 0;
                                            setData((prev: any) => ({
                                                ...prev,
                                                inverter: val
                                            }));
                                        }}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">

                                {fields.map(field => (
                                    <div key={field.key} className="space-y-1.5">
                                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide ml-1">
                                            {field.label}
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 focus:bg-white transition-all font-medium text-gray-700"
                                            value={data[field.key]}
                                            onChange={(e) => handleChange(field.key, e.target.value)}
                                            onFocus={(e) => e.target.select()}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                    <button onClick={onClose} className="px-6 py-2.5 text-gray-600 font-medium hover:bg-gray-100 rounded-xl transition-colors">
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-500/20 flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed transition-all hover:scale-[1.02]"
                    >
                        <Save className="w-4 h-4" />
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EditCharacteristicsModal;
