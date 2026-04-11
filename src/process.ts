// Image processing pipeline: load → Lab conversion → PCA → grayscale → gradient map

import { srgbToLab, srgbToLinear, hexToRgb, rgbToHex } from './color';
import { computePCA } from './pca';

const MAX_PCA_SAMPLES = 100_000;
const ALPHA_THRESHOLD = 8;
const PERCENTILE_LOW = 0.001;
const PERCENTILE_HIGH = 0.999;

/** Return the values at the low and high percentiles from a Float64Array subset. */
function percentileBounds(values: Float64Array, indices: number[]): [number, number] {
  const sorted = new Float64Array(indices.length);
  for (let i = 0; i < indices.length; i++) sorted[i] = values[indices[i]];
  sorted.sort();
  const lo = sorted[Math.floor(PERCENTILE_LOW * (sorted.length - 1))];
  const hi = sorted[Math.ceil(PERCENTILE_HIGH * (sorted.length - 1))];
  return [lo, hi];
}

export interface ProcessedImage {
  /** Original image dimensions */
  width: number;
  height: number;
  /** Original RGBA pixel data */
  originalData: Uint8ClampedArray;
  /** Per-pixel normalized PCA grayscale value [0,1], length = width*height. NaN for transparent pixels. */
  grayscaleMap: Float64Array;
  /** Per-pixel normalized luminance value [0,1], length = width*height. NaN for transparent pixels. */
  luminanceMap: Float64Array;
  /** Extracted dark endpoint color as hex */
  darkHex: string;
  /** Extracted light endpoint color as hex */
  lightHex: string;
  /** Extracted dark endpoint color RGB */
  darkRgb: [number, number, number];
  /** Extracted light endpoint color RGB */
  lightRgb: [number, number, number];
}

/**
 * Load an image file into an HTMLImageElement.
 */
export function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    img.src = url;
  });
}

/**
 * Get raw RGBA pixel data from an image.
 */
export function getPixelData(img: HTMLImageElement): { data: Uint8ClampedArray; width: number; height: number } {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return { data: imageData.data, width: canvas.width, height: canvas.height };
}

/**
 * Run the full PCA processing pipeline on raw pixel data.
 * Returns the processed image with grayscale map and endpoint colors.
 */
export function processPixels(data: Uint8ClampedArray, width: number, height: number): ProcessedImage | string {
  const totalPixels = width * height;

  if (width > 4096 || height > 4096) {
    console.warn(`Large texture (${width}x${height}). Processing may be slow.`);
  }

  // Identify opaque pixels and collect their indices
  const opaqueIndices: number[] = [];
  for (let i = 0; i < totalPixels; i++) {
    if (data[i * 4 + 3] >= ALPHA_THRESHOLD) {
      opaqueIndices.push(i);
    }
  }

  if (opaqueIndices.length < 100) {
    return 'Too few opaque pixels (fewer than 100). Cannot process this image.';
  }

  // Decide which pixels to use for PCA computation (subsample if needed)
  let sampleIndices: number[];
  if (opaqueIndices.length > MAX_PCA_SAMPLES) {
    // Fisher-Yates partial shuffle to pick random samples
    const shuffled = opaqueIndices.slice();
    for (let i = 0; i < MAX_PCA_SAMPLES; i++) {
      const j = i + Math.floor(Math.random() * (shuffled.length - i));
      const tmp = shuffled[i];
      shuffled[i] = shuffled[j];
      shuffled[j] = tmp;
    }
    sampleIndices = shuffled.slice(0, MAX_PCA_SAMPLES);
  } else {
    sampleIndices = opaqueIndices;
  }

  // Convert sampled pixels to Lab
  const sampleCount = sampleIndices.length;
  const sampleLab = new Float64Array(sampleCount * 3);
  for (let i = 0; i < sampleCount; i++) {
    const pi = sampleIndices[i] * 4;
    const [L, a, b] = srgbToLab(data[pi], data[pi + 1], data[pi + 2]);
    sampleLab[i * 3] = L;
    sampleLab[i * 3 + 1] = a;
    sampleLab[i * 3 + 2] = b;
  }

  // Run PCA on the sample
  const pca = computePCA(sampleLab, sampleCount);

  // Now project ALL opaque pixels onto the principal axis
  const grayscaleMap = new Float64Array(totalPixels);
  grayscaleMap.fill(NaN); // NaN = transparent

  // We need Lab for all opaque pixels for projection
  const projections = new Float64Array(opaqueIndices.length);

  for (let i = 0; i < opaqueIndices.length; i++) {
    const pi = opaqueIndices[i] * 4;
    const [L, a, b] = srgbToLab(data[pi], data[pi + 1], data[pi + 2]);
    const d0 = L - pca.mean[0];
    const d1 = a - pca.mean[1];
    const d2 = b - pca.mean[2];
    projections[i] = d0 * pca.axis[0] + d1 * pca.axis[1] + d2 * pca.axis[2];
  }

  // Find min/max projections
  let minProj = Infinity;
  let maxProj = -Infinity;
  let minIdx = 0;
  let maxIdx = 0;

  for (let i = 0; i < projections.length; i++) {
    if (projections[i] < minProj) {
      minProj = projections[i];
      minIdx = i;
    }
    if (projections[i] > maxProj) {
      maxProj = projections[i];
      maxIdx = i;
    }
  }

  // Determine which projection direction is dark vs light
  const minPixelIdx = opaqueIndices[minIdx] * 4;
  const maxPixelIdx = opaqueIndices[maxIdx] * 4;
  const [minL] = srgbToLab(data[minPixelIdx], data[minPixelIdx + 1], data[minPixelIdx + 2]);
  const [maxL] = srgbToLab(data[maxPixelIdx], data[maxPixelIdx + 1], data[maxPixelIdx + 2]);

  const darkIdx = minL <= maxL ? minIdx : maxIdx;
  const lightIdx = minL <= maxL ? maxIdx : minIdx;

  // Handle degenerate case (single color)
  const isDegenerate = pca.eigenvalue < 1e-6 || Math.abs(projections[darkIdx] - projections[lightIdx]) < 1e-10;

  // Store raw projections in grayscaleMap temporarily for percentile computation
  for (let i = 0; i < opaqueIndices.length; i++) {
    grayscaleMap[opaqueIndices[i]] = projections[i];
  }

  // Use percentile bounds for robust normalization (outliers don't compress the range)
  const [pLo, pHi] = percentileBounds(grayscaleMap, opaqueIndices);
  const darkBound = minL <= maxL ? pLo : pHi;
  const lightBound = minL <= maxL ? pHi : pLo;
  const projRange = lightBound - darkBound;

  // Normalize projections to [0, 1] and clamp
  for (let i = 0; i < opaqueIndices.length; i++) {
    const g = isDegenerate ? 0.5 : (projections[i] - darkBound) / projRange;
    grayscaleMap[opaqueIndices[i]] = Math.max(0, Math.min(1, g));
  }

  // Extract endpoint colors (original RGB of dark/light projection pixels)
  const darkPixelIdx = opaqueIndices[darkIdx] * 4;
  const lightPixelIdx = opaqueIndices[lightIdx] * 4;

  const darkRgb: [number, number, number] = [data[darkPixelIdx], data[darkPixelIdx + 1], data[darkPixelIdx + 2]];
  const lightRgb: [number, number, number] = [data[lightPixelIdx], data[lightPixelIdx + 1], data[lightPixelIdx + 2]];

  // Compute normalized luminance map (Rec. 709 relative luminance in linear space)
  const luminanceMap = new Float64Array(totalPixels);
  luminanceMap.fill(NaN);
  let minLum = Infinity;
  let maxLum = -Infinity;

  for (let i = 0; i < opaqueIndices.length; i++) {
    const pi = opaqueIndices[i] * 4;
    const lr = srgbToLinear(data[pi]);
    const lg = srgbToLinear(data[pi + 1]);
    const lb = srgbToLinear(data[pi + 2]);
    const lum = 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
    luminanceMap[opaqueIndices[i]] = lum;
    if (lum < minLum) minLum = lum;
    if (lum > maxLum) maxLum = lum;
  }

  // Normalize to [0,1] using percentile bounds
  const lumRange = maxLum - minLum;
  if (lumRange > 1e-10) {
    const [lumLo, lumHi] = percentileBounds(luminanceMap, opaqueIndices);
    const lumNormRange = lumHi - lumLo;
    for (let i = 0; i < opaqueIndices.length; i++) {
      const idx = opaqueIndices[i];
      luminanceMap[idx] = Math.max(0, Math.min(1, (luminanceMap[idx] - lumLo) / lumNormRange));
    }
  } else {
    for (let i = 0; i < opaqueIndices.length; i++) {
      luminanceMap[opaqueIndices[i]] = 0.5;
    }
  }

  return {
    width,
    height,
    originalData: data,
    grayscaleMap,
    luminanceMap,
    darkHex: rgbToHex(...darkRgb),
    lightHex: rgbToHex(...lightRgb),
    darkRgb,
    lightRgb,
  };
}

/**
 * Build a grayscale ImageData from the grayscale map.
 */
export function buildGrayscaleImage(result: ProcessedImage, map?: Float64Array): ImageData {
  const { width, height, originalData } = result;
  const sourceMap = map ?? result.grayscaleMap;
  const imageData = new ImageData(width, height);
  const out = imageData.data;

  for (let i = 0; i < width * height; i++) {
    const g = sourceMap[i];
    if (isNaN(g)) {
      // Transparent pixel — pass through original alpha
      out[i * 4] = 0;
      out[i * 4 + 1] = 0;
      out[i * 4 + 2] = 0;
      out[i * 4 + 3] = 0;
    } else {
      const v = Math.round(g * 255);
      out[i * 4] = v;
      out[i * 4 + 1] = v;
      out[i * 4 + 2] = v;
      out[i * 4 + 3] = originalData[i * 4 + 3];
    }
  }

  return imageData;
}

/**
 * Build a gradient-mapped ImageData from the grayscale map and two colors.
 * Interpolation is done in sRGB space to match the grayscale preview
 * (whose values are perceptual, derived from Lab-space PCA projections).
 */
export function buildGradientMappedImage(
  result: ProcessedImage,
  colorAHex: string,
  colorBHex: string,
  map?: Float64Array,
): ImageData {
  const { width, height, originalData } = result;
  const sourceMap = map ?? result.grayscaleMap;
  const imageData = new ImageData(width, height);
  const out = imageData.data;

  const [aR, aG, aB] = hexToRgb(colorAHex);
  const [bR, bG, bB] = hexToRgb(colorBHex);

  for (let i = 0; i < width * height; i++) {
    const g = sourceMap[i];
    if (isNaN(g)) {
      out[i * 4] = 0;
      out[i * 4 + 1] = 0;
      out[i * 4 + 2] = 0;
      out[i * 4 + 3] = 0;
    } else {
      out[i * 4] = Math.round(aR + (bR - aR) * g);
      out[i * 4 + 1] = Math.round(aG + (bG - aG) * g);
      out[i * 4 + 2] = Math.round(aB + (bB - aB) * g);
      out[i * 4 + 3] = originalData[i * 4 + 3];
    }
  }

  return imageData;
}

/**
 * Render an ImageData to a canvas and return it (for download at full resolution).
 */
export function imageDataToCanvas(imageData: ImageData): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext('2d')!;
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}
