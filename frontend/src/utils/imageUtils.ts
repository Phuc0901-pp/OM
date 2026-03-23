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

    // Detect ANY minio host or internal port (minio:2603, minio.raitek.cloud, etc.)
    const lowerPath = path.toLowerCase();
    if (lowerPath.includes('minio') || lowerPath.includes(':2603')) {
        let key = path;

        try {
            if (path.startsWith('http')) {
                const urlObj = new URL(path);
                key = urlObj.pathname;
            } else {
                // Handle cases like "minio:2603/dev/..."
                const slashIndex = path.indexOf('/');
                if (slashIndex !== -1) {
                    key = path.substring(slashIndex);
                }
            }
        } catch (e) {
            // fallback
        }

        // Clean up leading slashes
        while (key.startsWith('/')) {
            key = key.substring(1);
        }

        // Remove the bucket name ('dev') if present
        if (key.startsWith('dev/')) {
            key = key.substring(4);
        }

        // Remove trailing quotes if any
        if (key.endsWith('"')) key = key.slice(0, -1);

        // Make sure it goes through our proxy
        return baseUrl ? `${baseUrl}/api/media/proxy?key=${encodeURIComponent(key)}` : `/api/media/proxy?key=${encodeURIComponent(key)}`;
    }

    if (path.startsWith('http://') || path.startsWith('https://')) return path;

    // Detect MinIO Object Keys stored without 'minio' prefix (e.g. 2024/01/... or 2026/Q1/...)
    if (/^\d{4}\//.test(path)) {
        return baseUrl ? `${baseUrl}/api/media/proxy?key=${encodeURIComponent(path)}` : `/api/media/proxy?key=${encodeURIComponent(path)}`;
    }

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
