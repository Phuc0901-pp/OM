export const TIME_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-clock9-icon lucide-clock-9"><path d="M12 6v6H8"/><circle cx="12" cy="12" r="10"/></svg>`;

export const ADDRESS_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-map-pin-check-icon lucide-map-pin-check"><path d="M19.43 12.935c.357-.967.57-1.955.57-2.935a8 8 0 0 0-16 0c0 4.993 5.539 10.193 7.399 11.799a1 1 0 0 0 1.202 0 32.197 32.197 0 0 0 .813-.728"/><circle cx="12" cy="10" r="3"/><path d="m16 18 2 2 4-4"/></svg>`;

// Helper to create data URL
export const createSvgDataUrl = (svgString: string, color: string = 'white'): string => {
    // Inject color if needed, or assume SVG uses currentColor and we wrap it or replace
    // The provided SVGs use stroke="currentColor". We can replace it or add style.
    // For watermark (Canvas), we usually want White icons with maybe shadow.
    // Let's force stroke="white" for simplicity in the Data URL generation.
    const coloredSvg = svgString.replace(/currentColor/g, color);
    return `data:image/svg+xml;base64,${btoa(coloredSvg)}`;
};
