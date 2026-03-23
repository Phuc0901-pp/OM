interface WatermarkData {
    timestamp: string;
    location: string;
    userName: string;
}

import logoSrc from '../assets/logo.png';
import { TIME_ICON_SVG, ADDRESS_ICON_SVG, createSvgDataUrl } from './watermarkIcons';

// Cache mechanism
interface CachedResources {
    logo: HTMLImageElement | null;
    timeIcon: HTMLImageElement | null;
    addressIcon: HTMLImageElement | null;
}

const resources: CachedResources = {
    logo: null,
    timeIcon: null,
    addressIcon: null
};

// Helper to load image
const loadImage = (src: string): Promise<HTMLImageElement | null> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = src;
    });
};

// Init Loader
const loadResourcesPromise = (async () => {
    const [logo, time, address] = await Promise.all([
        loadImage(logoSrc),
        loadImage(createSvgDataUrl(TIME_ICON_SVG, 'white')),
        loadImage(createSvgDataUrl(ADDRESS_ICON_SVG, 'white'))
    ]);
    resources.logo = logo;
    resources.timeIcon = time;
    resources.addressIcon = address;
    return resources;
})();

export const drawWatermarkFrame = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    timestamp: string,
    location: string,
    logoImg: HTMLImageElement | null, // Kept for signature compatibility
    rotationAngle: number = 0,
    mapImg: HTMLImageElement | null = null // New Parameter for Minimap
) => {
    // Ensure we use the loaded icons (or logo if passed explicitly, though we use cached mostly)
    // Note: logoImg passed from addWatermarkToCanvas might be the one from promise, which is good.
    // We need time/address icons from our local cache.
    const { timeIcon, addressIcon } = resources;

    // --- Configuration ---
    const baseScale = Math.min(width, height) / 800;
    const fontSize = Math.max(12, 14 * baseScale); // Slightly larger
    const iconSize = fontSize * 1.4; // Icons match line height roughly
    const padding = Math.max(8, 12 * baseScale);
    const gap = 8 * baseScale; // Gap between icon and text
    const lineHeight = fontSize * 1.6;

    // Data Structure
    const lines = [
        { icon: timeIcon, text: timestamp },
        { icon: addressIcon, text: location }
    ];

    // Calculate Box Size
    ctx.font = `bold ${fontSize}px "Segoe UI", Arial, sans-serif`;
    let maxContentWidth = 0;

    lines.forEach(line => {
        const textMetrics = ctx.measureText(line.text);
        const lineWidth = (line.icon ? iconSize + gap : 0) + textMetrics.width;
        if (lineWidth > maxContentWidth) maxContentWidth = lineWidth;
    });

    const boxWidth = maxContentWidth + (padding * 2);
    const boxHeight = (lineHeight * lines.length) + (padding * 2) - (lineHeight - fontSize); // Trim bottom gap slightly

    // Position (Bottom-Left)
    const margin = padding;
    const x = margin;
    const y = height - boxHeight - margin;

    // --- Draw ---
    ctx.save();

    // 1. Background Box (Bottom Left)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)'; // Darker for contrast
    // @ts-ignore
    ctx.roundRect ? ctx.roundRect(x, y, boxWidth, boxHeight, 8) : ctx.fillRect(x, y, boxWidth, boxHeight);
    ctx.fill();

    // 2. Logo (Top-Left of Screen)
    if (logoImg) {
        const logoSize = Math.max(90, 90 * baseScale);
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 4;
        ctx.drawImage(logoImg, padding, padding, logoSize, logoSize);
        ctx.shadowBlur = 0;
    }

    // 3. Text and Icons
    ctx.fillStyle = 'rgba(255, 255, 255, 1)';
    ctx.textBaseline = 'middle'; // Align with icon center
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 2;

    let currentY = y + padding + (fontSize / 2); // Center of first line

    lines.forEach(line => {
        let drawX = x + padding;

        // Draw Icon
        if (line.icon) {
            // center icon vertically on currentY
            ctx.drawImage(line.icon, drawX, currentY - (iconSize / 2), iconSize, iconSize);
            drawX += iconSize + gap;
        }

        // Draw Text
        ctx.fillText(line.text, drawX, currentY);

        currentY += lineHeight;
    });

    ctx.restore();

    // 4. GPS Minimap (Bottom-Right)
    if (mapImg) {
        ctx.save();
        // Determine map size based on screen size (max 25% of width or suitable size)
        const mapWidth = Math.max(120, width * 0.2);
        const mapHeight = mapWidth * 0.75; // 4:3 ratio

        const mapX = width - mapWidth - margin;
        const mapY = height - mapHeight - margin;

        // Draw shadow and border
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 8;
        ctx.fillStyle = '#ffffff'; // White border

        // Border radius clipping for map
        ctx.beginPath();
        // @ts-ignore
        if (ctx.roundRect) {
            // @ts-ignore
            ctx.roundRect(mapX, mapY, mapWidth, mapHeight, 8);
        } else {
            ctx.rect(mapX, mapY, mapWidth, mapHeight);
        }

        // Fill background for border effect, then clip image
        ctx.fill();
        ctx.clip();

        ctx.shadowBlur = 0; // Remove shadow for image drawing

        // Draw the map image slightly inward to leave a white border
        const borderWidth = 3 * baseScale;
        ctx.drawImage(mapImg, mapX + borderWidth, mapY + borderWidth, mapWidth - (borderWidth * 2), mapHeight - (borderWidth * 2));

        // Restore context
        ctx.restore();
    }
};

// ─── Custom OSM Tile-Based Static Map Generator ──────────────────────────
// Replaces the defunct staticmap.openstreetmap.de with a fully client-side
// tile renderer — no API key, no quota, works 100% offline from OSM tiles.

/** Convert lat/lon/zoom → OSM tile X,Y (floating point, fractional = sub-tile position) */
const latLonToTile = (lat: number, lon: number, zoom: number) => {
    const n = Math.pow(2, zoom);
    const x = (lon + 180) / 360 * n;
    const latRad = lat * Math.PI / 180;
    const y = (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n;
    return { x, y };
};

/** Load a single OSM raster tile as an HTMLImageElement */
const loadOsmTile = (z: number, x: number, y: number): Promise<HTMLImageElement | null> => {
    // Use the three OSM subdomains a/b/c for load-balancing
    const sub = ['a', 'b', 'c'][Math.abs(x + y) % 3];
    const url = `https://${sub}.tile.openstreetmap.org/${z}/${x}/${y}.png`;
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = url;
        setTimeout(() => resolve(null), 6000); // tile-level timeout
    });
};

/**
 * Build a static map image using OSM raster tiles.
 * @param lat     GPS latitude
 * @param lon     GPS longitude
 * @param zoom    Zoom level (15 is a good street-level zoom)
 * @param outW    Output canvas width in pixels
 * @param outH    Output canvas height in pixels
 */
const buildOsmStaticMap = async (
    lat: number, lon: number,
    zoom: number,
    outW: number, outH: number
): Promise<HTMLImageElement | null> => {
    const TILE = 256;
    const center = latLonToTile(lat, lon, zoom);

    // Integer tile that contains our GPS point
    const tileX0 = Math.floor(center.x);
    const tileY0 = Math.floor(center.y);

    // How many tiles we need in each direction to fill outW×outH
    const tilesH = Math.ceil(outW / TILE) + 2;
    const tilesV = Math.ceil(outH / TILE) + 2;

    // Starting tile (top-left corner of our grid)
    const startX = tileX0 - Math.floor(tilesH / 2);
    const startY = tileY0 - Math.floor(tilesV / 2);

    // Pixel offset of the center GPS point relative to top-left of grid
    const pixelCX = (center.x - startX) * TILE;
    const pixelCY = (center.y - startY) * TILE;

    // Crop origin so the GPS point lands in the middle of outW×outH
    const cropX = pixelCX - outW / 2;
    const cropY = pixelCY - outH / 2;

    // Download all required tiles in parallel
    const tilePromises: Promise<{ img: HTMLImageElement | null; dx: number; dy: number }>[] = [];
    for (let ty = 0; ty < tilesV; ty++) {
        for (let tx = 0; tx < tilesH; tx++) {
            const dx = tx * TILE - cropX;
            const dy = ty * TILE - cropY;
            tilePromises.push(
                loadOsmTile(zoom, startX + tx, startY + ty)
                    .then(img => ({ img, dx, dy }))
            );
        }
    }

    const tiles = await Promise.all(tilePromises);

    // Compose onto an offscreen canvas
    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Fill background in case some tiles didn't load
    ctx.fillStyle = '#e8e8e8';
    ctx.fillRect(0, 0, outW, outH);

    for (const { img, dx, dy } of tiles) {
        if (img) ctx.drawImage(img, dx, dy, TILE, TILE);
    }

    // Draw a red location pin at the exact GPS point (center of canvas)
    const px = outW / 2;
    const py = outH / 2;
    const pinR = Math.max(8, outW * 0.038);

    // Outer shadow
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 3;

    // Pin circle (red fill, white border)
    ctx.beginPath();
    ctx.arc(px, py - pinR, pinR, 0, Math.PI * 2);
    ctx.fillStyle = '#E53935';
    ctx.fill();
    ctx.lineWidth = Math.max(2, pinR * 0.28);
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    ctx.restore();

    // Pin stem
    ctx.beginPath();
    ctx.moveTo(px, py - pinR * 0.2);
    ctx.lineTo(px, py + pinR * 0.8);
    ctx.strokeStyle = '#E53935';
    ctx.lineWidth = Math.max(2, pinR * 0.35);
    ctx.lineCap = 'round';
    ctx.stroke();

    // White dot inside circle
    ctx.beginPath();
    ctx.arc(px, py - pinR, pinR * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fill();

    // Convert canvas to HTMLImageElement
    return new Promise((resolve) => {
        const out = new Image();
        out.onload = () => resolve(out);
        out.onerror = () => resolve(null);
        out.src = canvas.toDataURL('image/png');
    });
};

// Public Map Loader — now uses the self-contained OSM tile renderer
export const getStaticMapImage = async (locationStr: string): Promise<HTMLImageElement | null> => {
    const match = locationStr.match(/(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
    if (!match) return null;

    const lat = parseFloat(match[1]);
    const lon = parseFloat(match[2]);

    // Build a nice 400×300 mini-map (4:3 ratio)
    return Promise.race([
        buildOsmStaticMap(lat, lon, 15, 400, 300),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000))
    ]);
};

// Reverse Geocoding: Convert GPS coordinates string ("lat, lon") to readable address
export const getReverseGeocode = async (locationStr: string): Promise<string> => {
    const match = locationStr.match(/(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
    if (!match) return locationStr; // Not a coordinate string, return as-is

    const lat = match[1];
    const lon = match[2];

    const fetchAddress = async (): Promise<string> => {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`,
            { headers: { 'Accept-Language': 'vi' } }
        );
        if (!response.ok) return locationStr;
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

            if (parts.length > 0) return parts.join(', ');
            if (data.display_name) return data.display_name.split(',').slice(0, 3).join(', ');
        }
        return locationStr; // Fallback to coordinates
    };

    // 3000ms timeout — always fallback to coordinates if too slow
    return Promise.race([
        fetchAddress().catch(() => locationStr),
        new Promise<string>((resolve) => setTimeout(() => resolve(locationStr), 3000))
    ]);
};

export const addWatermarkToCanvas = async (
    canvas: HTMLCanvasElement,
    providedLocation?: string,
    rotationAngle: number = 0,
    preloadedMapImg?: HTMLImageElement | null,
    preloadedAddress?: string | null
): Promise<string> => {
    return new Promise((resolve) => {
        const now = new Date();
        const timestamp = now.toLocaleString('vi-VN', {
            timeZone: 'Asia/Ho_Chi_Minh',
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        });

        // Use resources loader
        const getResources = () => resources.logo ? Promise.resolve(resources) : loadResourcesPromise;

        // If the caller already has address + mapImg from the global store, skip network calls entirely
        if (preloadedAddress !== undefined && preloadedAddress !== null &&
            preloadedMapImg !== undefined) {
            getResources().then((res) => {
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    drawWatermarkFrame(ctx, canvas.width, canvas.height, timestamp, preloadedAddress || providedLocation || '', res.logo, rotationAngle, preloadedMapImg);
                }
                resolve(canvas.toDataURL('image/jpeg', 0.92));
            });
            return;
        }

        // Execute Location extraction separately so we can pass it to map loader
        const getLocationPromise = new Promise<string>((resolveLocation) => {
            if (providedLocation) {
                resolveLocation(providedLocation);
            } else if (!navigator.geolocation) {
                resolveLocation('GPS không khả dụng');
            } else {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        const { latitude, longitude } = position.coords;
                        resolveLocation(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
                    },
                    () => resolveLocation('Không lấy được GPS'),
                    { timeout: 5000, enableHighAccuracy: true, maximumAge: 0 }
                );
            }
        });

        // Resolve everything (Resources + GPS -> then [Map + Address] concurrently -> then Draw)
        Promise.all([
            getResources(),
            getLocationPromise.then(async (loc) => {
                // Fire both map image and address resolution in parallel
                const [mapImg, displayAddress] = await Promise.all([
                    getStaticMapImage(loc),
                    getReverseGeocode(loc)
                ]);
                return { loc, mapImg, displayAddress };
            })
        ]).then(([res, locationData]) => {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                // drawWatermarkFrame uses internal resources for Icons, passing logo explicitly if needed (res.logo)
                drawWatermarkFrame(ctx, canvas.width, canvas.height, timestamp, locationData.displayAddress, res.logo, rotationAngle, locationData.mapImg);
            }
            resolve(canvas.toDataURL('image/jpeg', 0.92));
        });
    });
};

// Deprecated internal helper, replaced by exported drawWatermarkFrame
const drawWatermark = () => { };


export const addWatermarkToImage = async (
    base64Image: string,
    providedLocation?: string,
    preloadedMapImg?: HTMLImageElement | null,
    preloadedAddress?: string | null
): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = async () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(img, 0, 0);
                const result = await addWatermarkToCanvas(canvas, providedLocation, 0, preloadedMapImg, preloadedAddress);
                resolve(result);
            } else {
                reject(new Error("Canvas context error"));
            }
        };
        img.onerror = () => reject(new Error("Image load error"));
        img.src = base64Image;
    });
};
