// 텍스처·HDRI 불러오기 (manifest.json 에 있는 것만). 없으면 null → 단색으로 그린다.
import * as THREE from "three";

export const A = { tex: {}, hdri: {}, env: {}, ready: false, manifest: null };
const loader = new THREE.TextureLoader();

function loadTex(url, srgb) {
  return new Promise(res => loader.load(url, t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; if (srgb) t.colorSpace = THREE.SRGBColorSpace; res(t); }, undefined, () => res(null)));
}
export async function loadAssets(renderer) {
  try { A.manifest = await (await fetch("assets/manifest.json", { cache: "no-store" })).json(); } catch (e) { A.manifest = { textures: {}, hdri: {} }; }
  const jobs = [];
  for (const role of Object.keys(A.manifest.textures || {})) {
    const m = A.manifest.textures[role];
    jobs.push(loadTex(m.diff, true).then(t => { A.tex[role] = { diff: t }; }).then(() => m.nor ? loadTex(m.nor, false).then(n => { A.tex[role].nor = n; }) : null));
  }
  await Promise.all(jobs);
  // HDRI 는 필요할 때 세계별로 (메모리)
  A.renderer = renderer;
  A.ready = true;
  return A;
}
let RGBELoaderClass = null;
export async function loadEnv(role) {
  if (A.env[role] !== undefined) return A.env[role];
  const m = A.manifest && A.manifest.hdri && A.manifest.hdri[role];
  if (!m) { A.env[role] = null; return null; }
  try {
    if (!RGBELoaderClass) RGBELoaderClass = (await import("three/addons/loaders/RGBELoader.js")).RGBELoader;
    const hdr = await new Promise((res, rej) => new RGBELoaderClass().load(m.file, res, undefined, rej));
    hdr.mapping = THREE.EquirectangularReflectionMapping;
    const pm = new THREE.PMREMGenerator(A.renderer); pm.compileEquirectangularShader();
    const envMap = pm.fromEquirectangular(hdr).texture; pm.dispose();
    A.env[role] = { sky: hdr, env: envMap };
  } catch (e) { console.warn("HDRI 실패", role, e && e.message); A.env[role] = null; }
  return A.env[role];
}
// 풀잎 알파 텍스처 (직접 그림)
export function grassBladeTexture() {
  const c = document.createElement("canvas"); c.width = 128; c.height = 128; const g = c.getContext("2d");
  g.clearRect(0, 0, 128, 128);
  for (let i = 0; i < 9; i++) {
    const x = 10 + i * 13 + Math.random() * 6, h = 70 + Math.random() * 55, w = 5 + Math.random() * 4, lean = (Math.random() - 0.5) * 30;
    const grd = g.createLinearGradient(0, 128, 0, 128 - h); grd.addColorStop(0, "#3d7a2a"); grd.addColorStop(1, "#9fd65a");
    g.fillStyle = grd; g.beginPath(); g.moveTo(x - w, 128); g.quadraticCurveTo(x + lean, 128 - h * 0.6, x + lean * 1.4, 128 - h); g.quadraticCurveTo(x + lean + w * 0.3, 128 - h * 0.6, x + w, 128); g.closePath(); g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
// 물 노멀맵 (직접 그림)
export function waterNormalTexture() {
  const S = 256, c = document.createElement("canvas"); c.width = S; c.height = S; const g = c.getContext("2d"), img = g.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = (y * S + x) * 4, a = Math.sin(x * 0.12) * Math.cos(y * 0.09) + Math.sin((x + y) * 0.05) * 0.5;
    img.data[i] = 128 + a * 40; img.data[i + 1] = 128 + Math.cos(x * 0.07 + y * 0.11) * 40; img.data[i + 2] = 255; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
