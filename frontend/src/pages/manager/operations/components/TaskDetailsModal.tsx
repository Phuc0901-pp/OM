import React from 'react';
import ReactDOM from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import api from '../../../../services/api';
import { TaskRow } from '../types';

// Sub-components
import TaskDetailsHeader from './TaskDetailsHeader';
import TaskDetailsInfoSidebar from './TaskDetailsInfoSidebar';
import TaskDetailsProcessList from './TaskDetailsProcessList';
import TaskDetailsFooter from './TaskDetailsFooter';
import SuccessModal from '../../../../components/common/SuccessModal';
import RejectModal from '../../../../components/common/RejectModal';
import TaskDetailsImageViewer from './TaskDetailsImageViewer';

interface TaskDetailsModalProps {
    task: TaskRow | null;
    isOpen: boolean;
    onClose: () => void;
    onUpdateStatus: (taskId: string, status: number) => Promise<void>;
    fetchTasks: () => void;
    setSelectedTask: (task: TaskRow | null) => void;
    onBulkUpdateStatus?: (ids: string[], status: number) => Promise<void>;
}

const TaskDetailsModal: React.FC<TaskDetailsModalProps> = ({
    task,
    isOpen,
    onClose,
    onUpdateStatus,
    fetchTasks,
    setSelectedTask,
    onBulkUpdateStatus
}) => {
    const [evidenceMap, setEvidenceMap] = React.useState<Record<string, string[]>>({});
    const [noteMap, setNoteMap] = React.useState<Record<string, string>>({});
    const [viewImage, setViewImage] = React.useState<{ images: string[], currentIndex: number } | null>(null);
    const [selectedTaskIds, setSelectedTaskIds] = React.useState<Set<string>>(new Set());
    const [showSuccessModal, setShowSuccessModal] = React.useState(false);
    const [showRejectModal, setShowRejectModal] = React.useState(false);
    const [showRejectSuccessModal, setShowRejectSuccessModal] = React.useState(false);
    const [successModalVariant, setSuccessModalVariant] = React.useState<'success' | 'error'>('success');

    const handleToggleSelection = (id: string, force?: boolean) => {
        setSelectedTaskIds(prev => {
            const next = new Set(prev);
            const val = force !== undefined ? force : !next.has(id);
            if (val) next.add(id);
            else next.delete(id);
            return next;
        });
    };

    const handleBulkUpdateWrapper = async (ids: string[], status: number) => {
        if (onBulkUpdateStatus) {
            await onBulkUpdateStatus(ids, status);
            if (status === 1) {
                setSuccessModalVariant('success');
                setShowSuccessModal(true);
            }
        }
    };

    const handleOpenRejectModal = () => {
        if (selectedTaskIds.size === 0) {
            alert("Vui lòng chọn ít nhất một quy trình để từ chối.");
            return;
        }
        setShowRejectModal(true);
    };

    const handleRejectSubmit = async (reason: string) => {
        const ids = Array.from(selectedTaskIds);
        if (onBulkUpdateStatus) {
            // Pass rejection reason to API
            await api.put('/task-details/bulk/status', {
                ids: ids,
                accept: -1,
                note: reason
            });
        }
        setShowRejectModal(false);
        setSuccessModalVariant('error');
        setShowRejectSuccessModal(true);
        fetchTasks();
    };

    React.useEffect(() => {
        if (isOpen && task) {
            // Reset selection on open
            setSelectedTaskIds(new Set());

            const subTasks = task.subTasks && task.subTasks.length > 0 ? task.subTasks : [task];
            subTasks.forEach(async (t: any) => {
                if (t.status_submit === 1 || t.status_approve !== 0) {
                    try {
                        const res = await api.get(`/monitoring/evidence/${t.id}`);
                        if (res.data && Array.isArray(res.data) && res.data.length > 0) {
                            setEvidenceMap(prev => ({ ...prev, [t.id]: res.data }));
                        }
                    } catch (err) {
                        console.error("Failed to fetch evidence for", t.id, err);
                    }

                    try {
                        const res = await api.get(`/monitoring/note/${t.id}`);
                        if (res.data && res.data.note) {
                            setNoteMap(prev => ({ ...prev, [t.id]: res.data.note }));
                        }
                    } catch (err) {
                        console.error("Failed to fetch note for", t.id, err);
                    }
                }
            });
        } else {
            setEvidenceMap({});
            setNoteMap({});
            setViewImage(null);
            setSelectedTaskIds(new Set());
        }
    }, [isOpen, task]);

    if (!isOpen || !task) return null;

    return ReactDOM.createPortal(
        <AnimatePresence>
            {/* Backdrop */}
            <div className="fixed inset-0 z-[50] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">

                {/* Modal Container - Using direct div instead of GlassCard to ensure flex works */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    className="w-full max-w-6xl bg-white/90 backdrop-blur-lg border border-white/40 shadow-xl rounded-2xl overflow-hidden"
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        maxHeight: '90vh',
                    }}
                >
                    {/* 1. Header (Fixed Height) */}
                    <div style={{ flexShrink: 0 }}>
                        <TaskDetailsHeader
                            task={task}
                            onClose={onClose}
                        />
                    </div>

                    {/* 2. Content Body (Scrollable - Takes Remaining Space) */}
                    <div
                        className="bg-slate-50/30 p-4 md:p-6 custom-scrollbar"
                        style={{
                            flex: 1,
                            overflowY: 'auto',
                            minHeight: 0,
                        }}
                    >
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                            <TaskDetailsInfoSidebar task={task} />

                            <TaskDetailsProcessList
                                task={task}
                                evidenceMap={evidenceMap}
                                noteMap={noteMap}
                                onViewImage={(images, index) => setViewImage({ images, currentIndex: index })}
                                selectedTaskIds={selectedTaskIds}
                                onToggleSelection={handleToggleSelection}
                            />
                        </div>
                    </div>

                    {/* 3. Footer (Fixed Height) */}
                    <div style={{ flexShrink: 0 }}>
                        <TaskDetailsFooter
                            task={task}
                            onUpdateStatus={onUpdateStatus}
                            fetchTasks={fetchTasks}
                            setSelectedTask={setSelectedTask}
                            onBulkUpdate={handleBulkUpdateWrapper}
                            selectedTaskIds={selectedTaskIds}
                            onClearSelection={() => setSelectedTaskIds(new Set())}
                            onReject={handleOpenRejectModal}
                        />
                    </div>
                </motion.div>

                {/* ImageViewer Overlay */}
                <TaskDetailsImageViewer
                    viewImage={viewImage}
                    onClose={() => setViewImage(null)}
                    onNext={() => setViewImage(prev => prev ? ({ ...prev, currentIndex: (prev.currentIndex + 1) % prev.images.length }) : null)}
                    onPrev={() => setViewImage(prev => prev ? ({ ...prev, currentIndex: (prev.currentIndex - 1 + prev.images.length) % prev.images.length }) : null)}
                />

                {/* Success Modal (Green) */}
                <SuccessModal
                    isOpen={showSuccessModal}
                    onClose={() => {
                        setShowSuccessModal(false);
                        setSelectedTaskIds(new Set());
                    }}
                    title="Duyệt thành công!"
                    message="Các quy trình được chọn đã được duyệt thành công."
                    variant="success"
                />

                {/* Reject Reason Modal */}
                <RejectModal
                    isOpen={showRejectModal}
                    onClose={() => setShowRejectModal(false)}
                    onSubmit={handleRejectSubmit}
                    title="Từ chối quy trình"
                />

                {/* Reject Success Modal (Red) */}
                <SuccessModal
                    isOpen={showRejectSuccessModal}
                    onClose={() => {
                        setShowRejectSuccessModal(false);
                        setSelectedTaskIds(new Set());
                    }}
                    title="Từ chối thành công!"
                    message="Các quy trình đã được từ chối."
                    variant="error"
                />
            </div>
        </AnimatePresence>,
        document.body
    );
};

export default TaskDetailsModal;
