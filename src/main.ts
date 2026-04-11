import './style.css';
import {
  loadImage,
  getPixelData,
  processPixels,
  buildGrayscaleImage,
  buildGradientMappedImage,
  imageDataToCanvas,
  type ProcessedImage,
} from './process';

// DOM elements
const dropZone = document.getElementById('drop-zone')!;
const fileInput = document.getElementById('file-input') as HTMLInputElement;
const errorMessage = document.getElementById('error-message')!;

const sectionOriginal = document.getElementById('section-original')!;
const canvasOriginal = document.getElementById('canvas-original') as HTMLCanvasElement;

const sectionGrayscale = document.getElementById('section-grayscale')!;
const canvasOriginalSide = document.getElementById('canvas-original-side') as HTMLCanvasElement;
const canvasGrayscale = document.getElementById('canvas-grayscale') as HTMLCanvasElement;
const swatchDark = document.getElementById('swatch-dark')!;
const swatchLight = document.getElementById('swatch-light')!;
const darkHexEl = document.getElementById('dark-hex')!;
const lightHexEl = document.getElementById('light-hex')!;
const btnDownloadGrayscale = document.getElementById('btn-download-grayscale')!;

const sectionGradient = document.getElementById('section-gradient')!;
const pickerDark = document.getElementById('picker-dark') as HTMLInputElement;
const pickerLight = document.getElementById('picker-light') as HTMLInputElement;
const canvasGradient = document.getElementById('canvas-gradient') as HTMLCanvasElement;
const btnDownloadGradient = document.getElementById('btn-download-gradient')!;

// State
let currentResult: ProcessedImage | null = null;
let fullResGrayscaleImageData: ImageData | null = null;

// --- Drop zone handling ---

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const file = e.dataTransfer?.files[0];
  if (file) handleFile(file);
});

fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  if (file) handleFile(file);
});

// --- File handling ---

function showError(msg: string) {
  errorMessage.textContent = msg;
  errorMessage.classList.remove('hidden');
  sectionOriginal.classList.add('hidden');
  sectionGrayscale.classList.add('hidden');
  sectionGradient.classList.add('hidden');
}

function clearError() {
  errorMessage.classList.add('hidden');
}

async function handleFile(file: File) {
  clearError();

  const validTypes = ['image/png', 'image/jpeg', 'image/webp'];
  if (!validTypes.includes(file.type)) {
    showError('Unsupported file type. Please use PNG, JPG, or WebP.');
    return;
  }

  try {
    const img = await loadImage(file);
    const { data, width, height } = getPixelData(img);

    // Show original (standalone, before processing)
    drawToDisplayCanvas(canvasOriginal, img, width, height);
    sectionOriginal.classList.remove('hidden');
    sectionGrayscale.classList.add('hidden');
    sectionGradient.classList.add('hidden');

    // Process
    const result = processPixels(data, width, height);

    if (typeof result === 'string') {
      showError(result);
      return;
    }

    currentResult = result;

    // Hide standalone original, show side-by-side
    sectionOriginal.classList.add('hidden');

    // Draw original in the side-by-side row
    drawToDisplayCanvas(canvasOriginalSide, img, width, height);

    // Build and draw grayscale
    fullResGrayscaleImageData = buildGrayscaleImage(result);
    const gsCanvas = imageDataToCanvas(fullResGrayscaleImageData);
    drawCanvasToDisplayCanvas(canvasGrayscale, gsCanvas, width, height);

    // Show endpoint colors
    swatchDark.style.backgroundColor = result.darkHex;
    swatchLight.style.backgroundColor = result.lightHex;
    darkHexEl.textContent = result.darkHex;
    lightHexEl.textContent = result.lightHex;

    sectionGrayscale.classList.remove('hidden');

    // Set color picker defaults
    pickerDark.value = result.darkHex;
    pickerLight.value = result.lightHex;

    // Build initial gradient mapped image
    updateGradientMap();

    sectionGradient.classList.remove('hidden');
  } catch (err) {
    showError(`Error processing image: ${(err as Error).message}`);
  }
}

// --- Display helpers ---

function getDisplayDimensions(w: number, h: number): [number, number] {
  const maxW = 512;
  if (w <= maxW) return [w, h];
  const scale = maxW / w;
  return [maxW, Math.round(h * scale)];
}

function drawToDisplayCanvas(canvas: HTMLCanvasElement, img: HTMLImageElement, w: number, h: number) {
  const [dw, dh] = getDisplayDimensions(w, h);
  canvas.width = dw;
  canvas.height = dh;
  canvas.style.width = `${dw}px`;
  canvas.style.height = `${dh}px`;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, dw, dh);
}

function drawCanvasToDisplayCanvas(displayCanvas: HTMLCanvasElement, sourceCanvas: HTMLCanvasElement, w: number, h: number) {
  const [dw, dh] = getDisplayDimensions(w, h);
  displayCanvas.width = dw;
  displayCanvas.height = dh;
  displayCanvas.style.width = `${dw}px`;
  displayCanvas.style.height = `${dh}px`;
  const ctx = displayCanvas.getContext('2d')!;
  ctx.drawImage(sourceCanvas, 0, 0, dw, dh);
}

// --- Gradient map ---

function updateGradientMap() {
  if (!currentResult) return;

  const colorA = pickerDark.value;
  const colorB = pickerLight.value;

  const imageData = buildGradientMappedImage(currentResult, colorA, colorB);
  const srcCanvas = imageDataToCanvas(imageData);
  drawCanvasToDisplayCanvas(canvasGradient, srcCanvas, currentResult.width, currentResult.height);
}

pickerDark.addEventListener('input', updateGradientMap);
pickerLight.addEventListener('input', updateGradientMap);

// --- Download buttons ---

btnDownloadGrayscale.addEventListener('click', () => {
  if (!fullResGrayscaleImageData) return;
  const canvas = imageDataToCanvas(fullResGrayscaleImageData);
  downloadCanvas(canvas, 'grayscale.png');
});

btnDownloadGradient.addEventListener('click', () => {
  if (!currentResult) return;
  const colorA = pickerDark.value;
  const colorB = pickerLight.value;
  const imageData = buildGradientMappedImage(currentResult, colorA, colorB);
  const canvas = imageDataToCanvas(imageData);
  downloadCanvas(canvas, 'recolored.png');
});

function downloadCanvas(canvas: HTMLCanvasElement, filename: string) {
  const link = document.createElement('a');
  link.download = filename;
  link.href = canvas.toDataURL('image/png');
  link.click();
}
