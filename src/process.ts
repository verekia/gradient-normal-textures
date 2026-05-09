// Image processing pipeline: load → luminance → normalized grayscale → gradient map

import { srgbToLinear, hexToRgb } from './color'

const ALPHA_THRESHOLD = 8
export const DEFAULT_CLAMP_LOW = 0.001
export const DEFAULT_CLAMP_HIGH = 0.001

/** Return the values at the low and high percentiles from a Float64Array subset. */
function percentileBounds(values: Float64Array, indices: number[], lowPct: number, highPct: number): [number, number] {
  const sorted = new Float64Array(indices.length)
  for (let i = 0; i < indices.length; i++) sorted[i] = values[indices[i]]
  sorted.sort()
  const n = sorted.length
  const loIdx = Math.max(0, Math.min(n - 1, Math.floor(lowPct * (n - 1))))
  const hiIdx = Math.max(0, Math.min(n - 1, Math.ceil(highPct * (n - 1))))
  return [sorted[loIdx], sorted[hiIdx]]
}

export interface ProcessedImage {
  width: number
  height: number
  originalData: Uint8ClampedArray
  /** Raw linear luminance (Rec. 709), NaN for transparent pixels. */
  rawLuminanceMap: Float64Array
  /** Indices of opaque pixels. */
  opaqueIndices: number[]
  /** Normalized luminance in [0,1]. NaN for transparent. Recomputable via `applyLuminanceClamp`. */
  luminanceMap: Float64Array
}

export function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.addEventListener('load', () => {
      URL.revokeObjectURL(url)
      resolve(img)
    })
    img.addEventListener('error', () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image'))
    })
    img.src = url
  })
}

export function getPixelData(img: HTMLImageElement): { data: Uint8ClampedArray; width: number; height: number } {
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0)
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  return { data: imageData.data, width: canvas.width, height: canvas.height }
}

/**
 * Compute raw luminance from pixel data, then produce an initial normalized
 * luminanceMap using default clamp values. Call `applyLuminanceClamp` later to
 * update the normalized map without redoing luminance computation.
 */
export function processPixels(data: Uint8ClampedArray, width: number, height: number): ProcessedImage | string {
  const totalPixels = width * height

  if (width > 4096 || height > 4096) {
    console.warn(`Large texture (${width}x${height}). Processing may be slow.`)
  }

  const opaqueIndices: number[] = []
  for (let i = 0; i < totalPixels; i++) {
    if (data[i * 4 + 3] >= ALPHA_THRESHOLD) {
      opaqueIndices.push(i)
    }
  }

  if (opaqueIndices.length < 100) {
    return 'Too few opaque pixels (fewer than 100). Cannot process this image.'
  }

  const rawLuminanceMap = new Float64Array(totalPixels)
  rawLuminanceMap.fill(NaN)

  for (let i = 0; i < opaqueIndices.length; i++) {
    const idx = opaqueIndices[i]
    const pi = idx * 4
    const lr = srgbToLinear(data[pi])
    const lg = srgbToLinear(data[pi + 1])
    const lb = srgbToLinear(data[pi + 2])
    rawLuminanceMap[idx] = 0.2126 * lr + 0.7152 * lg + 0.0722 * lb
  }

  const luminanceMap = new Float64Array(totalPixels)
  luminanceMap.fill(NaN)

  const result: ProcessedImage = {
    width,
    height,
    originalData: data,
    rawLuminanceMap,
    opaqueIndices,
    luminanceMap,
  }

  applyLuminanceClamp(result, DEFAULT_CLAMP_LOW, DEFAULT_CLAMP_HIGH)

  return result
}

/**
 * Recompute `result.luminanceMap` from `result.rawLuminanceMap` using the given
 * clamp fractions (e.g. 0.05 = clamp the darkest 5% to 0). Mutates the map in place.
 */
export function applyLuminanceClamp(result: ProcessedImage, clampLow: number, clampHigh: number): void {
  const { rawLuminanceMap, opaqueIndices, luminanceMap } = result

  let minLum = Infinity
  let maxLum = -Infinity
  for (let i = 0; i < opaqueIndices.length; i++) {
    const v = rawLuminanceMap[opaqueIndices[i]]
    if (v < minLum) minLum = v
    if (v > maxLum) maxLum = v
  }

  if (maxLum - minLum <= 1e-10) {
    for (let i = 0; i < opaqueIndices.length; i++) {
      luminanceMap[opaqueIndices[i]] = 0.5
    }
    return
  }

  const [lumLo, lumHi] = percentileBounds(rawLuminanceMap, opaqueIndices, clampLow, 1 - clampHigh)
  const range = lumHi - lumLo

  if (range <= 1e-10) {
    for (let i = 0; i < opaqueIndices.length; i++) {
      luminanceMap[opaqueIndices[i]] = 0.5
    }
    return
  }

  for (let i = 0; i < opaqueIndices.length; i++) {
    const idx = opaqueIndices[i]
    luminanceMap[idx] = Math.max(0, Math.min(1, (rawLuminanceMap[idx] - lumLo) / range))
  }
}

export function buildGrayscaleImage(result: ProcessedImage): ImageData {
  const { width, height, originalData, luminanceMap } = result
  const imageData = new ImageData(width, height)
  const out = imageData.data

  for (let i = 0; i < width * height; i++) {
    const g = luminanceMap[i]
    if (isNaN(g)) {
      out[i * 4] = 0
      out[i * 4 + 1] = 0
      out[i * 4 + 2] = 0
      out[i * 4 + 3] = 0
    } else {
      const v = Math.round(g * 255)
      out[i * 4] = v
      out[i * 4 + 1] = v
      out[i * 4 + 2] = v
      out[i * 4 + 3] = originalData[i * 4 + 3]
    }
  }

  return imageData
}

export function buildGradientMappedImage(result: ProcessedImage, colorAHex: string, colorBHex: string): ImageData {
  const { width, height, originalData, luminanceMap } = result
  const imageData = new ImageData(width, height)
  const out = imageData.data

  const [aR, aG, aB] = hexToRgb(colorAHex)
  const [bR, bG, bB] = hexToRgb(colorBHex)

  for (let i = 0; i < width * height; i++) {
    const g = luminanceMap[i]
    if (isNaN(g)) {
      out[i * 4] = 0
      out[i * 4 + 1] = 0
      out[i * 4 + 2] = 0
      out[i * 4 + 3] = 0
    } else {
      out[i * 4] = Math.round(aR + (bR - aR) * g)
      out[i * 4 + 1] = Math.round(aG + (bG - aG) * g)
      out[i * 4 + 2] = Math.round(aB + (bB - aB) * g)
      out[i * 4 + 3] = originalData[i * 4 + 3]
    }
  }

  return imageData
}

/**
 * Build a channel-packed ImageData: normal map RGB + luminance map alpha.
 * Both images must have the same dimensions.
 */
export function buildChannelPackedImage(
  normalData: Uint8ClampedArray,
  luminanceMap: Float64Array,
  width: number,
  height: number,
): ImageData {
  const imageData = new ImageData(width, height)
  const out = imageData.data

  for (let i = 0; i < width * height; i++) {
    out[i * 4] = normalData[i * 4]
    out[i * 4 + 1] = normalData[i * 4 + 1]
    out[i * 4 + 2] = normalData[i * 4 + 2]
    const g = luminanceMap[i]
    out[i * 4 + 3] = isNaN(g) ? 0 : Math.round(g * 255)
  }

  return imageData
}

export function imageDataToCanvas(imageData: ImageData): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = imageData.width
  canvas.height = imageData.height
  const ctx = canvas.getContext('2d')!
  ctx.putImageData(imageData, 0, 0)
  return canvas
}
