import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';

// --- DOM ---

const dropZoneWrap = document.getElementById('drop-zone-wrap')!;
const dropZone = document.getElementById('drop-zone')!;
const fileInput = document.getElementById('file-input') as HTMLInputElement;
const errorMessage = document.getElementById('error-message')!;
const loadedWrap = document.getElementById('loaded-wrap')!;
const loadedInfo = document.getElementById('loaded-info')!;

const sectionGradient = document.getElementById('section-gradient')!;
const pickerDark = document.getElementById('picker-dark') as HTMLInputElement;
const pickerLight = document.getElementById('picker-light') as HTMLInputElement;

const threeContainer = document.getElementById('three-container')!;
const texSize = document.getElementById('tex-size') as HTMLInputElement;
const texSizeValue = document.getElementById('tex-size-value')!;
const lightIntensity = document.getElementById('light-intensity') as HTMLInputElement;
const lightIntensityValue = document.getElementById('light-intensity-value')!;
const normalScale = document.getElementById('normal-scale') as HTMLInputElement;
const normalScaleValue = document.getElementById('normal-scale-value')!;
const btnMatStandard = document.getElementById('btn-mat-standard')!;
const btnMatLambert = document.getElementById('btn-mat-lambert')!;

// --- Three scene (mirrors three-scene.ts, extended to accept a THREE.Texture and
//     to gradient-remap the sampled color via Color A / Color B uniforms.) ---

type MaterialType = 'standard' | 'lambert';

const colorAUniform = { value: new THREE.Color(0x000000) };
const colorBUniform = { value: new THREE.Color(0xffffff) };

let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let controls: OrbitControls;
let sphere: THREE.Mesh;
let material: THREE.MeshStandardMaterial | THREE.MeshLambertMaterial;
let keyLight: THREE.DirectionalLight;
let colorTexture: THREE.Texture | null = null;
let repeat = +texSize.value;
let materialType: MaterialType = 'standard';
let normalScaleVal = +normalScale.value;

function patchGradientRemap(m: THREE.Material) {
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uColorA = colorAUniform;
    shader.uniforms.uColorB = colorBUniform;
    shader.fragmentShader = shader.fragmentShader.replace(
      'void main() {',
      `uniform vec3 uColorA;
uniform vec3 uColorB;
void main() {`,
    );
    // After the map is sampled into diffuseColor, remap using its luminance.
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      `#include <map_fragment>
#ifdef USE_MAP
  float _ktxLum = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
  diffuseColor.rgb = mix(uColorA, uColorB, _ktxLum);
#endif`,
    );
  };
}

function createMaterial(type: MaterialType): THREE.MeshStandardMaterial | THREE.MeshLambertMaterial {
  const m = type === 'lambert'
    ? new THREE.MeshLambertMaterial({ color: 0xffffff })
    : new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.75, metalness: 0 });
  if (colorTexture) m.map = colorTexture;
  m.normalScale.set(normalScaleVal, normalScaleVal);
  patchGradientRemap(m);
  return m;
}

function initTextureWrap(tex: THREE.Texture) {
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
}

function applyRepeatOnly(tex: THREE.Texture | null) {
  if (!tex) return;
  tex.repeat.set(repeat, repeat);
}

function initThreeScene(container: HTMLElement) {
  if (renderer) return;

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0, 3);

  scene.add(new THREE.AmbientLight(0xffffff, 0.4));
  keyLight = new THREE.DirectionalLight(0xffffff, +lightIntensity.value);
  keyLight.position.set(2, 2, 3);
  scene.add(keyLight);

  material = createMaterial(materialType);
  sphere = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 128), material);
  scene.add(sphere);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  const animate = () => {
    if (!renderer) return;
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  };
  animate();

  const resizeObserver = new ResizeObserver(() => {
    if (!renderer) return;
    const w = container.clientWidth;
    if (w === 0) return;
    renderer.setSize(w, w, false);
    camera.aspect = 1;
    camera.updateProjectionMatrix();
  });
  resizeObserver.observe(container);
}

function setColorTextureFromKtx(tex: THREE.Texture) {
  if (!renderer) return;
  if (colorTexture) colorTexture.dispose();
  colorTexture = tex;
  colorTexture.colorSpace = THREE.SRGBColorSpace;
  initTextureWrap(colorTexture);
  material.map = colorTexture;
  material.needsUpdate = true;
}

function setTextureRepeat(r: number) {
  repeat = r;
  applyRepeatOnly(colorTexture);
}

function setMaterialType(type: MaterialType) {
  materialType = type;
  if (!renderer) return;
  const old = material;
  material = createMaterial(type);
  sphere.material = material;
  old.dispose();
}

function setDirectionalIntensity(v: number) {
  if (!keyLight) return;
  keyLight.intensity = v;
}

function setNormalScale(s: number) {
  normalScaleVal = s;
  if (!material) return;
  material.normalScale.set(s, s);
}

function setColorA(hex: string) {
  colorAUniform.value.set(hex);
}

function setColorB(hex: string) {
  colorBUniform.value.set(hex);
}

// --- KTX2 loading ---

const ktx2Loader = new KTX2Loader()
  .setTranscoderPath('/basis/');

let dragCounter = 0;

function showError(msg: string) {
  errorMessage.textContent = msg;
  errorMessage.classList.remove('hidden');
}

function clearError() {
  errorMessage.classList.add('hidden');
}

function updateDropZoneVisibility() {
  const dragging = dragCounter > 0;
  const hasTexture = colorTexture != null;
  dropZoneWrap.classList.toggle('hidden', hasTexture && !dragging);
  loadedWrap.classList.toggle('hidden', !hasTexture || dragging);
}

function formatInfo(file: File, tex: THREE.Texture): string {
  const img = tex.image as { width?: number; height?: number } | undefined;
  const w = img?.width ?? 0;
  const h = img?.height ?? 0;
  const mips = (tex as unknown as { mipmaps?: unknown[] }).mipmaps?.length ?? 1;
  const sizeKb = (file.size / 1024).toFixed(1);
  return `${file.name}<br><span class="ktx2-info-sub">${w}×${h} · ${mips} mip level${mips === 1 ? '' : 's'} · ${sizeKb} KB</span>`;
}

async function handleFile(file: File) {
  clearError();
  if (!file.name.toLowerCase().endsWith('.ktx2')) {
    showError('Unsupported file type. Please use a .ktx2 file.');
    return;
  }

  // KTX2Loader requires a WebGL renderer to detect supported GPU formats.
  initThreeScene(threeContainer);
  if (renderer) ktx2Loader.detectSupport(renderer);

  try {
    const buffer = await file.arrayBuffer();
    const url = URL.createObjectURL(new Blob([buffer], { type: 'image/ktx2' }));
    try {
      const tex = await ktx2Loader.loadAsync(url);
      setColorTextureFromKtx(tex);
      sectionGradient.classList.remove('hidden');
      loadedInfo.innerHTML = formatInfo(file, tex);
      updateDropZoneVisibility();
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch (err) {
    console.error(err);
    showError(`Error loading KTX2: ${(err as Error).message}`);
  }
}

// --- Drop zone handling ---

window.addEventListener('dragenter', (e) => {
  if (!e.dataTransfer?.types.includes('Files')) return;
  dragCounter++;
  updateDropZoneVisibility();
});

window.addEventListener('dragleave', (e) => {
  if (!e.dataTransfer?.types.includes('Files')) return;
  dragCounter = Math.max(0, dragCounter - 1);
  updateDropZoneVisibility();
});

window.addEventListener('dragover', (e) => {
  e.preventDefault();
});

window.addEventListener('drop', (e) => {
  e.preventDefault();
  dragCounter = 0;
  updateDropZoneVisibility();
});

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const file = e.dataTransfer?.files[0];
  if (file) void handleFile(file);
});

fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  if (file) void handleFile(file);
});

// --- Controls wiring ---

pickerDark.addEventListener('input', () => setColorA(pickerDark.value));
pickerLight.addEventListener('input', () => setColorB(pickerLight.value));
setColorA(pickerDark.value);
setColorB(pickerLight.value);

texSize.addEventListener('input', () => {
  const v = +texSize.value;
  texSizeValue.textContent = `${v.toFixed(1)}×`;
  setTextureRepeat(v);
});

lightIntensity.addEventListener('input', () => {
  const v = +lightIntensity.value;
  lightIntensityValue.textContent = v.toFixed(2);
  setDirectionalIntensity(v);
});

normalScale.addEventListener('input', () => {
  const v = +normalScale.value;
  normalScaleValue.textContent = v.toFixed(2);
  setNormalScale(v);
});

btnMatStandard.addEventListener('click', () => {
  btnMatStandard.classList.add('active');
  btnMatLambert.classList.remove('active');
  setMaterialType('standard');
});

btnMatLambert.addEventListener('click', () => {
  btnMatLambert.classList.add('active');
  btnMatStandard.classList.remove('active');
  setMaterialType('lambert');
});
