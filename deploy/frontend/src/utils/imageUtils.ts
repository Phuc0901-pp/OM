export const getImageUrl = (item: string | Blob | undefined | null): string => {
    if (!item) return '';
    if (typeof item !== 'string') return URL.createObjectURL(item);
    if (item.startsWith('blob:')) return item;
    if (item.startsWith('data:')) return item;
    if (item.startsWith('http://') || item.startsWith('https://')) return item;

    const apiUrl = import.meta.env.VITE_API_URL || '/api';
    // Remove /api suffix if present to get the domain root
    const baseUrl = apiUrl.endsWith('/api') ? apiUrl.slice(0, -4) : apiUrl;

    // Handle URLs already having /api prefix
    if (item.startsWith('/api/')) {
        return baseUrl ? `${baseUrl}${item}` : item;
    }

    // Handle legacy URLs missing /api prefix (e.g., /media/proxy?...)
    if (item.startsWith('/media/')) {
        return baseUrl ? `${baseUrl}/api${item}` : `/api${item}`;
    }

    // Handle malformed relative URLs (e.g. proxy?key=...)
    if (item.startsWith('proxy?key=')) {
        return baseUrl ? `${baseUrl}/api/media/${item}` : `/api/media/${item}`;
    }

    // Other relative paths starting with /
    if (item.startsWith('/')) {
        return baseUrl ? `${baseUrl}${item}` : item;
    }

    // Fallback for paths without leading slash (likely relative to root or api)
    // We assume they should be relative to API if they are uploads?
    // Or just append / to be safe.
    return baseUrl ? `${baseUrl}/${item}` : `/${item}`;
};
