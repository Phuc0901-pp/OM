import React, { useMemo } from 'react';
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
 onLightboxImage: (src: string, alt: string) => void;
}

const FilteredTaskContainer: React.FC<FilteredTaskContainerProps> = ({
 taskData,
 metadata,
 onLightboxImage
}) => {

 const filteredTasks = useMemo(() => {
 // 1. Task ID Filter (Absolute Best - Specific Task)
 const taskId = metadata?.task_id;
 if (taskId) {
  const specificTask = taskData.find(t => t.id === taskId);
  if (specificTask) return [specificTask];
 }

 // 2. Metadata Filter (Station Level)
 const stationId = metadata?.station_id;
 if (stationId) {
  const normalizedStationId = stationId.toLowerCase();
  const filtered = taskData.filter(t => {
  const tSid = (t.station_id || '').toLowerCase();
  const tSidFromObj = ((t.station as any)?.id || '').toLowerCase();
  return tSid === normalizedStationId || tSidFromObj === normalizedStationId;
  });
  if (filtered.length > 0) return filtered;
 }

 // 3. Default: Show all
 return taskData;
 }, [taskData, metadata]);

 return (
 <TaskGroupContainerComponent
  tasks={filteredTasks}
  onImageClick={onLightboxImage}
 />
 );
};

export default FilteredTaskContainer;
