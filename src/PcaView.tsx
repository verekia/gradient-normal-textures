import { useEffect } from 'react'
import Head from 'next/head'

export const PcaView = () => {
  useEffect(() => {
    let cancelled = false
    void import('./pca-init').then(m => {
      if (!cancelled) m.init()
    })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <>
      <Head>
        <title>PCA Texture Gradient Map</title>
      </Head>
      <div id="app">
        <h1>Texture Gradient Map (PCA)</h1>
        <p className="page-link">
          <a href="/">← Luminance version</a>
        </p>

        <div id="drop-row">
          <div>
            <h2>Texture</h2>
            <div id="drop-zone" className="drop-zone" tabIndex={0}>
              <p>Drop a texture here or click to select.</p>
              <p className="formats">PNG, JPG, WebP</p>
              <input type="file" id="file-input" className="file-input" accept="image/png,image/jpeg,image/webp" />
            </div>
          </div>
          <div id="original-wrap" className="hidden">
            <h2>Original</h2>
            <canvas id="canvas-original"></canvas>
          </div>
          <div>
            <h2>Normal Map</h2>
            <div id="drop-zone-normal" className="drop-zone" tabIndex={0}>
              <p>Drop a normal map here or click to select.</p>
              <p className="formats">PNG, JPG, WebP</p>
              <input
                type="file"
                id="file-input-normal"
                className="file-input"
                accept="image/png,image/jpeg,image/webp"
              />
            </div>
          </div>
          <div id="normal-wrap" className="hidden">
            <h2>Normal</h2>
            <canvas id="canvas-normal"></canvas>
          </div>
        </div>
        <div id="error-message" className="hidden"></div>

        <section id="section-grayscale" className="hidden">
          <div id="images-row">
            <div>
              <h2>Luminance</h2>
              <canvas id="canvas-grayscale-lum"></canvas>
            </div>
            <div>
              <h2>PCA</h2>
              <canvas id="canvas-grayscale"></canvas>
            </div>
            <div id="packed-lum-wrap" className="hidden">
              <h2>Packed Luminance</h2>
              <canvas id="canvas-packed-lum" className="checkerboard"></canvas>
              <button id="btn-download-packed-lum">Download packed (lum) PNG</button>
            </div>
            <div id="packed-pca-wrap" className="hidden">
              <h2>Packed PCA</h2>
              <canvas id="canvas-packed-pca" className="checkerboard"></canvas>
              <button id="btn-download-packed-pca">Download packed (PCA) PNG</button>
            </div>
          </div>
          <div id="endpoints">
            <div className="endpoint">
              <span className="swatch" id="swatch-dark"></span>
              <span>
                Extracted dark: <code id="dark-hex"></code>
              </span>
            </div>
            <div className="endpoint">
              <span className="swatch" id="swatch-light"></span>
              <span>
                Extracted light: <code id="light-hex"></code>
              </span>
            </div>
          </div>
          <button id="btn-download-grayscale">Download grayscale PNG</button>
        </section>

        <section id="section-gradient" className="hidden">
          <div id="color-pickers">
            <label>
              Color A (dark)
              <input type="color" id="picker-dark" />
            </label>
            <label>
              Color B (light)
              <input type="color" id="picker-light" />
            </label>
          </div>
          <div id="comparison-row">
            <div>
              <h2>Luminance</h2>
              <canvas id="canvas-luminance"></canvas>
            </div>
            <div>
              <h2>PCA</h2>
              <canvas id="canvas-pca-single"></canvas>
            </div>
          </div>
          <div id="tiled-header">
            <h2>Tiled</h2>
            <div id="tiled-toggle">
              <button id="btn-tiled-lum" className="toggle-btn">
                Luminance
              </button>
              <button id="btn-tiled-pca" className="toggle-btn active">
                PCA
              </button>
            </div>
          </div>
          <canvas id="canvas-gradient"></canvas>
          <button id="btn-download-gradient">Download recolored PNG</button>
        </section>
      </div>
    </>
  )
}
