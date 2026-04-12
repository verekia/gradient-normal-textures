import './style.css';
import {
  loadImage,
  getPixelData,
  processPixels,
  applyLuminanceClamp,
  buildGrayscaleImage,
  buildGradientMappedImage,
  buildChannelPackedImage,
  imageDataToCanvas,
  type ProcessedImage,
} from './process';
import {
  initThreeScene,
  setColorTexture,
  setNormalTexture,
  setTextureRepeat,
  setMaterialType,
  setDirectionalIntensity,
  setNormalScale,
} from './three-scene';

// DOM elements — texture drop
const dropZoneWrap = document.getElementById('drop-zone-wrap')!;
const dropZone = document.getElementById('drop-zone')!;
const fileInput = document.getElementById('file-input') as HTMLInputElement;
const errorMessage = document.getElementById('error-message')!;
const originalWrap = document.getElementById('original-wrap')!;
const canvasOriginal = document.getElementById('canvas-original') as HTMLCanvasElement;

// DOM elements — normal map drop
const dropZoneNormalWrap = document.getElementById('drop-zone-normal-wrap')!;
const dropZoneNormal = document.getElementById('drop-zone-normal')!;
const fileInputNormal = document.getElementById('file-input-normal') as HTMLInputElement;
const normalWrap = document.getElementById('normal-wrap')!;
const canvasNormal = document.getElementById('canvas-normal') as HTMLCanvasElement;

const sectionGrayscale = document.getElementById('section-grayscale')!;
const canvasGrayscaleLum = document.getElementById('canvas-grayscale-lum') as HTMLCanvasElement;
const packedLumWrap = document.getElementById('packed-lum-wrap')!;
const canvasPackedLum = document.getElementById('canvas-packed-lum') as HTMLCanvasElement;
const clampLow = document.getElementById('clamp-low') as HTMLInputElement;
const clampHigh = document.getElementById('clamp-high') as HTMLInputElement;
const clampLowValue = document.getElementById('clamp-low-value')!;
const clampHighValue = document.getElementById('clamp-high-value')!;

const sectionGradient = document.getElementById('section-gradient')!;
const pickerDark = document.getElementById('picker-dark') as HTMLInputElement;
const pickerLight = document.getElementById('picker-light') as HTMLInputElement;
const canvasLuminance = document.getElementById('canvas-luminance') as HTMLCanvasElement;
const canvasGradient = document.getElementById('canvas-gradient') as HTMLCanvasElement;

const section3d = document.getElementById('section-3d')!;
const threeContainer = document.getElementById('three-container')!;
const texSize = document.getElementById('tex-size') as HTMLInputElement;
const texSizeValue = document.getElementById('tex-size-value')!;
const lightIntensity = document.getElementById('light-intensity') as HTMLInputElement;
const lightIntensityValue = document.getElementById('light-intensity-value')!;
const normalScale = document.getElementById('normal-scale') as HTMLInputElement;
const normalScaleValue = document.getElementById('normal-scale-value')!;
const btnMatStandard = document.getElementById('btn-mat-standard')!;
const btnMatLambert = document.getElementById('btn-mat-lambert')!;

// State
let currentResult: ProcessedImage | null = null;
let normalMapData: Uint8ClampedArray | null = null;
let normalMapWidth = 0;
let normalMapHeight = 0;
let dragCounter = 0;

function rafThrottle(fn: () => void): () => void {
  let scheduled = false;
  return () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      fn();
    });
  };
}

function updateDropZoneVisibility() {
  const dragging = dragCounter > 0;
  const hasTexture = currentResult != null;
  const hasNormal = normalMapData != null;
  dropZoneWrap.classList.toggle('hidden', hasTexture && !dragging);
  dropZoneNormalWrap.classList.toggle('hidden', hasNormal && !dragging);
  originalWrap.classList.toggle('hidden', !hasTexture || dragging);
  normalWrap.classList.toggle('hidden', !hasNormal || dragging);
}

window.addEventListener('dragenter', (e) => {
  if (!e.dataTransfer?.types.includes('Files')) return;
  dragCounter++;
  updateDropZoneVisibility();
});

window.addEventListener('dragleave', (e) => {
  if (!e.dataTransfer?.types.includes('Files')) return;
  dragCounter = Math.max(0, dragCounter - 1);
  updateDropZoneVisibility();
});

window.addEventListener('dragover', (e) => {
  e.preventDefault();
});

window.addEventListener('drop', (e) => {
  e.preventDefault();
  dragCounter = 0;
  updateDropZoneVisibility();
});

// --- Drop zone handling (texture) ---

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

// --- Drop zone handling (normal map) ---

dropZoneNormal.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZoneNormal.classList.add('drag-over');
});

dropZoneNormal.addEventListener('dragleave', () => {
  dropZoneNormal.classList.remove('drag-over');
});

dropZoneNormal.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZoneNormal.classList.remove('drag-over');
  const file = e.dataTransfer?.files[0];
  if (file) handleNormalMap(file);
});

fileInputNormal.addEventListener('change', () => {
  const file = fileInputNormal.files?.[0];
  if (file) handleNormalMap(file);
});

// --- File handling ---

function showError(msg: string) {
  errorMessage.textContent = msg;
  errorMessage.classList.remove('hidden');
  sectionGrayscale.classList.add('hidden');
  sectionGradient.classList.add('hidden');
}

function clearError() {
  errorMessage.classList.add('hidden');
}

async function handleNormalMap(file: File) {
  const validTypes = ['image/png', 'image/jpeg', 'image/webp'];
  if (!validTypes.includes(file.type)) return;

  try {
    const img = await loadImage(file);
    const { data, width, height } = getPixelData(img);

    normalMapData = data;
    normalMapWidth = width;
    normalMapHeight = height;

    drawToDisplayCanvas(canvasNormal, img, width, height);
    updateDropZoneVisibility();

    updateChannelPacked();
    updateThreeScene();
  } catch {
    // silently ignore
  }
}

function updateChannelPacked() {
  if (!currentResult || !normalMapData) {
    packedLumWrap.classList.add('hidden');
    return;
  }

  if (normalMapWidth !== currentResult.width || normalMapHeight !== currentResult.height) {
    packedLumWrap.classList.add('hidden');
    return;
  }

  const { width, height } = currentResult;

  const packedLumImageData = buildChannelPackedImage(normalMapData, currentResult.luminanceMap, width, height);
  const packedLumCanvas = imageDataToCanvas(packedLumImageData);
  drawCanvasToDisplayCanvas(canvasPackedLum, packedLumCanvas, width, height);
  packedLumWrap.classList.remove('hidden');
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

    drawToDisplayCanvas(canvasOriginal, img, width, height);
    sectionGrayscale.classList.add('hidden');
    sectionGradient.classList.add('hidden');

    const result = processPixels(data, width, height);

    if (typeof result === 'string') {
      showError(result);
      return;
    }

    currentResult = result;

    // Apply current clamp values (file may be loaded after user moved sliders)
    applyLuminanceClamp(result, +clampLow.value / 100, +clampHigh.value / 100);

    renderLuminanceOutputs();

    sectionGrayscale.classList.remove('hidden');
    sectionGradient.classList.remove('hidden');
    updateDropZoneVisibility();
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
  canvas.width = w;
  canvas.height = h;
  canvas.style.width = `${dw}px`;
  canvas.style.height = `${dh}px`;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
}

function drawCanvasToDisplayCanvas(displayCanvas: HTMLCanvasElement, sourceCanvas: HTMLCanvasElement, w: number, h: number) {
  const [dw, dh] = getDisplayDimensions(w, h);
  displayCanvas.width = w;
  displayCanvas.height = h;
  displayCanvas.style.width = `${dw}px`;
  displayCanvas.style.height = `${dh}px`;
  const ctx = displayCanvas.getContext('2d')!;
  ctx.drawImage(sourceCanvas, 0, 0);
}

// --- Gradient map ---

let gradientTileCanvas: HTMLCanvasElement | null = null;

function updateGradientMap() {
  if (!currentResult) return;

  const colorA = pickerDark.value;
  const colorB = pickerLight.value;

  const lumImageData = buildGradientMappedImage(currentResult, colorA, colorB);
  const lumSrcCanvas = imageDataToCanvas(lumImageData);
  gradientTileCanvas = lumSrcCanvas;
  drawCanvasToDisplayCanvas(canvasLuminance, lumSrcCanvas, currentResult.width, currentResult.height);

  const { width: fullW, height: fullH } = currentResult;
  const [displayW, displayH] = getDisplayDimensions(fullW, fullH);
  const tilesX = 3;
  const tilesY = 3;
  canvasGradient.width = fullW * tilesX;
  canvasGradient.height = fullH * tilesY;
  canvasGradient.style.width = `${displayW * tilesX}px`;
  canvasGradient.style.height = `${displayH * tilesY}px`;
  const ctx = canvasGradient.getContext('2d')!;
  for (let y = 0; y < tilesY; y++) {
    for (let x = 0; x < tilesX; x++) {
      ctx.drawImage(lumSrcCanvas, x * fullW, y * fullH);
    }
  }

  updateThreeScene();
}

function updateThreeScene() {
  if (!currentResult || !normalMapData || !gradientTileCanvas) {
    section3d.classList.add('hidden');
    return;
  }
  if (normalMapWidth !== currentResult.width || normalMapHeight !== currentResult.height) {
    section3d.classList.add('hidden');
    return;
  }
  section3d.classList.remove('hidden');
  initThreeScene(threeContainer);
  setColorTexture(gradientTileCanvas);
  setNormalTexture(canvasNormal);
}

const scheduleGradientUpdate = rafThrottle(updateGradientMap);
pickerDark.addEventListener('input', scheduleGradientUpdate);
pickerLight.addEventListener('input', scheduleGradientUpdate);

function renderLuminanceOutputs() {
  if (!currentResult) return;
  const { width, height } = currentResult;

  const lumGsImageData = buildGrayscaleImage(currentResult);
  const lumGsCanvas = imageDataToCanvas(lumGsImageData);
  drawCanvasToDisplayCanvas(canvasGrayscaleLum, lumGsCanvas, width, height);

  updateChannelPacked();
  updateGradientMap();
}

const scheduleClampRecompute = rafThrottle(() => {
  if (!currentResult) return;
  applyLuminanceClamp(currentResult, +clampLow.value / 100, +clampHigh.value / 100);
  renderLuminanceOutputs();
});

function onClampChange() {
  clampLowValue.textContent = `${(+clampLow.value).toFixed(1)}%`;
  clampHighValue.textContent = `${(+clampHigh.value).toFixed(1)}%`;
  scheduleClampRecompute();
}

clampLow.addEventListener('input', onClampChange);
clampHigh.addEventListener('input', onClampChange);

texSize.addEventListener('input', () => {
  const v = +texSize.value;
  texSizeValue.textContent = `${v.toFixed(1)}×`;
  setTextureRepeat(v);
});

lightIntensity.addEventListener('input', () => {
  const v = +lightIntensity.value;
  lightIntensityValue.textContent = v.toFixed(2);
  setDirectionalIntensity(v);
});

normalScale.addEventListener('input', () => {
  const v = +normalScale.value;
  normalScaleValue.textContent = v.toFixed(2);
  setNormalScale(v);
});

btnMatStandard.addEventListener('click', () => {
  btnMatStandard.classList.add('active');
  btnMatLambert.classList.remove('active');
  setMaterialType('standard');
});

btnMatLambert.addEventListener('click', () => {
  btnMatLambert.classList.add('active');
  btnMatStandard.classList.remove('active');
  setMaterialType('lambert');
});
