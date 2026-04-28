interface WatermarkData {
 timestamp: string;
 location: string;
 userName: string;
}

import logoSrc from '../assets/logo.png';
import { TIME_ICON_SVG, ADDRESS_ICON_SVG, USER_ICON_SVG, WORK_ICON_SVG, ASSET_ICON_SVG, createSvgDataUrl } from './watermarkIcons';

// Cache mechanism
interface CachedResources {
 logo: HTMLImageElement | null;
 timeIcon: HTMLImageElement | null;
 addressIcon: HTMLImageElement | null;
 userIcon: HTMLImageElement | null;
 workIcon: HTMLImageElement | null;
 assetIcon: HTMLImageElement | null;
}

export const resources: CachedResources = {
 logo: null,
 timeIcon: null,
 addressIcon: null,
 userIcon: null,
 workIcon: null,
 assetIcon: null
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
export const loadResourcesPromise = (async () => {
 const [logo, time, address, user, work, asset] = await Promise.all([
 loadImage(logoSrc),
 loadImage(createSvgDataUrl(TIME_ICON_SVG, 'white')),
 loadImage(createSvgDataUrl(ADDRESS_ICON_SVG, 'white')),
 loadImage(createSvgDataUrl(USER_ICON_SVG, 'white')),
 loadImage(createSvgDataUrl(WORK_ICON_SVG, 'white')),
 loadImage(createSvgDataUrl(ASSET_ICON_SVG, 'white'))
 ]);
 resources.logo = logo;
 resources.timeIcon = time;
 resources.addressIcon = address;
 resources.userIcon = user;
 resources.workIcon = work;
 resources.assetIcon = asset;
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
 _mapImg: HTMLImageElement | null = null, // Kept for call-site compatibility, no longer rendered
 extraInfo: string[] = []
) => {
 // We need icons from our local cache.
 const { timeIcon, addressIcon, userIcon, workIcon, assetIcon } = resources;

 // Determine logical drawing dimensions.
 // If rotated 90/-90, the watermark should be drawn as if on a landscape canvas
 // (width=height, height=width), then rotated into place on the real portrait canvas.
 const isLandscape = rotationAngle === 90 || rotationAngle === -90;
 const logicalW = isLandscape ? height : width;
 const logicalH = isLandscape ? width : height;

 // Dividing by 800 instead of 400 to make the watermark elements exactly 50% smaller
 const baseScale = Math.min(logicalW, logicalH) / 800;
 const fontSize = Math.max(12, 10 * baseScale); // adjusted base font constraint
 const iconSize = fontSize * 1.4;
 const padding = Math.max(6, 8 * baseScale); // Giảm padding của khung xuống xíu nữa
 const gap = 6 * baseScale;
 const lineHeight = fontSize * 1.5;

 // Data Structure
 const lines: { icon: HTMLImageElement | null, text: string }[] = [
 { icon: timeIcon, text: timestamp },
 { icon: addressIcon, text: location }
 ];

 extraInfo.forEach(info => {
 if (info) {
 let icon = null;
 let displayText = info;

 if (info.startsWith('NV:')) {
 icon = userIcon;
 displayText = info.replace(/^NV:\s*/, '');
 } else if (info.startsWith('DA:') || info.startsWith('QT:')) {
 icon = workIcon;
 displayText = info.replace(/^(DA|QT):\s*/, '');
 } else if (info.startsWith('TS:')) {
 icon = assetIcon;
 displayText = info.replace(/^TS:\s*/, '');
 }

 lines.push({ icon, text: displayText });
 }
 });

 // Calculate info box size with Word Wrapping
 ctx.font = `bold ${fontSize}px "Segoe UI", Arial, sans-serif`;

 const maxAllowedBoxWidth = logicalW * 0.50; // Max 70% of image width (Matches UI max-w-[70%])
 const textAvailableWidth = maxAllowedBoxWidth - (padding * 2) - iconSize - gap;

 let maxContentWidth = 0;

 // Process text into wrapped sub-lines
 const renderedLines: { icon: HTMLImageElement | null, text: string, isSubLine: boolean }[] = [];

 lines.forEach(line => {
 const words = line.text.split(/(?<=\s|-)/); // Split keeping delimiters
 let currentLine = '';
 const initialIcon = line.icon;

 for (let i = 0; i < words.length; i++) {
 const word = words[i];
 // Treat explicit newlines (if any from Lark) as definitive breaks
 const subWords = word.split('\n');

 for (let j = 0; j < subWords.length; j++) {
 if (j > 0) { // Explicit newline encountered
 renderedLines.push({ icon: currentLine === '' ? initialIcon : null, text: currentLine.trimEnd(), isSubLine: currentLine !== '' });
 currentLine = '';
 }
 const testLine = currentLine + subWords[j];
 const metrics = ctx.measureText(testLine);
 const testWidth = metrics.width;

 if (testWidth > textAvailableWidth && currentLine !== '') {
 // Start new line
 renderedLines.push({ icon: renderedLines.length === 0 || currentLine === '' ? initialIcon : null, text: currentLine.trimEnd(), isSubLine: true });
 currentLine = subWords[j];
 } else {
 currentLine = testLine;
 }
 }
 }
 if (currentLine !== '') {
 // Push the remaining
 // Only attach icon to the very first piece of this logical line if not already attached
 const isFirstPiece = !renderedLines.some(rl => rl.icon === initialIcon);
 renderedLines.push({ icon: isFirstPiece ? initialIcon : null, text: currentLine.trimEnd(), isSubLine: !isFirstPiece });
 }
 });

 // Re-verify the max width out of all the computed wrapped lines
 renderedLines.forEach(line => {
 const w = (line.icon ? iconSize + gap : 0) + (!line.icon && line.isSubLine ? iconSize + gap : 0) + ctx.measureText(line.text).width;
 if (w > maxContentWidth) maxContentWidth = w;
 });

 const boxWidth = Math.min(maxContentWidth + padding * 2, maxAllowedBoxWidth);
 const boxHeight = lineHeight * renderedLines.length + padding * 2 - (lineHeight - fontSize);

 // --- Apply whole-frame matrix transform ---
 ctx.save();

 if (rotationAngle !== 0) {
 // Move origin to the real canvas center, rotate, then move to logical top-left.
 // All subsequent drawing uses logical (logicalW × logicalH) coordinates.
 ctx.translate(width / 2, height / 2);
 ctx.rotate(rotationAngle * Math.PI / 180);
 ctx.translate(-logicalW / 2, -logicalH / 2);
 }

 const margin = padding / 2; // Giảm margin tối đa để ăn sát viền (theo yêu cầu)

 // 1. Draw Info Box (bottom-left in logical space)
 const boxX = margin;
 const boxY = logicalH - boxHeight - margin;

 ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
 // @ts-ignore
 if (ctx.roundRect) { ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 8); } else { ctx.fillRect(boxX, boxY, boxWidth, boxHeight); }
 ctx.fill();

 ctx.fillStyle = 'rgba(255,255,255,1)';
 ctx.textBaseline = 'middle';

 let currentY = boxY + padding + fontSize / 2;
 renderedLines.forEach(line => {
 let textXOffset = 0;
 let drawX = boxX + padding;

 if (line.icon) {
 ctx.drawImage(line.icon, drawX, currentY - iconSize / 2, iconSize, iconSize);
 textXOffset = iconSize + gap;
 } else if (line.isSubLine) {
 // Indent wrapped text so it aligns with the text above it, not under the icon
 textXOffset = iconSize + gap;
 }

 ctx.fillText(line.text, drawX + textXOffset, currentY);
 currentY += lineHeight;
 });

 // 2. Draw Logo (top-left in logical space)
 if (logoImg) {
 const logoSize = Math.max(80, 80 * baseScale); // Slightly reduced logo size to match smaller text
 ctx.drawImage(logoImg, margin, margin, logoSize, logoSize);
 }

 // Minimap removed — no longer rendered on watermark

 ctx.restore(); // restore matrix transform
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
 * @param lat GPS latitude
 * @param lon GPS longitude
 * @param zoom Zoom level (15 is a good street-level zoom)
 * @param outW Output canvas width in pixels
 * @param outH Output canvas height in pixels
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

 // Outer shadow (removed for mobile performance)
 ctx.save();

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
 preloadedAddress?: string | null,
 extraInfo: string[] = []
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
 drawWatermarkFrame(ctx, canvas.width, canvas.height, timestamp, preloadedAddress || providedLocation || '', res.logo, rotationAngle, preloadedMapImg, extraInfo);
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
 drawWatermarkFrame(ctx, canvas.width, canvas.height, timestamp, locationData.displayAddress, res.logo, rotationAngle, locationData.mapImg, extraInfo);
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
 preloadedAddress?: string | null,
 extraInfo: string[] = []
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
 const result = await addWatermarkToCanvas(canvas, providedLocation, 0, preloadedMapImg, preloadedAddress, extraInfo);
 resolve(result);
 } else {
 reject(new Error("Canvas context error"));
 }
 };
 img.onerror = () => reject(new Error("Image load error"));
 img.src = base64Image;
 });
};

/**
 * addWatermarkToBlob
 * 
 * HIGH-PERFORMANCE version of addWatermarkToImage.
 * - Input: Blob (raw JPEG from canvas.toBlob — no Base64 encoding overhead)
 * - Output: Blob (via canvas.toBlob() — async, Non-blocking, no JS heap pressure)
 * 
 * This avoids the synchronous canvas.toDataURL() call that freezes the UI on mobile
 * after extended use. Use this for ALL new capture flows.
 */
export const addWatermarkToBlob = async (
 inputBlob: Blob,
 providedLocation?: string,
 preloadedMapImg?: HTMLImageElement | null,
 preloadedAddress?: string | null,
 extraInfo: string[] = []
): Promise<Blob> => {
 return new Promise((resolve, reject) => {
 const objectUrl = URL.createObjectURL(inputBlob);
 const img = new Image();
 img.onload = async () => {
 URL.revokeObjectURL(objectUrl); // Release immediately after load
 const canvas = document.createElement('canvas');
 canvas.width = img.width;
 canvas.height = img.height;
 const ctx = canvas.getContext('2d');
 if (!ctx) {
 reject(new Error('Canvas context error'));
 return;
 }
 ctx.drawImage(img, 0, 0);

 // Apply watermark frame
 const now = new Date();
 const timestamp = now.toLocaleString('vi-VN', {
 timeZone: 'Asia/Ho_Chi_Minh',
 year: 'numeric', month: '2-digit', day: '2-digit',
 hour: '2-digit', minute: '2-digit', second: '2-digit'
 });

 const getResources = () => resources.logo ? Promise.resolve(resources) : loadResourcesPromise;
 const res = await getResources();
 const address = preloadedAddress ?? providedLocation ?? '';
 drawWatermarkFrame(ctx, canvas.width, canvas.height, timestamp, address, res.logo, 0, preloadedMapImg ?? null, extraInfo);

 // Non-blocking async export — does NOT freeze the JS thread
 canvas.toBlob(
 (blob) => {
 if (blob) resolve(blob);
 else reject(new Error('canvas.toBlob returned null'));
 },
 'image/jpeg',
 0.92
 );
 };
 img.onerror = () => {
 URL.revokeObjectURL(objectUrl);
 reject(new Error('Image load error'));
 };
 img.src = objectUrl;
 });
};

