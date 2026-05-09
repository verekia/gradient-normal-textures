// KTX2 encoding via libktx.js (Khronos KTX-Software).
//
// libktx.js is loaded from /ktx/libktx.js (see public/ktx/). It is an Emscripten
// UMD bundle that exposes the global `createKtxModule` factory; we load it via a
// <script> tag and the WASM file is located at /ktx/libktx.wasm.

type KtxModule = any

declare global {
  interface Window {
    createKtxModule?: (opts?: { locateFile?: (path: string) => string }) => Promise<KtxModule>
  }
}

const LIBKTX_JS_URL = '/ktx/libktx.js'
const LIBKTX_BASE = '/ktx/'

let ktxPromise: Promise<KtxModule> | null = null

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`) as HTMLScriptElement | null
    if (existing) {
      if ((existing as any).dataset.loaded === '1') {
        resolve()
        return
      }
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)))
      return
    }
    const s = document.createElement('script')
    s.src = src
    s.async = true
    s.addEventListener('load', () => {
      s.dataset.loaded = '1'
      resolve()
    })
    s.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)))
    document.head.appendChild(s)
  })
}

export function loadKtx(): Promise<KtxModule> {
  if (ktxPromise) return ktxPromise
  ktxPromise = (async () => {
    await loadScript(LIBKTX_JS_URL)
    const factory = window.createKtxModule
    if (!factory) throw new Error('createKtxModule factory not found after loading libktx.js')
    return factory({
      locateFile: (path: string) => LIBKTX_BASE + path,
    })
  })()
  return ktxPromise
}

export type UastcLevel = 0 | 1 | 2 | 3 | 4

export interface Etc1sOptions {
  codec: 'etc1s'
  /** ETC1S encoder effort (clevel): 0..6. Default 2. */
  compressionLevel: number
  /** ETC1S quality (qlevel): 1..255. Default 128. */
  qualityLevel: number
  /** Explicit endpoint codebook size (1..16128). 0 = ignore (use qualityLevel). */
  maxEndpoints: number
  /** Explicit selector codebook size (1..16128). 0 = ignore (use qualityLevel). */
  maxSelectors: number
  /** Endpoint RDO threshold (>= 0). Default 1.25. 0 = ignore. */
  endpointRDOThreshold: number
  /** Selector RDO threshold (>= 0). Default 1.25. 0 = ignore. */
  selectorRDOThreshold: number
  /** Treat as normal map (disables perceptual weighting). */
  normalMap: boolean
  /** Disable endpoint RDO. */
  noEndpointRDO: boolean
  /** Disable selector RDO. */
  noSelectorRDO: boolean
}

export interface UastcOptions {
  codec: 'uastc'
  /** UASTC encoder level 0..4 (FASTEST..VERYSLOW). Default 2 (DEFAULT). */
  level: UastcLevel
  /** Enable UASTC rate-distortion optimization. */
  rdo: boolean
  /** RDO quality scalar (uastc_rdo_l). Higher = smaller/worse. Default 1.0. */
  rdoQualityScalar: number
  /** RDO dictionary size (uastc_rdo_d). Default 4096. */
  rdoDictSize: number
  /** RDO max smooth-block error scale. Default 10.0. */
  rdoMaxSmoothBlockErrorScale: number
  /** RDO max smooth-block std dev. Default 18.0. */
  rdoMaxSmoothBlockStdDev: number
  /** Don't favor simpler UASTC modes during RDO. */
  rdoDontFavorSimplerModes: boolean
}

export type BasisOptions = Etc1sOptions | UastcOptions

export interface Ktx2EncodeOptions {
  basis: BasisOptions
  /** Generate full mipmap chain. */
  generateMipmaps: boolean
  /** ZSTD supercompression level (0 = off, 1..22). */
  zstdLevel: number
  /** Use sRGB (R8G8B8A8_SRGB) vs linear (R8G8B8A8_UNORM). Default true. */
  srgb: boolean
  /**
   * Flip the source rows vertically before encoding. WebGL ignores
   * UNPACK_FLIP_Y_WEBGL for compressed textures, so KTX2Loader leaves the
   * sampled origin at bottom-left; pre-flipping the pixels at encode time
   * makes the exported file display upright when loaded into three.js.
   */
  flipY: boolean
}

export const DEFAULT_ETC1S: Etc1sOptions = {
  codec: 'etc1s',
  compressionLevel: 2,
  qualityLevel: 128,
  maxEndpoints: 0,
  maxSelectors: 0,
  endpointRDOThreshold: 1.25,
  selectorRDOThreshold: 1.25,
  normalMap: false,
  noEndpointRDO: false,
  noSelectorRDO: false,
}

export const DEFAULT_UASTC: UastcOptions = {
  codec: 'uastc',
  level: 2,
  rdo: false,
  rdoQualityScalar: 1.0,
  rdoDictSize: 4096,
  rdoMaxSmoothBlockErrorScale: 10.0,
  rdoMaxSmoothBlockStdDev: 18.0,
  rdoDontFavorSimplerModes: false,
}

/** 2x2 box-filter downsample of RGBA8 pixel data. */
function downsampleRgba(src: Uint8Array, w: number, h: number): { data: Uint8Array; w: number; h: number } {
  const nw = Math.max(1, w >> 1)
  const nh = Math.max(1, h >> 1)
  const out = new Uint8Array(nw * nh * 4)
  const rowBytes = w * 4
  for (let y = 0; y < nh; y++) {
    const sy0 = Math.min(y * 2, h - 1)
    const sy1 = Math.min(sy0 + 1, h - 1)
    for (let x = 0; x < nw; x++) {
      const sx0 = Math.min(x * 2, w - 1)
      const sx1 = Math.min(sx0 + 1, w - 1)
      const i00 = sy0 * rowBytes + sx0 * 4
      const i01 = sy0 * rowBytes + sx1 * 4
      const i10 = sy1 * rowBytes + sx0 * 4
      const i11 = sy1 * rowBytes + sx1 * 4
      const o = (y * nw + x) * 4
      for (let c = 0; c < 4; c++) {
        out[o + c] = (src[i00 + c] + src[i01 + c] + src[i10 + c] + src[i11 + c] + 2) >> 2
      }
    }
  }
  return { data: out, w: nw, h: nh }
}

function flipRgbaVertically(src: Uint8Array, w: number, h: number): Uint8Array {
  const rowBytes = w * 4
  const out = new Uint8Array(src.length)
  for (let y = 0; y < h; y++) {
    const srcOffset = y * rowBytes
    const dstOffset = (h - 1 - y) * rowBytes
    out.set(src.subarray(srcOffset, srcOffset + rowBytes), dstOffset)
  }
  return out
}

function buildMipChain(base: Uint8Array, w: number, h: number): { data: Uint8Array; w: number; h: number }[] {
  const levels: { data: Uint8Array; w: number; h: number }[] = [{ data: base, w, h }]
  let cur = levels[0]
  while (cur.w > 1 || cur.h > 1) {
    cur = downsampleRgba(cur.data, cur.w, cur.h)
    levels.push(cur)
  }
  return levels
}

export async function encodeRgbaToKtx2(
  rgba: Uint8Array,
  width: number,
  height: number,
  options: Ktx2EncodeOptions,
): Promise<Uint8Array> {
  const ktx = await loadKtx()

  const base = options.flipY ? flipRgbaVertically(rgba, width, height) : rgba
  const levels = options.generateMipmaps ? buildMipChain(base, width, height) : [{ data: base, w: width, h: height }]

  const createInfo = new ktx.textureCreateInfo()
  createInfo.vkFormat = options.srgb ? ktx.VkFormat.R8G8B8A8_SRGB : ktx.VkFormat.R8G8B8A8_UNORM
  createInfo.baseWidth = width
  createInfo.baseHeight = height
  createInfo.baseDepth = 1
  createInfo.numDimensions = 2
  createInfo.numLevels = levels.length
  createInfo.numLayers = 1
  createInfo.numFaces = 1
  createInfo.isArray = false
  createInfo.generateMipmaps = false

  const tex = new ktx.texture(createInfo, ktx.TextureCreateStorageEnum.ALLOC_STORAGE)

  try {
    for (let lvl = 0; lvl < levels.length; lvl++) {
      const res = tex.setImageFromMemory(lvl, 0, 0, levels[lvl].data)
      if (res !== ktx.ErrorCode.SUCCESS) {
        throw new Error(`setImageFromMemory level ${lvl} failed (code ${res.value ?? res})`)
      }
    }

    const bp = new ktx.basisParams()
    bp.preSwizzle = false
    bp.inputSwizzle = '\0\0\0\0'

    if (options.basis.codec === 'etc1s') {
      const e = options.basis
      bp.uastc = false
      bp.compressionLevel = e.compressionLevel
      bp.qualityLevel = e.qualityLevel
      if (e.maxEndpoints > 0) bp.maxEndpoints = e.maxEndpoints
      if (e.maxSelectors > 0) bp.maxSelectors = e.maxSelectors
      if (e.endpointRDOThreshold > 0) bp.endpointRDOThreshold = e.endpointRDOThreshold
      if (e.selectorRDOThreshold > 0) bp.selectorRDOThreshold = e.selectorRDOThreshold
      bp.normalMap = e.normalMap
      bp.noEndpointRDO = e.noEndpointRDO
      bp.noSelectorRDO = e.noSelectorRDO
    } else {
      const u = options.basis
      bp.uastc = true
      const flags = [
        ktx.pack_uastc_flag_bits.LEVEL_FASTEST,
        ktx.pack_uastc_flag_bits.LEVEL_FASTER,
        ktx.pack_uastc_flag_bits.LEVEL_DEFAULT,
        ktx.pack_uastc_flag_bits.LEVEL_SLOWER,
        ktx.pack_uastc_flag_bits.LEVEL_VERYSLOW,
      ]
      bp.uastcFlags = flags[u.level] ?? flags[2]
      bp.uastcRDO = u.rdo
      if (u.rdo) {
        bp.uastcRDOQualityScalar = u.rdoQualityScalar
        bp.uastcRDODictSize = u.rdoDictSize
        bp.uastcRDOMaxSmoothBlockErrorScale = u.rdoMaxSmoothBlockErrorScale
        bp.uastcRDOMaxSmoothBlockStdDev = u.rdoMaxSmoothBlockStdDev
        bp.uastcRDODontFavorSimplerModes = u.rdoDontFavorSimplerModes
      }
    }

    const compRes = tex.compressBasis(bp)
    if (compRes !== ktx.ErrorCode.SUCCESS) {
      throw new Error(`compressBasis failed (code ${compRes.value ?? compRes})`)
    }

    if (options.zstdLevel > 0) {
      const zRes = tex.deflateZstd(options.zstdLevel)
      if (zRes !== ktx.ErrorCode.SUCCESS) {
        throw new Error(`deflateZstd failed (code ${zRes.value ?? zRes})`)
      }
    }

    const view = tex.writeToMemory()
    if (!view) throw new Error('writeToMemory returned null')
    // Copy out of the WASM heap before anything else can invalidate the view.
    return new Uint8Array(view)
  } finally {
    if (typeof tex.delete === 'function') tex.delete()
  }
}

/** Download a KTX2 byte buffer as a file. */
export function downloadKtx2(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes as unknown as BlobPart], { type: 'image/ktx2' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
