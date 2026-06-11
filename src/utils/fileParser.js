// File Parser Utility - Handles PDF and text file parsing
import * as pdfjsLib from 'pdfjs-dist';

// Set up the worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.js`;

/**
 * Parse a file and extract text content
 * @param {File} file - The file to parse
 * @returns {Promise<string>} - Extracted text content
 */
export async function parseFile(file) {
    const fileType = getFileType(file);

    switch (fileType) {
        case 'pdf':
            return await parsePDF(file);
        case 'text':
            return await parseText(file);
        default:
            throw new Error(`Unsupported file type: ${file.name}`);
    }
}

/**
 * Determine file type from file object
 */
function getFileType(file) {
    const extension = file.name.split('.').pop().toLowerCase();

    if (extension === 'pdf') return 'pdf';
    if (['txt', 'text', 'md'].includes(extension)) return 'text';
    if (file.type === 'application/pdf') return 'pdf';
    if (file.type.startsWith('text/')) return 'text';

    return 'unknown';
}

/**
 * Parse PDF file to text
 */
async function parsePDF(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
            .map(item => item.str)
            .join(' ');
        fullText += pageText + '\n';
    }

    return fullText.trim();
}

/**
 * Parse text file
 */
async function parseText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (_e) => reject(new Error('Failed to read file'));
        reader.readAsText(file);
    });
}

/**
 * Get supported file types for display
 */
export function getSupportedFileTypes() {
    return '.pdf, .txt';
}

/**
 * Check if file is supported
 */
export function isFileSupported(file) {
    const fileType = getFileType(file);
    return fileType !== 'unknown';
}

export default {
    parseFile,
    getSupportedFileTypes,
    isFileSupported
};
