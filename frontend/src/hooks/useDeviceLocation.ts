import { useState, useCallback, useEffect } from 'react';
import { useLocationStore } from '../stores/useLocationStore';

export interface LocationInfo {
    coords: {
        latitude: number;
        longitude: number;
        accuracy: number;
        altitude: number | null;
        heading: number | null;
        speed: number | null;
    };
    address: string;
    timestamp: number;
    device: {
        userAgent: string;
        language: string;
        platform: string;
    };
    error: string | null;
}

interface UseDeviceLocationOptions {
    immediate?: boolean;
    enableHighAccuracy?: boolean;
    timeout?: number;
}

const getDeviceMeta = () => ({
    userAgent: navigator.userAgent,
    language: navigator.language,
    // @ts-ignore
    platform: navigator.userAgentData?.platform || navigator.platform || 'unknown'
});

/**
 * Hook to retrieve full device location information.
 *
 * Fast path: reads from the global `useLocationStore` (pre-fetched by MainLayout).
 * Slow path: falls back to a live `getCurrentPosition` call only when the store has no data.
 */
export const useDeviceLocation = (options: UseDeviceLocationOptions = {}) => {
    const { immediate = false, enableHighAccuracy = true, timeout = 10000 } = options;
    const [location, setLocation] = useState<LocationInfo | null>(null);
    const [loading, setLoading] = useState(immediate);
    const [error, setError] = useState<string | null>(null);

    const store = useLocationStore();

    const getFullLocation = useCallback(async (): Promise<LocationInfo> => {
        setLoading(true);
        setError(null);

        // ── Fast path: global store already has a GPS fix ─────────────────────
        if (store.coords) {
            const { latitude, longitude, accuracy } = store.coords;
            const info: LocationInfo = {
                coords: { latitude, longitude, accuracy, altitude: null, heading: null, speed: null },
                address: store.address || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
                timestamp: Date.now(),
                device: getDeviceMeta(),
                error: null,
            };
            setLocation(info);
            setLoading(false);
            return info;
        }

        // ── Slow path: store is empty → live request ──────────────────────────
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                const errMsg = "Geolocation is not supported by this browser.";
                setError(errMsg);
                setLoading(false);
                reject(new Error(errMsg));
                return;
            }

            navigator.geolocation.getCurrentPosition(
                async (pos) => {
                    const { latitude, longitude, accuracy, altitude, heading, speed } = pos.coords;
                    let address = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;

                    // Reverse Geocoding via OpenStreetMap (Nominatim)
                    try {
                        const response = await fetch(
                            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
                            { headers: { 'Accept-Language': 'vi' } }
                        );
                        if (response.ok) {
                            const data = await response.json();
                            if (data && data.address) {
                                const addr = data.address;
                                const parts: string[] = [];
                                if (addr.house_number && addr.road) parts.push(`${addr.house_number} ${addr.road}`);
                                else if (addr.road) parts.push(addr.road);
                                if (addr.suburb || addr.quarter || addr.neighbourhood)
                                    parts.push(addr.suburb || addr.quarter || addr.neighbourhood);
                                if (addr.county || addr.city_district || addr.district)
                                    parts.push(addr.county || addr.city_district || addr.district);
                                if (addr.city || addr.state || addr.province)
                                    parts.push(addr.city || addr.state || addr.province);
                                if (parts.length > 0) address = parts.join(', ');
                                else if (data.display_name) address = data.display_name.split(',').slice(0, 3).join(', ');
                            }
                        }
                    } catch (e) {
                        console.warn("Reverse geocoding failed, falling back to coords", e);
                    }

                    const info: LocationInfo = {
                        coords: { latitude, longitude, accuracy, altitude, heading, speed },
                        address,
                        timestamp: pos.timestamp,
                        device: getDeviceMeta(),
                        error: null
                    };

                    setLocation(info);
                    setLoading(false);
                    resolve(info);
                },
                (err) => {
                    setLoading(false);
                    let errorMessage = "Unknown error";
                    switch (err.code) {
                        case err.PERMISSION_DENIED: errorMessage = "User denied the request for Geolocation."; break;
                        case err.POSITION_UNAVAILABLE: errorMessage = "Location information is unavailable."; break;
                        case err.TIMEOUT: errorMessage = "The request to get user location timed out."; break;
                    }
                    setError(errorMessage);

                    const errorInfo: LocationInfo = {
                        coords: { latitude: 0, longitude: 0, accuracy: 0, altitude: null, heading: null, speed: null },
                        address: "",
                        timestamp: Date.now(),
                        device: getDeviceMeta(),
                        error: errorMessage
                    };
                    setLocation(errorInfo);
                    reject(new Error(errorMessage));
                },
                { enableHighAccuracy, timeout, maximumAge: 0 }
            );
        });
    }, [enableHighAccuracy, timeout, store.coords, store.address]);

    useEffect(() => {
        if (immediate) {
            getFullLocation().catch(() => { });
        }
    }, [immediate, getFullLocation]);

    return { location, loading, error, getFullLocation };
};

export default useDeviceLocation;
