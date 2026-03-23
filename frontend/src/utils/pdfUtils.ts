import * as pdfjsLib from 'pdfjs-dist';

// Setting worker path for Vite
// using unpkg for better version matching with npm
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

export const convertPdfToImage = async (file: File): Promise<string> => {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const page = await pdf.getPage(1); // Get first page

        const viewport = page.getViewport({ scale: 2.0 }); // High res
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');

        if (!context) throw new Error("Canvas context not found");

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
            canvasContext: context,
            viewport: viewport,
            canvas: canvas
        };
        await page.render(renderContext).promise;

        return canvas.toDataURL('image/png');
    } catch (error) {
        console.error("Error converting PDF to image:", error);
        throw error;
    }
};
