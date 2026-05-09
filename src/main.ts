import './style.css'
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
} from './process'
import {
  initThreeScene,
  setColorTexture,
  setNormalTexture,
  setTextureRepeat,
  setMaterialType,
  setDirectionalIntensity,
  setNormalScale,
} from './three-scene'
import {
  encodeRgbaToKtx2,
  downloadKtx2,
  DEFAULT_ETC1S,
  DEFAULT_UASTC,
  type BasisOptions,
  type Ktx2EncodeOptions,
  type UastcLevel,
} from './ktx2'

// DOM elements — texture drop
const dropZoneWrap = document.getElementById('drop-zone-wrap')!
const dropZone = document.getElementById('drop-zone')!
const fileInput = document.getElementById('file-input') as HTMLInputElement
const errorMessage = document.getElementById('error-message')!
const originalWrap = document.getElementById('original-wrap')!
const canvasOriginal = document.getElementById('canvas-original') as HTMLCanvasElement

// DOM elements — normal map drop
const dropZoneNormalWrap = document.getElementById('drop-zone-normal-wrap')!
const dropZoneNormal = document.getElementById('drop-zone-normal')!
const fileInputNormal = document.getElementById('file-input-normal') as HTMLInputElement
const normalWrap = document.getElementById('normal-wrap')!
const canvasNormal = document.getElementById('canvas-normal') as HTMLCanvasElement

const sectionGrayscale = document.getElementById('section-grayscale')!
const canvasGrayscaleLum = document.getElementById('canvas-grayscale-lum') as HTMLCanvasElement
const packedLumWrap = document.getElementById('packed-lum-wrap')!
const canvasPackedLum = document.getElementById('canvas-packed-lum') as HTMLCanvasElement
const clampLow = document.getElementById('clamp-low') as HTMLInputElement
const clampHigh = document.getElementById('clamp-high') as HTMLInputElement
const clampLowValue = document.getElementById('clamp-low-value')!
const clampHighValue = document.getElementById('clamp-high-value')!

const sectionGradient = document.getElementById('section-gradient')!
const pickerDark = document.getElementById('picker-dark') as HTMLInputElement
const pickerLight = document.getElementById('picker-light') as HTMLInputElement
const canvasLuminance = document.getElementById('canvas-luminance') as HTMLCanvasElement
const canvasGradient = document.getElementById('canvas-gradient') as HTMLCanvasElement

const section3d = document.getElementById('section-3d')!
const threeContainer = document.getElementById('three-container')!
const texSize = document.getElementById('tex-size') as HTMLInputElement
const texSizeValue = document.getElementById('tex-size-value')!
const lightIntensity = document.getElementById('light-intensity') as HTMLInputElement
const lightIntensityValue = document.getElementById('light-intensity-value')!
const normalScale = document.getElementById('normal-scale') as HTMLInputElement
const normalScaleValue = document.getElementById('normal-scale-value')!
const btnMatStandard = document.getElementById('btn-mat-standard')!
const btnMatLambert = document.getElementById('btn-mat-lambert')!

// KTX2 config DOM
const sectionKtx2 = document.getElementById('section-ktx2')!
const ktx2CodecEtc1s = document.getElementById('ktx2-codec-etc1s') as HTMLButtonElement
const ktx2CodecUastc = document.getElementById('ktx2-codec-uastc') as HTMLButtonElement
const ktx2Mipmaps = document.getElementById('ktx2-mipmaps') as HTMLInputElement
const ktx2FlipY = document.getElementById('ktx2-flipy') as HTMLInputElement
const ktx2Zstd = document.getElementById('ktx2-zstd') as HTMLInputElement
const ktx2ZstdValue = document.getElementById('ktx2-zstd-value')!
const ktx2Etc1sOpts = document.getElementById('ktx2-etc1s-opts')!
const ktx2UastcOpts = document.getElementById('ktx2-uastc-opts')!

const ktx2Etc1sClevel = document.getElementById('ktx2-etc1s-clevel') as HTMLInputElement
const ktx2Etc1sClevelValue = document.getElementById('ktx2-etc1s-clevel-value')!
const ktx2Etc1sQlevel = document.getElementById('ktx2-etc1s-qlevel') as HTMLInputElement
const ktx2Etc1sQlevelValue = document.getElementById('ktx2-etc1s-qlevel-value')!
const ktx2Etc1sMaxEndpoints = document.getElementById('ktx2-etc1s-max-endpoints') as HTMLInputElement
const ktx2Etc1sMaxSelectors = document.getElementById('ktx2-etc1s-max-selectors') as HTMLInputElement
const ktx2Etc1sEndpointRdo = document.getElementById('ktx2-etc1s-endpoint-rdo') as HTMLInputElement
const ktx2Etc1sSelectorRdo = document.getElementById('ktx2-etc1s-selector-rdo') as HTMLInputElement
const ktx2Etc1sNormalmap = document.getElementById('ktx2-etc1s-normalmap') as HTMLInputElement
const ktx2Etc1sNoEndpointRdo = document.getElementById('ktx2-etc1s-no-endpoint-rdo') as HTMLInputElement
const ktx2Etc1sNoSelectorRdo = document.getElementById('ktx2-etc1s-no-selector-rdo') as HTMLInputElement

const ktx2UastcLevel = document.getElementById('ktx2-uastc-level') as HTMLSelectElement
const ktx2UastcRdo = document.getElementById('ktx2-uastc-rdo') as HTMLInputElement
const ktx2UastcRdoL = document.getElementById('ktx2-uastc-rdo-l') as HTMLInputElement
const ktx2UastcRdoD = document.getElementById('ktx2-uastc-rdo-d') as HTMLInputElement
const ktx2UastcRdoErr = document.getElementById('ktx2-uastc-rdo-err') as HTMLInputElement
const ktx2UastcRdoStd = document.getElementById('ktx2-uastc-rdo-std') as HTMLInputElement
const ktx2UastcRdoDfsm = document.getElementById('ktx2-uastc-rdo-dfsm') as HTMLInputElement

type Ktx2Target = 'luminance' | 'packed'
const ktx2Badges = Array.from(document.querySelectorAll<HTMLButtonElement>('.ktx2-download-badge'))
let ktx2Codec: 'etc1s' | 'uastc' = 'uastc'

// State
let currentResult: ProcessedImage | null = null
let normalMapData: Uint8ClampedArray | null = null
let normalMapWidth = 0
let normalMapHeight = 0
let dragCounter = 0

function rafThrottle(fn: () => void): () => void {
  let scheduled = false
  return () => {
    if (scheduled) return
    scheduled = true
    requestAnimationFrame(() => {
      scheduled = false
      fn()
    })
  }
}

function updateDropZoneVisibility() {
  const dragging = dragCounter > 0
  const hasTexture = currentResult != null
  const hasNormal = normalMapData != null
  dropZoneWrap.classList.toggle('hidden', hasTexture && !dragging)
  dropZoneNormalWrap.classList.toggle('hidden', hasNormal && !dragging)
  originalWrap.classList.toggle('hidden', !hasTexture || dragging)
  normalWrap.classList.toggle('hidden', !hasNormal || dragging)
}

window.addEventListener('dragenter', e => {
  if (!e.dataTransfer?.types.includes('Files')) return
  dragCounter++
  updateDropZoneVisibility()
})

window.addEventListener('dragleave', e => {
  if (!e.dataTransfer?.types.includes('Files')) return
  dragCounter = Math.max(0, dragCounter - 1)
  updateDropZoneVisibility()
})

window.addEventListener('dragover', e => {
  e.preventDefault()
})

window.addEventListener('drop', e => {
  e.preventDefault()
  dragCounter = 0
  updateDropZoneVisibility()
})

// --- Drop zone handling (texture) ---

dropZone.addEventListener('dragover', e => {
  e.preventDefault()
  dropZone.classList.add('drag-over')
})

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('drag-over')
})

dropZone.addEventListener('drop', e => {
  e.preventDefault()
  dropZone.classList.remove('drag-over')
  const file = e.dataTransfer?.files[0]
  if (file) handleFile(file)
})

fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0]
  if (file) handleFile(file)
})

// --- Drop zone handling (normal map) ---

dropZoneNormal.addEventListener('dragover', e => {
  e.preventDefault()
  dropZoneNormal.classList.add('drag-over')
})

dropZoneNormal.addEventListener('dragleave', () => {
  dropZoneNormal.classList.remove('drag-over')
})

dropZoneNormal.addEventListener('drop', e => {
  e.preventDefault()
  dropZoneNormal.classList.remove('drag-over')
  const file = e.dataTransfer?.files[0]
  if (file) handleNormalMap(file)
})

fileInputNormal.addEventListener('change', () => {
  const file = fileInputNormal.files?.[0]
  if (file) handleNormalMap(file)
})

// --- File handling ---

function showError(msg: string) {
  errorMessage.textContent = msg
  errorMessage.classList.remove('hidden')
  sectionKtx2.classList.add('hidden')
  sectionGrayscale.classList.add('hidden')
  sectionGradient.classList.add('hidden')
}

function clearError() {
  errorMessage.classList.add('hidden')
}

async function handleNormalMap(file: File) {
  const validTypes = ['image/png', 'image/jpeg', 'image/webp']
  if (!validTypes.includes(file.type)) return

  try {
    const img = await loadImage(file)
    const { data, width, height } = getPixelData(img)

    normalMapData = data
    normalMapWidth = width
    normalMapHeight = height

    drawToDisplayCanvas(canvasNormal, img, width, height)
    updateDropZoneVisibility()

    updateChannelPacked()
    updateThreeScene()
  } catch {
    // silently ignore
  }
}

function updateChannelPacked() {
  if (!currentResult || !normalMapData) {
    packedLumWrap.classList.add('hidden')
    return
  }

  if (normalMapWidth !== currentResult.width || normalMapHeight !== currentResult.height) {
    packedLumWrap.classList.add('hidden')
    return
  }

  const { width, height } = currentResult

  const packedLumImageData = buildChannelPackedImage(normalMapData, currentResult.luminanceMap, width, height)
  const packedLumCanvas = imageDataToCanvas(packedLumImageData)
  drawCanvasToDisplayCanvas(canvasPackedLum, packedLumCanvas, width, height)
  packedLumWrap.classList.remove('hidden')
}

async function handleFile(file: File) {
  clearError()

  const validTypes = ['image/png', 'image/jpeg', 'image/webp']
  if (!validTypes.includes(file.type)) {
    showError('Unsupported file type. Please use PNG, JPG, or WebP.')
    return
  }

  try {
    const img = await loadImage(file)
    const { data, width, height } = getPixelData(img)

    drawToDisplayCanvas(canvasOriginal, img, width, height)
    sectionGrayscale.classList.add('hidden')
    sectionGradient.classList.add('hidden')

    const result = processPixels(data, width, height)

    if (typeof result === 'string') {
      showError(result)
      return
    }

    currentResult = result

    // Apply current clamp values (file may be loaded after user moved sliders)
    applyLuminanceClamp(result, +clampLow.value / 100, +clampHigh.value / 100)

    renderLuminanceOutputs()

    sectionKtx2.classList.remove('hidden')
    sectionGrayscale.classList.remove('hidden')
    sectionGradient.classList.remove('hidden')
    updateDropZoneVisibility()
  } catch (err) {
    showError(`Error processing image: ${(err as Error).message}`)
  }
}

// --- Display helpers ---

const MAX_PREVIEW_SIZE = 256

function getDisplayDimensions(w: number, h: number): [number, number] {
  if (w <= MAX_PREVIEW_SIZE) return [w, h]
  const scale = MAX_PREVIEW_SIZE / w
  return [MAX_PREVIEW_SIZE, Math.round(h * scale)]
}

function drawToDisplayCanvas(canvas: HTMLCanvasElement, img: HTMLImageElement, w: number, h: number) {
  const [dw, dh] = getDisplayDimensions(w, h)
  canvas.width = w
  canvas.height = h
  canvas.style.width = `${dw}px`
  canvas.style.height = `${dh}px`
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0)
}

function drawCanvasToDisplayCanvas(
  displayCanvas: HTMLCanvasElement,
  sourceCanvas: HTMLCanvasElement,
  w: number,
  h: number,
) {
  const [dw, dh] = getDisplayDimensions(w, h)
  displayCanvas.width = w
  displayCanvas.height = h
  displayCanvas.style.width = `${dw}px`
  displayCanvas.style.height = `${dh}px`
  const ctx = displayCanvas.getContext('2d')!
  ctx.drawImage(sourceCanvas, 0, 0)
}

// --- Gradient map ---

let gradientTileCanvas: HTMLCanvasElement | null = null

function updateGradientMap() {
  if (!currentResult) return

  const colorA = pickerDark.value
  const colorB = pickerLight.value

  const lumImageData = buildGradientMappedImage(currentResult, colorA, colorB)
  const lumSrcCanvas = imageDataToCanvas(lumImageData)
  gradientTileCanvas = lumSrcCanvas
  drawCanvasToDisplayCanvas(canvasLuminance, lumSrcCanvas, currentResult.width, currentResult.height)

  const { width: fullW, height: fullH } = currentResult
  const [displayW, displayH] = getDisplayDimensions(fullW, fullH)
  const tilesX = 3
  const tilesY = 3
  canvasGradient.width = fullW * tilesX
  canvasGradient.height = fullH * tilesY
  canvasGradient.style.width = `${displayW * tilesX}px`
  canvasGradient.style.height = `${displayH * tilesY}px`
  const ctx = canvasGradient.getContext('2d')!
  for (let y = 0; y < tilesY; y++) {
    for (let x = 0; x < tilesX; x++) {
      ctx.drawImage(lumSrcCanvas, x * fullW, y * fullH)
    }
  }

  updateThreeScene()
}

function updateThreeScene() {
  if (!currentResult || !normalMapData || !gradientTileCanvas) {
    section3d.classList.add('hidden')
    return
  }
  if (normalMapWidth !== currentResult.width || normalMapHeight !== currentResult.height) {
    section3d.classList.add('hidden')
    return
  }
  section3d.classList.remove('hidden')
  initThreeScene(threeContainer)
  setColorTexture(gradientTileCanvas)
  setNormalTexture(canvasNormal)
}

const scheduleGradientUpdate = rafThrottle(updateGradientMap)
pickerDark.addEventListener('input', scheduleGradientUpdate)
pickerLight.addEventListener('input', scheduleGradientUpdate)

function renderLuminanceOutputs() {
  if (!currentResult) return
  const { width, height } = currentResult

  const lumGsImageData = buildGrayscaleImage(currentResult)
  const lumGsCanvas = imageDataToCanvas(lumGsImageData)
  drawCanvasToDisplayCanvas(canvasGrayscaleLum, lumGsCanvas, width, height)

  updateChannelPacked()
  updateGradientMap()
}

const scheduleClampRecompute = rafThrottle(() => {
  if (!currentResult) return
  applyLuminanceClamp(currentResult, +clampLow.value / 100, +clampHigh.value / 100)
  renderLuminanceOutputs()
})

function onClampChange() {
  clampLowValue.textContent = `${(+clampLow.value).toFixed(1)}%`
  clampHighValue.textContent = `${(+clampHigh.value).toFixed(1)}%`
  scheduleClampRecompute()
}

clampLow.addEventListener('input', onClampChange)
clampHigh.addEventListener('input', onClampChange)

texSize.addEventListener('input', () => {
  const v = +texSize.value
  texSizeValue.textContent = `${v.toFixed(1)}×`
  setTextureRepeat(v)
})

lightIntensity.addEventListener('input', () => {
  const v = +lightIntensity.value
  lightIntensityValue.textContent = v.toFixed(2)
  setDirectionalIntensity(v)
})

normalScale.addEventListener('input', () => {
  const v = +normalScale.value
  normalScaleValue.textContent = v.toFixed(2)
  setNormalScale(v)
})

btnMatStandard.addEventListener('click', () => {
  btnMatStandard.classList.add('active')
  btnMatLambert.classList.remove('active')
  setMaterialType('standard')
})

btnMatLambert.addEventListener('click', () => {
  btnMatLambert.classList.add('active')
  btnMatStandard.classList.remove('active')
  setMaterialType('lambert')
})

// --- KTX2 config ---

function setKtx2Codec(codec: 'etc1s' | 'uastc') {
  ktx2Codec = codec
  const isEtc1s = codec === 'etc1s'
  ktx2CodecEtc1s.classList.toggle('active', isEtc1s)
  ktx2CodecUastc.classList.toggle('active', !isEtc1s)
  ktx2Etc1sOpts.classList.toggle('hidden', !isEtc1s)
  ktx2UastcOpts.classList.toggle('hidden', isEtc1s)
}

ktx2CodecEtc1s.addEventListener('click', () => setKtx2Codec('etc1s'))
ktx2CodecUastc.addEventListener('click', () => setKtx2Codec('uastc'))

ktx2Etc1sClevel.addEventListener('input', () => {
  ktx2Etc1sClevelValue.textContent = ktx2Etc1sClevel.value
})
ktx2Etc1sQlevel.addEventListener('input', () => {
  ktx2Etc1sQlevelValue.textContent = ktx2Etc1sQlevel.value
})
ktx2Zstd.addEventListener('input', () => {
  const v = +ktx2Zstd.value
  ktx2ZstdValue.textContent = v === 0 ? 'off' : String(v)
})

function readBasisOptions(): BasisOptions {
  if (ktx2Codec === 'etc1s') {
    return {
      ...DEFAULT_ETC1S,
      compressionLevel: +ktx2Etc1sClevel.value,
      qualityLevel: +ktx2Etc1sQlevel.value,
      maxEndpoints: +ktx2Etc1sMaxEndpoints.value,
      maxSelectors: +ktx2Etc1sMaxSelectors.value,
      endpointRDOThreshold: +ktx2Etc1sEndpointRdo.value,
      selectorRDOThreshold: +ktx2Etc1sSelectorRdo.value,
      normalMap: ktx2Etc1sNormalmap.checked,
      noEndpointRDO: ktx2Etc1sNoEndpointRdo.checked,
      noSelectorRDO: ktx2Etc1sNoSelectorRdo.checked,
    }
  }
  return {
    ...DEFAULT_UASTC,
    level: +ktx2UastcLevel.value as UastcLevel,
    rdo: ktx2UastcRdo.checked,
    rdoQualityScalar: +ktx2UastcRdoL.value,
    rdoDictSize: +ktx2UastcRdoD.value,
    rdoMaxSmoothBlockErrorScale: +ktx2UastcRdoErr.value,
    rdoMaxSmoothBlockStdDev: +ktx2UastcRdoStd.value,
    rdoDontFavorSimplerModes: ktx2UastcRdoDfsm.checked,
  }
}

function readKtx2Options(target: Ktx2Target): Ktx2EncodeOptions {
  const isPacked = target === 'packed'
  return {
    basis: readBasisOptions(),
    generateMipmaps: ktx2Mipmaps.checked,
    zstdLevel: +ktx2Zstd.value,
    // Packed textures carry non-color data in RGB (normal) + alpha (luminance),
    // so they must be encoded as linear (UNORM, not SRGB). Do NOT set the basis
    // `normalMap` flag though — that triggers ETC1S's "RX/GY" two-channel mode
    // (normal.X in R, normal.Y in A) which discards the blue channel and the
    // luminance in A. Packed textures need all four channels preserved.
    srgb: !isPacked,
    flipY: ktx2FlipY.checked,
  }
}

function getLuminanceRgba(): { data: Uint8Array; width: number; height: number } | null {
  if (!currentResult) return null
  const { width, height } = currentResult
  const imageData = buildGrayscaleImage(currentResult)
  return { data: new Uint8Array(imageData.data.buffer.slice(0)), width, height }
}

function getPackedRgba(): { data: Uint8Array; width: number; height: number } | null {
  if (!currentResult || !normalMapData) return null
  if (normalMapWidth !== currentResult.width || normalMapHeight !== currentResult.height) return null
  const { width, height } = currentResult
  const imageData = buildChannelPackedImage(normalMapData, currentResult.luminanceMap, width, height)
  return { data: new Uint8Array(imageData.data.buffer.slice(0)), width, height }
}

async function handleKtx2Download(target: Ktx2Target, badge: HTMLButtonElement) {
  const src = target === 'luminance' ? getLuminanceRgba() : getPackedRgba()
  if (!src) return
  const prevLabel = badge.querySelector('.ktx2-badge-label')?.textContent ?? 'KTX2'
  const labelEl = badge.querySelector('.ktx2-badge-label') as HTMLElement | null
  badge.classList.add('busy')
  badge.disabled = true
  if (labelEl) labelEl.textContent = 'Encoding…'
  try {
    const opts = readKtx2Options(target)
    const bytes = await encodeRgbaToKtx2(src.data, src.width, src.height, opts)
    const suffix = opts.basis.codec === 'etc1s' ? 'etc1s' : 'uastc'
    downloadKtx2(bytes, `${target}-${suffix}.ktx2`)
  } catch (err) {
    console.error('KTX2 encode failed:', err)
    alert(`KTX2 encode failed: ${(err as Error).message}`)
  } finally {
    badge.classList.remove('busy')
    badge.disabled = false
    if (labelEl) labelEl.textContent = prevLabel
  }
}

for (const badge of ktx2Badges) {
  badge.addEventListener('click', e => {
    e.preventDefault()
    const target = badge.dataset.target as Ktx2Target | undefined
    if (target !== 'luminance' && target !== 'packed') return
    void handleKtx2Download(target, badge)
  })
}
