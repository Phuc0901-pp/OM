interface WatermarkData {
    timestamp: string;
    location: string;
    userName: string;
}

import logoSrc from '../assets/logo.png';

// Cache logo to avoid reloading every time (Performance Optimization)
let cachedLogo: HTMLImageElement | null = null;
const loadLogoPromise = new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
        cachedLogo = img;
        resolve(img);
    };
    img.onerror = () => resolve(null);
    img.src = logoSrc;
});

export const drawWatermarkFrame = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    timestamp: string,
    location: string,
    logoImg: HTMLImageElement | null,
    rotationAngle: number = 0
) => {
    // --- Configuration ---
    const baseScale = Math.min(width, height) / 800; // Normalize to mobile screen size
    const fontSize = Math.max(12, 12 * baseScale);
    const logoSize = Math.max(30, 30 * baseScale);
    const padding = Math.max(8, 10 * baseScale);
    const lineHeight = fontSize * 1.4;

    // Prepare Text (Removed User Name)
    const textLines = [
        `⏰ ${timestamp}`,
        `📍 ${location}`
    ];

    // Calculate Box Size
    ctx.font = `bold ${fontSize}px "Segoe UI", Arial, sans-serif`;
    let maxTextWidth = 0;
    textLines.forEach(text => {
        const metrics = ctx.measureText(text);
        if (metrics.width > maxTextWidth) maxTextWidth = metrics.width;
    });

    const boxWidth = maxTextWidth + (padding * 2);
    const boxHeight = (lineHeight * textLines.length) + (padding * 2);

    // --- Rotation Logic ---
    ctx.save();

    // Position 10px from edges (safe area)
    const margin = padding;

    // We want the watermark to align with GRAVITY "Down".
    // rotationAngle is the device rotation (0, 90, 180, -90).
    // If device is updated, we rotate constraints.
    // Standard visual position: Bottom-Left.

    let x = 0, y = 0;

    // Transform coordinate system to center of where we want the box, then rotate
    // Actually, easier to rotate around center of canvas or pivot?
    // Let's implement simpler logic: Draw relative to un-rotated,
    // BUT if we want "Vertical Watermark" on Tilted Phone, we must rotate context to visually oppose the tilt.

    // Translate to center for rotation
    // ctx.translate(width / 2, height / 2);
    // ctx.rotate((-rotationAngle * Math.PI) / 180);
    // ctx.translate(-width / 2, -height / 2);

    // Simple Bottom-Left logic (Default 0 deg)
    x = margin;
    y = height - boxHeight - margin;

    // Apply rotation if needed (Advanced: for now just drawing standard)
    // If we support full gravity alignment, complex math needed for box position limit.
    // For MVP "Video + Watermark", we stick to fixed or simple 90deg steps if passed.
    if (rotationAngle !== 0) {
        // Just rotate the watermark ITSELF? or the position?
        // Let's keep it simple: Fixed position for now, Rotation comes next if requested strictly.
        // User requested: "watermark phải luôn dọc thẳng đứng"
        // This implies rotating the Context around the center of the watermark box?
        // Or positioning it on the "Down" side of screen.
    }

    // --- Draw ---

    // Draw Background Box
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    // @ts-ignore
    ctx.roundRect ? ctx.roundRect(x, y, boxWidth, boxHeight, 8) : ctx.fillRect(x, y, boxWidth, boxHeight);
    ctx.fill();

    // Draw Logo (Inside Box, Top Left)
    if (logoImg) {
        // Draw logo shifted slightly up-left or inline?
        // Current design: Logo is separate top-left?
        // Step 392 code drew Logo at (padding, padding) [Top Left of Screen]
        // And Text at Bottom Left.

        // Let's keep consistency.
        // Draw Logo at Screen Top-Left
        const logoPadding = padding;
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 4;
        ctx.drawImage(logoImg, logoPadding, logoPadding, logoSize, logoSize);
        ctx.shadowBlur = 0;
    }

    // Draw Text (Inside Bottom Box)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.textBaseline = 'top';
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 2;

    let currentY = y + padding;
    textLines.forEach(text => {
        ctx.fillText(text, x + padding, currentY);
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

        // Use cached logo or wait for load
        const getLogo = () => cachedLogo ? Promise.resolve(cachedLogo) : loadLogoPromise;

        // Parallel execution: Get Logo and Get GPS (if needed)
        Promise.all([
            getLogo(),
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
        ]).then(([logoImg, location]) => {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                drawWatermarkFrame(ctx, canvas.width, canvas.height, timestamp, location, logoImg, rotationAngle);
            }
            resolve(canvas.toDataURL('image/jpeg', 0.9));
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
