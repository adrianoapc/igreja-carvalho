import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Configure worker to use a bundled, same-origin asset to avoid CDN fetch failures
GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

/**
 * Generate a thumbnail from the first page of a PDF
 * @param pdfSource - URL or File object of the PDF
 * @param scale - Scale factor for the thumbnail (default 0.5)
 * @returns Promise<string> - Data URL of the thumbnail image
 */
export async function generatePdfThumbnail(
  pdfSource: string | File,
  scale: number = 0.5
): Promise<string> {
  try {
    let pdfData: ArrayBuffer | string;
    
    if (pdfSource instanceof File) {
      pdfData = await pdfSource.arrayBuffer();
    } else {
      // For URLs, fetch the PDF
      const response = await fetch(pdfSource);
      pdfData = await response.arrayBuffer();
    }
    
    // Load the PDF document
    const loadingTask = getDocument({ data: pdfData });
    const pdf = await loadingTask.promise;
    
    // Get the first page
    const page = await pdf.getPage(1);
    
    // Get viewport at desired scale
    const viewport = page.getViewport({ scale });
    
    // Create canvas
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    if (!context) {
      throw new Error('Could not get canvas context');
    }
    
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    
    // Render the page to canvas
    await page.render({
      canvasContext: context,
      viewport: viewport,
    }).promise;
    
    // Convert canvas to data URL
    const dataUrl = canvas.toDataURL('image/png');
    
    // Clean up
    pdf.destroy();
    
    return dataUrl;
  } catch (error) {
    const isPasswordError = error instanceof Error && error.name === 'PasswordException';
    console.error('Error generating PDF thumbnail:', error);
    if (isPasswordError) {
      throw new Error('PDF protegido por senha; preview indisponivel.');
    }
    throw error;
  }
}
