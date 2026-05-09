import { useEffect } from 'react'
import Head from 'next/head'

export const TestView = () => {
  useEffect(() => {
    let cancelled = false
    void import('./test-init').then(m => {
      if (!cancelled) m.init()
    })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <>
      <Head>
        <title>Texture testing</title>
      </Head>
      <div id="app">
        <h1>Testing</h1>
        <p className="page-link">
          <a href="/">← back to luminance tool</a>
        </p>

        <div id="drop-row">
          <div id="drop-zone-wrap">
            <h2>Packed texture</h2>
            <div id="drop-zone" className="drop-zone" tabIndex={0}>
              <p>Drop a .png or .ktx2 packed texture (normal in RGB, gradient in alpha).</p>
              <p className="formats">PNG, KTX2</p>
              <input
                type="file"
                id="file-input"
                className="file-input"
                accept=".png,image/png,.ktx2,image/ktx2"
              />
            </div>
          </div>
          <div id="loaded-wrap" className="hidden">
            <h2>Loaded</h2>
            <div id="loaded-info"></div>
          </div>
        </div>
        <div id="error-message" className="hidden"></div>

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
            <section id="section-3d">
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
        </section>
      </div>
    </>
  )
}
