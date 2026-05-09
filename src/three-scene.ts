import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

export type MaterialType = 'standard' | 'lambert'

let renderer: THREE.WebGLRenderer | null = null
let scene: THREE.Scene
let camera: THREE.PerspectiveCamera
let controls: OrbitControls
let sphere: THREE.Mesh
let material: THREE.MeshStandardMaterial | THREE.MeshLambertMaterial
let keyLight: THREE.DirectionalLight
let colorTexture: THREE.CanvasTexture | null = null
let normalTexture: THREE.CanvasTexture | null = null
let repeat = 2
let materialType: MaterialType = 'standard'
let normalScale = 1

function createMaterial(type: MaterialType): THREE.MeshStandardMaterial | THREE.MeshLambertMaterial {
  const m =
    type === 'lambert'
      ? new THREE.MeshLambertMaterial({ color: 0xffffff })
      : new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.75, metalness: 0 })
  if (colorTexture) m.map = colorTexture
  if (normalTexture) m.normalMap = normalTexture
  m.normalScale.set(normalScale, normalScale)
  return m
}

function initTextureWrap(tex: THREE.Texture) {
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(repeat, repeat)
}

function applyRepeatOnly(tex: THREE.Texture | null) {
  if (!tex) return
  tex.repeat.set(repeat, repeat)
}

export function initThreeScene(container: HTMLElement) {
  if (renderer) return

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  container.appendChild(renderer.domElement)

  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100)
  camera.position.set(0, 0, 3)

  scene.add(new THREE.AmbientLight(0xffffff, 0.4))
  keyLight = new THREE.DirectionalLight(0xffffff, 5)
  keyLight.position.set(2, 2, 3)
  scene.add(keyLight)

  material = createMaterial(materialType)
  sphere = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 128), material)
  scene.add(sphere)

  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true

  const animate = () => {
    if (!renderer) return
    requestAnimationFrame(animate)
    controls.update()
    renderer.render(scene, camera)
  }
  animate()

  const resizeObserver = new ResizeObserver(() => {
    if (!renderer) return
    const w = container.clientWidth
    if (w === 0) return
    renderer.setSize(w, w, false)
    camera.aspect = 1
    camera.updateProjectionMatrix()
  })
  resizeObserver.observe(container)
}

export function setColorTexture(canvas: HTMLCanvasElement) {
  if (!renderer) return
  if (colorTexture) colorTexture.dispose()
  colorTexture = new THREE.CanvasTexture(canvas)
  colorTexture.colorSpace = THREE.SRGBColorSpace
  initTextureWrap(colorTexture)
  material.map = colorTexture
  material.needsUpdate = true
}

export function setNormalTexture(canvas: HTMLCanvasElement) {
  if (!renderer) return
  if (normalTexture) normalTexture.dispose()
  normalTexture = new THREE.CanvasTexture(canvas)
  initTextureWrap(normalTexture)
  material.normalMap = normalTexture
  material.needsUpdate = true
}

export function setTextureRepeat(r: number) {
  repeat = r
  applyRepeatOnly(colorTexture)
  applyRepeatOnly(normalTexture)
}

export function setMaterialType(type: MaterialType) {
  materialType = type
  if (!renderer) return
  const old = material
  material = createMaterial(type)
  sphere.material = material
  old.dispose()
}

export function setDirectionalIntensity(v: number) {
  if (!keyLight) return
  keyLight.intensity = v
}

export function setNormalScale(s: number) {
  normalScale = s
  if (!material) return
  material.normalScale.set(s, s)
}
