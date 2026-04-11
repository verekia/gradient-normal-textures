# PCA Texture Gradient Map

A client-side web tool for baking gradient maps from texture images using Principal Component Analysis.

Drop in a texture, and the app extracts the dominant color variation axis as a grayscale map via PCA in CIELAB color space. Then pick two colors to recolor the texture with a gradient map — all processing happens in the browser.

## Getting Started

```bash
npm install
npm run dev
```

Open the local URL shown in the terminal (usually `http://localhost:5173`).

## How It Works

1. **Drop a texture** (PNG, JPG, or WebP) into the drop zone.
2. The app converts all pixels to CIELAB color space, runs PCA (power iteration) on the color distribution, and projects each pixel onto the first principal component to produce a **grayscale map**.
3. The two extracted endpoint colors (darkest and lightest along the PCA axis) are shown and pre-filled into color pickers.
4. Pick any two colors to **recolor the texture** via gradient mapping. Interpolation is done in linear RGB to avoid muddy mid-tones.
5. Download the grayscale or recolored image at full original resolution.

## Stack

- [Vite](https://vite.dev/) with vanilla TypeScript
- No UI frameworks, no image processing libraries
- All pixel math uses the Canvas 2D API and hand-written color space conversions

## Out of Scope

The following features are intentionally not included:

- Saving/loading projects
- Multi-stop gradients (only two colors)
- 2D LUTs / second principal component
- Batch processing multiple files
- Texture preview tiling
- Server-side processing
