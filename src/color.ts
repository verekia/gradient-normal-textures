// Color space conversion utilities
// sRGB <-> linear RGB <-> XYZ (D65) <-> CIELAB

/** Convert a single sRGB channel [0,255] to linear RGB [0,1] */
export function srgbToLinear(c: number): number {
  const s = c / 255
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
}

/** Convert a single linear RGB channel [0,1] to sRGB [0,255] */
export function linearToSrgb(c: number): number {
  const s = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055
  return Math.round(Math.max(0, Math.min(255, s * 255)))
}

/** Convert linear RGB [0,1] to CIE XYZ (D65 illuminant) */
export function linearRgbToXyz(r: number, g: number, b: number): [number, number, number] {
  const x = 0.4124564 * r + 0.3575761 * g + 0.1804375 * b
  const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b
  const z = 0.0193339 * r + 0.119192 * g + 0.9503041 * b
  return [x, y, z]
}

/** Convert CIE XYZ to linear RGB [0,1] */
export function xyzToLinearRgb(x: number, y: number, z: number): [number, number, number] {
  const r = 3.2404542 * x - 1.5371385 * y - 0.4985314 * z
  const g = -0.969266 * x + 1.8760108 * y + 0.041556 * z
  const b = 0.0556434 * x - 0.2040259 * y + 1.0572252 * z
  return [r, g, b]
}

// D65 white point
const Xn = 0.95047
const Yn = 1.0
const Zn = 1.08883

function labF(t: number): number {
  const delta = 6 / 29
  return t > delta * delta * delta ? Math.cbrt(t) : t / (3 * delta * delta) + 4 / 29
}

function labFInv(t: number): number {
  const delta = 6 / 29
  return t > delta ? t * t * t : 3 * delta * delta * (t - 4 / 29)
}

/** Convert CIE XYZ to CIELAB */
export function xyzToLab(x: number, y: number, z: number): [number, number, number] {
  const fx = labF(x / Xn)
  const fy = labF(y / Yn)
  const fz = labF(z / Zn)
  const L = 116 * fy - 16
  const a = 500 * (fx - fy)
  const b = 200 * (fy - fz)
  return [L, a, b]
}

/** Convert CIELAB to CIE XYZ */
export function labToXyz(L: number, a: number, b: number): [number, number, number] {
  const fy = (L + 16) / 116
  const fx = a / 500 + fy
  const fz = fy - b / 200
  return [Xn * labFInv(fx), Yn * labFInv(fy), Zn * labFInv(fz)]
}

/** Convert sRGB [0,255] to CIELAB */
export function srgbToLab(r: number, g: number, b: number): [number, number, number] {
  const lr = srgbToLinear(r)
  const lg = srgbToLinear(g)
  const lb = srgbToLinear(b)
  const [x, y, z] = linearRgbToXyz(lr, lg, lb)
  return xyzToLab(x, y, z)
}

/** Parse a hex color string (#RRGGBB) to [r, g, b] in [0,255] */
export function hexToRgb(hex: string): [number, number, number] {
  const m = hex.match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i)
  if (!m) return [0, 0, 0]
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)]
}

/** Convert [r, g, b] in [0,255] to #RRGGBB hex string */
export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (c: number) =>
    Math.max(0, Math.min(255, Math.round(c)))
      .toString(16)
      .padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}
