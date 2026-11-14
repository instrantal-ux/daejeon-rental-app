// three.js 가짜 모듈 — 그리기는 안 하고 게임 로직만 돌려보기 위한 최소 구현 (테스트 전용)
export const SRGBColorSpace = "srgb", ACESFilmicToneMapping = 4, DynamicDrawUsage = 35048, DoubleSide = 2;
export const MathUtils = { clamp: (v, a, b) => Math.max(a, Math.min(b, v)) };
export class Vector3 {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; } copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; } clone() { return new Vector3(this.x, this.y, this.z); }
  add(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this; } multiplyScalar(s) { this.x *= s; this.y *= s; this.z *= s; return this; } setScalar(s) { return this.set(s, s, s); }
  distanceTo(v) { return Math.hypot(this.x - v.x, this.y - v.y, this.z - v.z); } lerp(v, t) { this.x += (v.x - this.x) * t; this.y += (v.y - this.y) * t; this.z += (v.z - this.z) * t; return this; }
}
export class Euler { constructor() { this.x = 0; this.y = 0; this.z = 0; } set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; } }
export class Quaternion { setFromAxisAngle() { return this; } }
export class Matrix4 { compose() { return this; } }
export class Color {
  constructor(c) { this.set(c); }
  set(c) { if (c instanceof Color) { this.r = c.r; this.g = c.g; this.b = c.b; } else { c = c || 0; this.r = ((c >> 16) & 255) / 255; this.g = ((c >> 8) & 255) / 255; this.b = (c & 255) / 255; } return this; }
  copy(c) { return this.set(c); } setRGB(r, g, b) { this.r = r; this.g = g; this.b = b; return this; } multiply(c) { this.r *= c.r; this.g *= c.g; this.b *= c.b; return this; } clone() { return new Color(this); } lerp(c, t) { this.r += (c.r - this.r) * t; this.g += (c.g - this.g) * t; this.b += (c.b - this.b) * t; return this; } setHSL() { return this; }
}
export class Object3D {
  constructor() { this.position = new Vector3(); this.rotation = new Euler(); this.scale = new Vector3(1, 1, 1); this.children = []; this.visible = true; this.name = ""; this.parent = null; }
  add(...os) { os.forEach(o => { o.parent = this; this.children.push(o); }); return this; } remove(o) { this.children = this.children.filter(c => c !== o); return this; }
  getObjectByName(n) { if (this.name === n) return this; for (const c of this.children) { const r = c.getObjectByName(n); if (r) return r; } return null; }
  traverse(fn) { fn(this); this.children.forEach(c => c.traverse(fn)); } lookAt() {} clone() { const o = new this.constructor(); o.children = this.children.slice(); return o; }
}
export class Group extends Object3D {}
export class Scene extends Object3D { constructor() { super(); this.background = null; this.fog = null; } }
export class PerspectiveCamera extends Object3D { constructor(fov, aspect) { super(); this.fov = fov; this.aspect = aspect; } updateProjectionMatrix() {} }
class Geo { constructor() { this.attributes = {}; } translate() { return this; } scale() { return this; } rotateX() { return this; } setAttribute() { return this; } computeVertexNormals() {} dispose() {} }
export class BufferGeometry extends Geo {}
export class PlaneGeometry extends Geo {
  constructor(w, h, sw = 1, sh = 1) { super(); const n = (sw + 1) * (sh + 1), xs = new Float32Array(n), ys = new Float32Array(n), zs = new Float32Array(n); let i = 0;
    for (let r = 0; r <= sh; r++) for (let c = 0; c <= sw; c++) { xs[i] = -w / 2 + c * (w / sw); zs[i] = -h / 2 + r * (h / sh); i++; }
    this.attributes.position = { count: n, getX: i => xs[i], getZ: i => zs[i], setY: (i, v) => { ys[i] = v; } }; this.attributes.uv = { setXY() {} }; }
}
export class BufferAttribute { constructor(a, n) { this.array = a; this.itemSize = n; } }
export class CylinderGeometry extends Geo {} export class CapsuleGeometry extends Geo {} export class ConeGeometry extends Geo {} export class IcosahedronGeometry extends Geo {}
export class DodecahedronGeometry extends Geo {} export class OctahedronGeometry extends Geo {} export class SphereGeometry extends Geo {} export class TorusGeometry extends Geo {}
export class CircleGeometry extends Geo {} export class BoxGeometry extends Geo {}
class Mat { constructor(p) { Object.assign(this, p || {}); if (typeof this.color === "number" || this.color == null) this.color = new Color(this.color); } dispose() {} }
export class MeshStandardMaterial extends Mat {} export class MeshBasicMaterial extends Mat {}
export class Mesh extends Object3D { constructor(g, m) { super(); this.geometry = g; this.material = m; this.receiveShadow = false; } }
export class InstancedMesh extends Mesh { constructor(g, m, n) { super(g, m); this.count = n; this.instanceMatrix = { setUsage() {}, needsUpdate: false }; this.frustumCulled = true; this.sets = 0; } setMatrixAt() { this.sets++; } }
class Light extends Object3D { constructor(c, i) { super(); this.color = new Color(c); this.intensity = i; this.target = new Object3D(); } }
export class DirectionalLight extends Light {} export class HemisphereLight extends Light {} export class PointLight extends Light {}
export class Fog { constructor(c, n, f) { this.color = new Color(c); this.near = n; this.far = f; } }
export class CanvasTexture { constructor(c) { this.image = c; this.colorSpace = ""; } }
export class Clock { constructor() { this.t = performance.now(); } start() { this.t = performance.now(); } getDelta() { const n = performance.now(), d = (n - this.t) / 1000; this.t = n; return d; } }
export class WebGLRenderer { constructor() { this.frames = 0; this.outputColorSpace = ""; this.toneMapping = 0; this.toneMappingExposure = 1; } setPixelRatio() {} setSize() {} render() { this.frames++; } }
// ---- v0.2 추가: 텍스처·환경맵·그림자 관련 최소 스텁 ----
export const RepeatWrapping = 1000, EquirectangularReflectionMapping = 303, PCFSoftShadowMap = 2;
export class Vector2 { constructor(x = 0, y = 0) { this.x = x; this.y = y; } set(x, y) { this.x = x; this.y = y; return this; } }
export class FogExp2 { constructor(c, d) { this.color = new Color(c); this.density = d; } }
export class LatheGeometry extends Geo {}
export class AnimationMixer { update() {} clipAction() { return { play() {} }; } }
export class TextureLoader { load(url, ok, _p, fail) { setTimeout(() => fail && fail(new Error("stub")), 0); } }
export class PMREMGenerator { compileEquirectangularShader() {} fromEquirectangular() { return { texture: {} }; } dispose() {} }
Geo.prototype.clone = function () { const g = new this.constructor(); g.attributes = this.attributes; return g; };
Geo.prototype.rotateY = Geo.prototype.rotateZ = function () { return this; };
const _pg = PlaneGeometry; PlaneGeometry.prototype.__init = null;
CanvasTexture.prototype.__v2 = true;
Object.defineProperty(CanvasTexture.prototype, "repeat", { get() { return this._r || (this._r = new Vector2(1, 1)); } });
Object.defineProperty(CanvasTexture.prototype, "offset", { get() { return this._o || (this._o = new Vector2()); } });
InstancedMesh.prototype.setColorAt = function () { this.instanceColor = this.instanceColor || { needsUpdate: false }; };
Light.prototype.__shadow = null;
Object.defineProperty(Light.prototype, "shadow", { get() { return this._s || (this._s = { mapSize: new Vector2(), camera: {}, bias: 0, normalBias: 0 }); } });
Object.defineProperty(WebGLRenderer.prototype, "shadowMap", { get() { return this._sm || (this._sm = { enabled: false, type: 0 }); } });
void _pg;
