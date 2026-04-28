import { create } from 'zustand';
import { getStaticMapImage, getReverseGeocode } from '../utils/watermarkUtils';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GPSCoords {
 latitude: number;
 longitude: number;
 accuracy: number;
}

export interface LocationState {
 /** Raw GPS coordinates from device */
 coords: GPSCoords | null;
 /** Human-readable address from reverse-geocoding */
 address: string | null;
 /** Pre-fetched static map image for watermark/minimap */
 mapImage: HTMLImageElement | null;
 /** Whether watchPosition is currently active */
 isTracking: boolean;
 /** Last error from GPS or geocoding */
 error: string | null;
 /** ISO timestamp of last successful fix */
 lastUpdated: string | null;
}

interface LocationActions {
 startTracking: () => void;
 stopTracking: () => void;
}

// ─── Internal watchId ─────────────────────────────────────────────────────────

let _watchId: number | null = null;

// Minimum movement (metres) before we re-fetch address + map (avoids hammering OSM when standing still)
const MIN_DISTANCE_METRES = 20;

function haversineDistance(a: GPSCoords, b: GPSCoords): number {
 const R = 6371000;
 const toRad = (d: number) => (d * Math.PI) / 180;
 const dLat = toRad(b.latitude - a.latitude);
 const dLon = toRad(b.longitude - a.longitude);
 const sin2Lat = Math.sin(dLat / 2) ** 2;
 const sin2Lon = Math.sin(dLon / 2) ** 2;
 const a2 = sin2Lat + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * sin2Lon;
 return R * 2 * Math.atan2(Math.sqrt(a2), Math.sqrt(1 - a2));
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useLocationStore = create<LocationState & LocationActions>((set, get) => ({
 coords: null,
 address: null,
 mapImage: null,
 isTracking: false,
 error: null,
 lastUpdated: null,

 startTracking: () => {
 if (_watchId !== null) return; // already tracking
 if (!navigator.geolocation) {
 set({ error: 'Geolocation is not supported by this browser.', isTracking: false });
 return;
 }

 set({ isTracking: true, error: null });

 _watchId = navigator.geolocation.watchPosition(
 async (pos) => {
 const newCoords: GPSCoords = {
 latitude: pos.coords.latitude,
 longitude: pos.coords.longitude,
 accuracy: pos.coords.accuracy,
 };

 const prev = get().coords;
 const coordStr = `${newCoords.latitude.toFixed(6)}, ${newCoords.longitude.toFixed(6)}`;

 // Skip heavy work if device barely moved AND we already have the map & address
 if (prev && haversineDistance(prev, newCoords) < MIN_DISTANCE_METRES) {
 if (get().mapImage && get().address) {
 // Still update coords + timestamp, but skip network calls
 set({ coords: newCoords, lastUpdated: new Date().toISOString() });
 return;
 }
 }

 // Update coordinates immediately so components aren't blocked
 set({ coords: newCoords, lastUpdated: new Date().toISOString(), error: null });

 // Fire geocode + map fetch in parallel (background)
 try {
 const [address, mapImage] = await Promise.all([
 getReverseGeocode(coordStr),
 getStaticMapImage(coordStr),
 ]);
 set({ address, mapImage });
 } catch {
 // Non-critical — just keep old values
 }
 },
 (err) => {
 let errorMessage: string;
 switch (err.code) {
 case err.PERMISSION_DENIED:
 errorMessage = 'Người dùng đã từ chối quyền truy cập vị trí.';
 break;
 case err.POSITION_UNAVAILABLE:
 errorMessage = 'Không thể lấy vị trí hiện tại.';
 break;
 case err.TIMEOUT:
 errorMessage = 'Hết thời gian chờ lấy vị trí.';
 break;
 default:
 errorMessage = 'Lỗi không xác định khi lấy vị trí.';
 }
 set({ error: errorMessage, isTracking: false });
 },
 { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
 );
 },

 stopTracking: () => {
 if (_watchId !== null) {
 navigator.geolocation.clearWatch(_watchId);
 _watchId = null;
 }
 set({ isTracking: false });
 },
}));

// ─── Convenience Selectors ────────────────────────────────────────────────────

/** Returns a "lat, lng" string or null */
export const selectCoordString = (s: LocationState): string | null =>
 s.coords
 ? `${s.coords.latitude.toFixed(6)}, ${s.coords.longitude.toFixed(6)}`
 : null;
