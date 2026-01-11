export const calculateCompletionRate = (approved: number, total: number): string => {
    return total > 0 ? ((approved / total) * 100).toFixed(1) : '0';
};

export const calculateProgress = (completed: number, total: number): string => {
    return total > 0 ? ((completed / total) * 100).toFixed(0) : '0';
};
