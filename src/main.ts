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
const originalWrap = document.getElementById('original-wrap')!;
const canvasOriginal = document.getElementById('canvas-original') as HTMLCanvasElement;

const sectionGrayscale = document.getElementById('section-grayscale')!;
const canvasGrayscaleLum = document.getElementById('canvas-grayscale-lum') as HTMLCanvasElement;
const canvasGrayscale = document.getElementById('canvas-grayscale') as HTMLCanvasElement;
const swatchDark = document.getElementById('swatch-dark')!;
const swatchLight = document.getElementById('swatch-light')!;
const darkHexEl = document.getElementById('dark-hex')!;
const lightHexEl = document.getElementById('light-hex')!;
const btnDownloadGrayscale = document.getElementById('btn-download-grayscale')!;

const sectionGradient = document.getElementById('section-gradient')!;
const pickerDark = document.getElementById('picker-dark') as HTMLInputElement;
const pickerLight = document.getElementById('picker-light') as HTMLInputElement;
const canvasLuminance = document.getElementById('canvas-luminance') as HTMLCanvasElement;
const canvasPcaSingle = document.getElementById('canvas-pca-single') as HTMLCanvasElement;
const btnTiledPca = document.getElementById('btn-tiled-pca')!;
const btnTiledLum = document.getElementById('btn-tiled-lum')!;
const canvasGradient = document.getElementById('canvas-gradient') as HTMLCanvasElement;
const btnDownloadGradient = document.getElementById('btn-download-gradient')!;

// State
let currentResult: ProcessedImage | null = null;
let fullResGrayscaleImageData: ImageData | null = null;
let tiledMode: 'pca' | 'luminance' = 'pca';

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
  originalWrap.classList.add('hidden');
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

    // Show original next to drop zone
    drawToDisplayCanvas(canvasOriginal, img, width, height);
    originalWrap.classList.remove('hidden');
    sectionGrayscale.classList.add('hidden');
    sectionGradient.classList.add('hidden');

    // Process
    const result = processPixels(data, width, height);

    if (typeof result === 'string') {
      showError(result);
      return;
    }

    currentResult = result;

    // Build and draw grayscale (Luminance + PCA)
    fullResGrayscaleImageData = buildGrayscaleImage(result);
    const gsCanvas = imageDataToCanvas(fullResGrayscaleImageData);
    drawCanvasToDisplayCanvas(canvasGrayscale, gsCanvas, width, height);

    const lumGsImageData = buildGrayscaleImage(result, result.luminanceMap);
    const lumGsCanvas = imageDataToCanvas(lumGsImageData);
    drawCanvasToDisplayCanvas(canvasGrayscaleLum, lumGsCanvas, width, height);

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

const MAX_PREVIEW_SIZE = 256;

function getDisplayDimensions(w: number, h: number): [number, number] {
  if (w <= MAX_PREVIEW_SIZE) return [w, h];
  const scale = MAX_PREVIEW_SIZE / w;
  return [MAX_PREVIEW_SIZE, Math.round(h * scale)];
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

  // Luminance-based gradient map (single tile)
  const lumImageData = buildGradientMappedImage(currentResult, colorA, colorB, currentResult.luminanceMap);
  const lumSrcCanvas = imageDataToCanvas(lumImageData);
  drawCanvasToDisplayCanvas(canvasLuminance, lumSrcCanvas, currentResult.width, currentResult.height);

  // PCA-based gradient map (single tile)
  const pcaImageData = buildGradientMappedImage(currentResult, colorA, colorB);
  const pcaSrcCanvas = imageDataToCanvas(pcaImageData);
  drawCanvasToDisplayCanvas(canvasPcaSingle, pcaSrcCanvas, currentResult.width, currentResult.height);

  // 3x3 tiled (based on toggle)
  const tileSrc = tiledMode === 'pca' ? pcaSrcCanvas : lumSrcCanvas;
  const [tileW, tileH] = getDisplayDimensions(currentResult.width, currentResult.height);
  const tilesX = 3;
  const tilesY = 3;
  canvasGradient.width = tileW * tilesX;
  canvasGradient.height = tileH * tilesY;
  canvasGradient.style.width = `${tileW * tilesX}px`;
  canvasGradient.style.height = `${tileH * tilesY}px`;
  const ctx = canvasGradient.getContext('2d')!;
  for (let y = 0; y < tilesY; y++) {
    for (let x = 0; x < tilesX; x++) {
      ctx.drawImage(tileSrc, x * tileW, y * tileH, tileW, tileH);
    }
  }
}

pickerDark.addEventListener('input', updateGradientMap);
pickerLight.addEventListener('input', updateGradientMap);

btnTiledPca.addEventListener('click', () => {
  tiledMode = 'pca';
  btnTiledPca.classList.add('active');
  btnTiledLum.classList.remove('active');
  updateGradientMap();
});

btnTiledLum.addEventListener('click', () => {
  tiledMode = 'luminance';
  btnTiledLum.classList.add('active');
  btnTiledPca.classList.remove('active');
  updateGradientMap();
});

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
  const map = tiledMode === 'luminance' ? currentResult.luminanceMap : undefined;
  const imageData = buildGradientMappedImage(currentResult, colorA, colorB, map);
  const canvas = imageDataToCanvas(imageData);
  downloadCanvas(canvas, 'recolored.png');
});

function downloadCanvas(canvas: HTMLCanvasElement, filename: string) {
  const link = document.createElement('a');
  link.download = filename;
  link.href = canvas.toDataURL('image/png');
  link.click();
}
