import { useEffect } from 'react'
import Head from 'next/head'

export const MainView = () => {
  useEffect(() => {
    let cancelled = false
    void import('./main-init').then(m => {
      if (!cancelled) m.init()
    })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <>
      <Head>
        <title>Luminance extraction + normal packer for dynamic recoloring</title>
      </Head>
      <div id="app">
        <h1>Luminance extraction + normal packer for dynamic recoloring</h1>
        <p className="page-link">
          <a href="/test">→ testing page</a>
        </p>

        <div id="drop-row">
          <div id="drop-zone-wrap">
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
          <div id="drop-zone-normal-wrap">
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

        <section id="section-ktx2" className="hidden">
          <details id="ktx2-details">
            <summary>
              <span className="ktx2-summary-title">KTX2 export config</span>
            </summary>
            <div className="ktx2-body">
              <p className="codec-explainer">
                <b>ETC1S</b> is a low-bitrate Basis Universal mode that produces very small files with lossy visual
                quality — best for color/albedo textures where bandwidth matters more than fidelity. <b>UASTC</b> is a
                higher-bitrate mode (8 bpp) that preserves detail far better — best for normal maps, roughness/metal,
                and data textures. Pair UASTC with ZSTD supercompression to shrink the file losslessly on disk.
              </p>
              <div className="ktx2-row">
                <div className="ktx2-field">
                  <span className="ktx2-label">Codec</span>
                  <div id="ktx2-codec-toggle" className="toggle-group">
                    <button id="ktx2-codec-etc1s" className="toggle-btn" type="button">
                      ETC1S
                    </button>
                    <button id="ktx2-codec-uastc" className="toggle-btn active" type="button">
                      UASTC
                    </button>
                  </div>
                </div>
                <label className="ktx2-field">
                  <span
                    className="ktx2-label"
                    title="Build a full mipmap chain from the base image by 2×2 box downsampling each level until 1×1. Improves filtering quality at smaller display sizes."
                  >
                    Generate mipmaps
                  </span>
                  <input type="checkbox" id="ktx2-mipmaps" defaultChecked />
                </label>
                <label className="ktx2-field">
                  <span
                    className="ktx2-label"
                    title="Mirror the source image rows vertically before encoding. WebGL ignores UNPACK_FLIP_Y_WEBGL for compressed textures, so pre-flipping here ensures the exported file samples upright in three.js."
                  >
                    Flip Y
                  </span>
                  <input type="checkbox" id="ktx2-flipy" defaultChecked />
                </label>
                <label className="ktx2-field">
                  <span
                    className="ktx2-label"
                    title="Zstandard supercompression level applied on top of Basis Universal (lossless). 0 = off, 1..22 = more aggressive. Highly effective on UASTC payloads; usually near no-op on ETC1S."
                  >
                    ZSTD level
                  </span>
                  <input type="range" id="ktx2-zstd" min="0" max="22" step="1" defaultValue="3" />
                  <span className="ktx2-value" id="ktx2-zstd-value">
                    3
                  </span>
                </label>
              </div>

              <div id="ktx2-etc1s-opts" className="ktx2-opts hidden">
                <label className="ktx2-field">
                  <span className="ktx2-label" title="ETC1S encoder effort, 0..6. Higher = slower, better quality. Default 2.">
                    Compression level (clevel)
                  </span>
                  <input type="range" id="ktx2-etc1s-clevel" min="0" max="6" step="1" defaultValue="2" />
                  <span className="ktx2-value" id="ktx2-etc1s-clevel-value">
                    2
                  </span>
                </label>
                <label className="ktx2-field">
                  <span
                    className="ktx2-label"
                    title="ETC1S compression quality, 1..255. Higher = larger endpoint/selector codebooks, better quality, larger file. Default 128. Ignored if max endpoints or max selectors are set explicitly."
                  >
                    Quality level (qlevel)
                  </span>
                  <input type="range" id="ktx2-etc1s-qlevel" min="1" max="255" step="1" defaultValue="128" />
                  <span className="ktx2-value" id="ktx2-etc1s-qlevel-value">
                    128
                  </span>
                </label>
                <label className="ktx2-field">
                  <span
                    className="ktx2-label"
                    title="Manually set the endpoint codebook size, 1..16128. 0 = derive from qlevel. Use together with Max selectors for fine control over quality vs size."
                  >
                    Max endpoints
                  </span>
                  <input type="number" id="ktx2-etc1s-max-endpoints" min="0" max="16128" step="1" defaultValue="0" />
                </label>
                <label className="ktx2-field">
                  <span
                    className="ktx2-label"
                    title="Manually set the selector codebook size, 1..16128. 0 = derive from qlevel."
                  >
                    Max selectors
                  </span>
                  <input type="number" id="ktx2-etc1s-max-selectors" min="0" max="16128" step="1" defaultValue="0" />
                </label>
                <label className="ktx2-field">
                  <span
                    className="ktx2-label"
                    title="Endpoint rate-distortion optimization step threshold. Higher values produce smaller files with lower quality. Typical range 1.0..3.0. Default 1.25."
                  >
                    Endpoint RDO threshold
                  </span>
                  <input type="number" id="ktx2-etc1s-endpoint-rdo" min="0" max="10" step="0.05" defaultValue="1.25" />
                </label>
                <label className="ktx2-field">
                  <span
                    className="ktx2-label"
                    title="Selector rate-distortion optimization step threshold. Higher values produce smaller files with lower quality. Typical range 1.0..3.0. Default 1.25."
                  >
                    Selector RDO threshold
                  </span>
                  <input type="number" id="ktx2-etc1s-selector-rdo" min="0" max="10" step="0.05" defaultValue="1.25" />
                </label>
                <label className="ktx2-field ktx2-checkbox">
                  <input type="checkbox" id="ktx2-etc1s-normalmap" />
                  <span
                    className="ktx2-label"
                    title="Tune ETC1S settings for tangent-space normal maps: disables perceptual (luma) weighting and switches to a two-channel R/G mode (normal.x in R, normal.y in A). Enable only for pure normal maps — discards B and A channels."
                  >
                    Normal map mode
                  </span>
                </label>
                <label className="ktx2-field ktx2-checkbox">
                  <input type="checkbox" id="ktx2-etc1s-no-endpoint-rdo" />
                  <span
                    className="ktx2-label"
                    title="Disable the endpoint RDO pass. Slightly improves quality at the cost of larger files; also makes encoding faster."
                  >
                    No endpoint RDO
                  </span>
                </label>
                <label className="ktx2-field ktx2-checkbox">
                  <input type="checkbox" id="ktx2-etc1s-no-selector-rdo" />
                  <span
                    className="ktx2-label"
                    title="Disable the selector RDO pass. Slightly improves quality at the cost of larger files; also makes encoding faster."
                  >
                    No selector RDO
                  </span>
                </label>
              </div>

              <div id="ktx2-uastc-opts" className="ktx2-opts">
                <label className="ktx2-field">
                  <span
                    className="ktx2-label"
                    title="UASTC encoding effort: 0 Fastest, 1 Faster, 2 Default, 3 Slower, 4 VerySlow. Higher levels explore more block modes per 4×4 block and produce better quality at the same bitrate."
                  >
                    Quality level
                  </span>
                  <select id="ktx2-uastc-level" defaultValue="2">
                    <option value="0">0 · Fastest</option>
                    <option value="1">1 · Faster</option>
                    <option value="2">2 · Default</option>
                    <option value="3">3 · Slower</option>
                    <option value="4">4 · VerySlow</option>
                  </select>
                </label>
                <label className="ktx2-field ktx2-checkbox">
                  <input type="checkbox" id="ktx2-uastc-rdo" />
                  <span
                    className="ktx2-label"
                    title="Enable rate-distortion optimization on UASTC output. Re-encodes blocks to be more Zstandard-friendly, shrinking the supercompressed file at a small quality cost. Pair with ZSTD level ≥ 1 to see the benefit."
                  >
                    UASTC RDO
                  </span>
                </label>
                <label className="ktx2-field">
                  <span
                    className="ktx2-label"
                    title="UASTC RDO quality scalar (λ). Lower values favor higher quality (larger file); higher favor smaller file (lower quality). Useful range ~0.25..3.0. Default 1.0."
                  >
                    RDO quality scalar (rdo_l)
                  </span>
                  <input type="number" id="ktx2-uastc-rdo-l" min="0.001" max="10" step="0.01" defaultValue="1.0" />
                </label>
                <label className="ktx2-field">
                  <span
                    className="ktx2-label"
                    title="UASTC RDO dictionary size in bytes, 64..65536. Larger dictionary = potentially smaller files but slower encoding and more memory. Default 4096."
                  >
                    RDO dict size (rdo_d)
                  </span>
                  <input type="number" id="ktx2-uastc-rdo-d" min="64" max="65536" step="64" defaultValue="4096" />
                </label>
                <label className="ktx2-field">
                  <span
                    className="ktx2-label"
                    title="Maximum RDO error scale allowed on smooth blocks, 1..10. Higher values let smooth areas tolerate more error (smaller files); lower protects gradients from banding. Default 10."
                  >
                    RDO max smooth-block error scale
                  </span>
                  <input type="number" id="ktx2-uastc-rdo-err" min="1" max="100" step="0.5" defaultValue="10" />
                </label>
                <label className="ktx2-field">
                  <span
                    className="ktx2-label"
                    title="Standard-deviation threshold below which a block is classified as smooth for RDO purposes, 18..30. Default 18."
                  >
                    RDO max smooth-block std dev
                  </span>
                  <input type="number" id="ktx2-uastc-rdo-std" min="1" max="100" step="0.5" defaultValue="18" />
                </label>
                <label className="ktx2-field ktx2-checkbox">
                  <input type="checkbox" id="ktx2-uastc-rdo-dfsm" />
                  <span
                    className="ktx2-label"
                    title="Disable the RDO bias toward simpler UASTC block modes. May slightly improve quality at the cost of worse Zstandard ratios."
                  >
                    Don’t favor simpler modes
                  </span>
                </label>
              </div>
            </div>
          </details>
        </section>

        <section id="section-grayscale" className="hidden">
          <div id="clamp-controls">
            <label>
              <span className="clamp-label">Dark clamp</span>
              <input type="range" id="clamp-low" min="0" max="25" step="0.1" defaultValue="0.1" />
              <span className="clamp-value" id="clamp-low-value">
                0.1%
              </span>
            </label>
            <label>
              <span className="clamp-label">Light clamp</span>
              <input type="range" id="clamp-high" min="0" max="25" step="0.1" defaultValue="0.1" />
              <span className="clamp-value" id="clamp-high-value">
                0.1%
              </span>
            </label>
          </div>
          <div id="images-row">
            <div>
              <h2>Luminance</h2>
              <div className="ktx2-canvas-wrap">
                <canvas id="canvas-grayscale-lum"></canvas>
                <button className="ktx2-download-badge" data-target="luminance" type="button" title="Download as KTX2">
                  <span className="ktx2-badge-label">KTX2</span>
                  <svg className="ktx2-badge-arrow" viewBox="0 0 16 16" aria-hidden="true">
                    <path
                      d="M8 2v9m0 0l-3.5-3.5M8 11l3.5-3.5M3 13h10"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
            </div>
            <div id="packed-lum-wrap" className="hidden">
              <h2>Packed</h2>
              <div className="ktx2-canvas-wrap">
                <canvas id="canvas-packed-lum" className="checkerboard"></canvas>
                <button className="ktx2-download-badge" data-target="packed" type="button" title="Download as KTX2">
                  <span className="ktx2-badge-label">KTX2</span>
                  <svg className="ktx2-badge-arrow" viewBox="0 0 16 16" aria-hidden="true">
                    <path
                      d="M8 2v9m0 0l-3.5-3.5M8 11l3.5-3.5M3 13h10"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </section>

        <section id="section-gradient" className="hidden">
          <div id="color-pickers">
            <label>
              Color A (dark)
              <input type="color" id="picker-dark" defaultValue="#000000" />
            </label>
            <label>
              Color B (light)
              <input type="color" id="picker-light" defaultValue="#ffffff" />
            </label>
          </div>
          <div id="recolored-and-3d-row">
            <div id="recolored-wrap">
              <h2>Recolored</h2>
              <canvas id="canvas-luminance"></canvas>
            </div>
            <section id="section-3d" className="hidden">
              <h2 id="three-heading">3D Preview</h2>
              <div id="three-controls">
                <label>
                  <span className="clamp-label">Texture size</span>
                  <input type="range" id="tex-size" min="0.5" max="10" step="0.1" defaultValue="2" />
                  <span className="clamp-value" id="tex-size-value">
                    2.0×
                  </span>
                </label>
                <label>
                  <span className="clamp-label">Light</span>
                  <input type="range" id="light-intensity" min="0" max="10" step="0.05" defaultValue="5" />
                  <span className="clamp-value" id="light-intensity-value">
                    5.00
                  </span>
                </label>
                <label>
                  <span className="clamp-label">Normal scale</span>
                  <input type="range" id="normal-scale" min="0" max="5" step="0.05" defaultValue="1" />
                  <span className="clamp-value" id="normal-scale-value">
                    1.00
                  </span>
                </label>
                <div id="material-toggle">
                  <button id="btn-mat-standard" className="toggle-btn active" type="button">
                    Standard
                  </button>
                  <button id="btn-mat-lambert" className="toggle-btn" type="button">
                    Lambert
                  </button>
                </div>
              </div>
              <div id="three-container"></div>
            </section>
          </div>
          <h2 id="tiled-heading">Tiled</h2>
          <canvas id="canvas-gradient"></canvas>
        </section>
      </div>
    </>
  )
}
