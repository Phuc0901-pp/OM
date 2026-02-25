import React, { useMemo } from 'react';
import { Notification } from '../../hooks/useNotifications';
import TaskGroupContainerComponent from './TaskGroupContainer';

interface TaskDetail {
    id: string;
    station_id?: string;
    station?: { id: string; name: string };
    child_category?: { name: string; main_category?: { name: string } };
    station_name?: string;
    [key: string]: any;
}

interface FilteredTaskContainerProps {
    taskData: TaskDetail[];
    metadata: any;
    notification: Notification;
    onLightboxImage: (src: string, alt: string) => void;
}



const FilteredTaskContainer: React.FC<FilteredTaskContainerProps> = ({
    taskData,
    metadata,
    notification,
    onLightboxImage
}) => {

    const filteredTasks = useMemo(() => {
        console.log('[NotifModal] Metadata:', JSON.stringify(metadata));
        console.log('[NotifModal] TaskData count:', taskData.length);

        // 1. Task ID Filter (Absolute Best - Specific Task)
        const taskId = metadata.task_id;
        if (taskId) {
            const specificTask = taskData.find(t => t.id === taskId);
            if (specificTask) {
                console.log('[NotifModal] [SUCCESS] Matched by task_id:', taskId);
                return [specificTask];
            }
            console.log('[NotifModal] [FAIL] task_id not found in taskData:', taskId);
        }

        // 2. Metadata Filter (Station Level)
        const stationId = metadata.station_id;
        if (stationId) {
            const normalizedStationId = stationId.toLowerCase();
            const filtered = taskData.filter(t => {
                const tSid = (t.station_id || '').toLowerCase();
                const tSidFromObj = ((t.station as any)?.id || '').toLowerCase();
                return tSid === normalizedStationId || tSidFromObj === normalizedStationId;
            });
            if (filtered.length > 0) {
                console.log('[NotifModal] [SUCCESS] Matched by station_id:', stationId, '→', filtered.length, 'tasks');
                return filtered;
            }
            console.log('[NotifModal] [FAIL] station_id filter returned 0.');
        }

        // 3. Fallback: Smart Text Parsing (Progressive Narrowing)
        if (notification?.message) {
            let candidateTasks = [...taskData];
            const msgInfo = notification.message.toLowerCase();

            // A. Narrow by Child Category name from message
            const taskMatch = notification.message.match(/Công việc:\s*(.*?)(?:\n|$)/i);
            if (taskMatch && taskMatch[1]) {
                const extractedTaskString = taskMatch[1].trim().toLowerCase();
                const taskFiltered = candidateTasks.filter(t => {
                    const childName = (t.child_category?.name || '').toLowerCase();
                    return childName && extractedTaskString.includes(childName);
                });
                if (taskFiltered.length > 0) {
                    console.log('[NotifModal] Narrowed by child category:', taskFiltered.length, 'tasks');
                    candidateTasks = taskFiltered;
                }
            }

            // B. Narrow by Main Category
            const uniqueMainCats = Array.from(new Set(candidateTasks.map(t => t.child_category?.main_category?.name).filter(Boolean)));
            const matchedMainCat = uniqueMainCats.find(cat => msgInfo.includes(cat!.toLowerCase()));
            if (matchedMainCat) {
                const mainCatFiltered = candidateTasks.filter(t =>
                    t.child_category?.main_category?.name === matchedMainCat
                );
                if (mainCatFiltered.length > 0) {
                    console.log('[NotifModal] Narrowed by main category:', matchedMainCat, '→', mainCatFiltered.length);
                    candidateTasks = mainCatFiltered;
                }
            }

            // C. Narrow by Station name from message
            const stationMatch = notification.message.match(/Khu vực:\s*(.*?)(?:\n|$)/i);
            if (stationMatch && stationMatch[1]) {
                const extractedStation = stationMatch[1].trim().toLowerCase();
                const stationFiltered = candidateTasks.filter(t => {
                    const sName = (t.station?.name || t.station_name || '').toLowerCase();
                    return sName === extractedStation || sName.includes(extractedStation) || extractedStation.includes(sName);
                });
                if (stationFiltered.length > 0) {
                    console.log('[NotifModal] ✅ Narrowed by station:', extractedStation, '→', stationFiltered.length);
                    candidateTasks = stationFiltered;
                }
            }

            // If we narrowed at all, return the result
            if (candidateTasks.length < taskData.length) {
                console.log('[NotifModal] ✅ Final filtered:', candidateTasks.length, 'of', taskData.length);
                return candidateTasks;
            }
        }

        // 4. Default: Show all
        console.log('[NotifModal] ⚠️ No filter matched, showing all tasks');
        return taskData;
    }, [taskData, metadata, notification]);

    return (
        <TaskGroupContainerComponent
            tasks={filteredTasks}
            onImageClick={onLightboxImage}
        />
    );
};

export default FilteredTaskContainer;
