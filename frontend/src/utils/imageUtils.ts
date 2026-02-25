export const getImageUrl = (item: string | Blob | undefined | null): string => {
    if (!item) return '';
    if (typeof item !== 'string') return URL.createObjectURL(item);

    // Clean string from potential JSON quotes or whitespace
    let path = item.trim();
    if (path.startsWith('"') && path.endsWith('"')) {
        path = path.slice(1, -1);
    }

    if (path.startsWith('blob:')) return path;
    if (path.startsWith('data:')) return path;

    const apiUrl = import.meta.env.VITE_API_URL || '/api';
    const baseUrl = apiUrl.endsWith('/api') ? apiUrl.slice(0, -4) : apiUrl;

    // Handle hardcoded minio.raitek.cloud URLs specifically for guide images to prevent CORS/SSL errors
    if (path.includes('minio.raitek.cloud/')) {
        // Extract the minio object key, assuming format is https://minio.raitek.cloud/bucket_name/key
        // Usually bucket is 'dev'. We just want the everything after minio.raitek.cloud/dev/
        let key = path.split('minio.raitek.cloud/')[1];
        if (key.startsWith('dev/')) {
            key = key.substring(4); // Remove 'dev/' prefix if it's there
        }

        // Rewrite to use the backend proxy so it works through Ngrok/Localhost without SSL issues
        return baseUrl ? `${baseUrl}/api/media/proxy?key=${encodeURIComponent(key)}` : `/api/media/proxy?key=${encodeURIComponent(key)}`;
    }

    if (path.startsWith('http://') || path.startsWith('https://')) return path;

    // Handle URLs already having /api prefix
    if (path.startsWith('/api/')) {
        return baseUrl ? `${baseUrl}${path}` : path;
    }

    // Handle legacy URLs missing /api prefix (e.g., /media/proxy?...)
    if (path.startsWith('/media/')) {
        return baseUrl ? `${baseUrl}/api${path}` : `/api${path}`;
    }

    // Handle malformed relative URLs (e.g. proxy?key=...)
    if (path.startsWith('proxy?key=')) {
        return baseUrl ? `${baseUrl}/api/media/${path}` : `/api/media/${path}`;
    }

    // Other relative paths starting with /
    if (path.startsWith('/')) {
        return baseUrl ? `${baseUrl}${path}` : path;
    }

    return baseUrl ? `${baseUrl}/${path}` : `/${path}`;
};
