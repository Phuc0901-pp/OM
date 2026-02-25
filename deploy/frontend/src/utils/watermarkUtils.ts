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
    rotationAngle: number = 0
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

    // 1. Background Box
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)'; // Darker for contrast
    // @ts-ignore
    ctx.roundRect ? ctx.roundRect(x, y, boxWidth, boxHeight, 8) : ctx.fillRect(x, y, boxWidth, boxHeight);
    ctx.fill();

    // 2. Logo (Top-Left of Screen)
    if (logoImg) {
        const logoSize = Math.max(30, 30 * baseScale);
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
};

export const addWatermarkToCanvas = async (
    canvas: HTMLCanvasElement,
    providedLocation?: string,
    rotationAngle: number = 0
): Promise<string> => {
    return new Promise((resolve) => {
        const now = new Date();
        const timestamp = now.toLocaleString('vi-VN', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        });

        // Use resources loader
        const getResources = () => resources.logo ? Promise.resolve(resources) : loadResourcesPromise;

        // Parallel execution: Get Resources and Get GPS
        Promise.all([
            getResources(),
            new Promise<string>((resolveLocation) => {
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
            })
        ]).then(([res, location]) => {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                // drawWatermarkFrame uses internal resources for Icons, passing logo explicitly if needed (res.logo)
                drawWatermarkFrame(ctx, canvas.width, canvas.height, timestamp, location, res.logo, rotationAngle);
            }
            resolve(canvas.toDataURL('image/jpeg', 0.92));
        });
    });
};

// Deprecated internal helper, replaced by exported drawWatermarkFrame
const drawWatermark = () => { };


export const addWatermarkToImage = async (
    base64Image: string
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
                const result = await addWatermarkToCanvas(canvas);
                resolve(result);
            } else {
                reject(new Error("Canvas context error"));
            }
        };
        img.onerror = () => reject(new Error("Image load error"));
        img.src = base64Image;
    });
};
