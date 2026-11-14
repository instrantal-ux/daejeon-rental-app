// 세계(지형·물·소품·풀) 생성. 사진 텍스처가 있으면 섞어 칠하고(스플랫), 없으면 단색.
import * as THREE from "three";
import { makeNoise } from "./noise.js";
import { A, grassBladeTexture, waterNormalTexture } from "./assets.js";

export const SIZE = 640;
const SEG = 180;
export const WORLDS = [
  { id: 0, name: "초록 평원", seed: 20261114, sky: 0x9fd3ff, hdri: "day", fogNear: 70, fogFar: 300, amp: 16, water: 1.2,
    low: 0x7fbf5e, high: 0x5e8f4a, cliff: 0x8a7e6a, peak: 0xe0e4df, sand: 0xe9d99a, tint: 0xffffff,
    tex: { base: "grass", slope: "rock", low: "sand", high: "rock" },
    props: { tree: 1.0, rock: 0.6, bush: 0.8, ore: 0.18, crystal: 0.03, grass: 1 }, treeColor: 0x3f8a3a, trunk: 0x6b4a2b, rockColor: 0x8a8a84, waterColor: 0x2f7fc8 },
  { id: 1, name: "붉은 사막", seed: 7777, sky: 0xffcf9a, hdri: "desert", fogNear: 60, fogFar: 280, amp: 22, water: -5,
    low: 0xe0ac62, high: 0xc0823f, cliff: 0x8a4e2a, peak: 0xf0d2a4, sand: 0xe8bf7f, tint: 0xffd9b0,
    tex: { base: "sand", slope: "desert", low: "sand", high: "rock" },
    props: { tree: 0.35, rock: 0.9, bush: 0.3, ore: 0.5, crystal: 0.15, grass: 0.15 }, treeColor: 0x5aa050, trunk: 0x6c8a4a, rockColor: 0xa06a4a, waterColor: 0x3a8fbf },
  { id: 2, name: "하얀 설원", seed: 4242, sky: 0xdbe8f5, hdri: "snow", fogNear: 45, fogFar: 220, amp: 28, water: -2,
    low: 0xf4f7fa, high: 0xdfe7ef, cliff: 0x76808c, peak: 0xffffff, sand: 0xd8dfe6, tint: 0xf4f8ff,
    tex: { base: "snow", slope: "rock", low: "snow", high: "snow" },
    props: { tree: 0.7, rock: 0.7, bush: 0.25, ore: 0.35, crystal: 0.3, grass: 0 }, treeColor: 0x2f6650, trunk: 0x4a3a2e, rockColor: 0x6d7580, waterColor: 0x4a86b8 },
  { id: 3, name: "보랏빛 심연", seed: 99119, sky: 0x3b2a5a, hdri: "night", fogNear: 35, fogFar: 170, amp: 34, water: 0.5,
    low: 0x7a5aa8, high: 0x55407a, cliff: 0x3a2d52, peak: 0xc8b2f0, sand: 0x7e6aa6, tint: 0xb79fe0,
    tex: { base: "grass", slope: "rock", low: "sand", high: "rock" },
    props: { tree: 0.6, rock: 0.5, bush: 0.5, ore: 0.6, crystal: 0.6, grass: 0.4 }, treeColor: 0xb06ad8, trunk: 0x2e1f44, rockColor: 0x4b3f66, waterColor: 0x6a3fb0 },
];
export const PROP_INFO = {
  tree:    { label: "나무",   gives: [["wood", 3], ["fiber", 1]], hp: 3, tool: "axe", toolMul: 3, respawn: 240, r: 1.4 },
  rock:    { label: "바위",   gives: [["stone", 2]], hp: 2, tool: "pick", toolMul: 2, respawn: 200, r: 1.3 },
  bush:    { label: "열매 덤불", gives: [["berry", 2], ["fiber", 1]], hp: 1, tool: null, toolMul: 1, respawn: 120, r: 1.1 },
  ore:     { label: "광맥",   gives: [["ore", 2], ["stone", 1]], hp: 3, tool: "pick", need: "pick", toolMul: 1, respawn: 300, r: 1.4 },
  crystal: { label: "수정",   gives: [["crystal", 1]], hp: 2, tool: "pick", need: "pick", toolMul: 1, respawn: 420, r: 1.1 },
  grass:   { label: "풀",     gives: [["fiber", 1]], hp: 1, tool: null, toolMul: 1, respawn: 90, r: 0.9 },
};
const smooth = (a, b, x) => { const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

export function makeTerrainFn(w) {
  const N = makeNoise(w.seed), half = SIZE / 2;
  return function heightAt(x, z) {
    const d = Math.max(Math.abs(x), Math.abs(z)) / half, edge = d > 0.82 ? (d - 0.82) / 0.18 : 0;
    let h = N.fbm(x * 0.0045, z * 0.0045, 5, 2.05, 0.5) * w.amp;
    const ridge = 1 - Math.abs(N.n2(x * 0.0015 + 9, z * 0.0015 - 4));
    h += ridge * ridge * w.amp * 0.6;
    h += N.n2(x * 0.03, z * 0.03) * 0.6;
    return h * (1 - edge * edge) - edge * edge * 30;
  };
}

export class World {
  constructor(def) {
    this.def = def; this.heightAt = makeTerrainFn(def); this.group = new THREE.Group();
    this.props = []; this.byType = {}; this.placed = []; this.rnd = makeNoise(def.seed + 1).rnd;
    this._buildTerrain(); this._buildWater(); this._buildProps(); this._buildGrass();
  }
  slopeAt(x, z) { const h = this.heightAt(x, z); return Math.abs(this.heightAt(x + 2, z) - h) + Math.abs(this.heightAt(x, z + 2) - h); }
  _buildTerrain() {
    const w = this.def, geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG); geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position, n = pos.count, colors = new Float32Array(n * 3), splat = new Float32Array(n * 4), uv = geo.attributes.uv;
    const T = A.tex, hasTex = !!(T[w.tex.base] && T[w.tex.base].diff);
    const cLow = new THREE.Color(w.low), cHigh = new THREE.Color(w.high), cCliff = new THREE.Color(w.cliff), cPeak = new THREE.Color(w.peak), cSand = new THREE.Color(w.sand), tint = new THREE.Color(w.tint), white = new THREE.Color(0xffffff), tmp = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const x = pos.getX(i), z = pos.getZ(i), h = this.heightAt(x, z); pos.setY(i, h);
      const slope = this.slopeAt(x, z);
      const wSlope = smooth(1.3, 2.8, slope), wLow = smooth(w.water + 1.9, w.water + 0.5, h), wHigh = smooth(w.amp * 1.05, w.amp * 1.5, h) * (1 - wSlope);
      const wBase = Math.max(0, 1 - wSlope - wLow - wHigh);
      splat[i * 4] = wBase; splat[i * 4 + 1] = wSlope; splat[i * 4 + 2] = wLow; splat[i * 4 + 3] = wHigh;
      const t = THREE.MathUtils.clamp((h - 2) / (w.amp * 1.2), 0, 1);
      tmp.copy(cLow).lerp(cHigh, t); if (wHigh > 0) tmp.lerp(cPeak, wHigh); if (wSlope > 0) tmp.lerp(cCliff, wSlope); if (wLow > 0) tmp.lerp(cSand, wLow);
      if (hasTex) tmp.lerp(white, 0.7).multiply(tint);
      colors[i * 3] = tmp.r; colors[i * 3 + 1] = tmp.g; colors[i * 3 + 2] = tmp.b;
      if (uv) uv.setXY(i, (x + SIZE / 2) / 7, (z + SIZE / 2) / 7);
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.setAttribute("splat", new THREE.BufferAttribute(splat, 4));
    geo.computeVertexNormals();
    let mat;
    if (hasTex) {
      const base = T[w.tex.base], slopeT = T[w.tex.slope] || base, lowT = T[w.tex.low] || base, highT = T[w.tex.high] || slopeT;
      mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0, map: base.diff, normalMap: base.nor || slopeT.nor || null, normalScale: new THREE.Vector2(0.7, 0.7) });
      mat.onBeforeCompile = sh => {
        sh.uniforms.tSlope = { value: slopeT.diff }; sh.uniforms.tLow = { value: lowT.diff }; sh.uniforms.tHigh = { value: highT.diff };
        sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nattribute vec4 splat; varying vec4 vSplat;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvSplat = splat;");
        sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nuniform sampler2D tSlope; uniform sampler2D tLow; uniform sampler2D tHigh; varying vec4 vSplat;")
          .replace("#include <map_fragment>", `
            vec4 cB = texture2D(map, vMapUv); vec4 cS = texture2D(tSlope, vMapUv * 1.37); vec4 cL = texture2D(tLow, vMapUv * 0.9); vec4 cH = texture2D(tHigh, vMapUv * 1.1);
            vec4 texel = cB * vSplat.x + cS * vSplat.y + cL * vSplat.z + cH * vSplat.w;
            diffuseColor *= texel;`);
      };
    } else mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
    this.terrain = new THREE.Mesh(geo, mat); this.terrain.receiveShadow = true; this.group.add(this.terrain);
  }
  _buildWater() {
    const w = this.def, geo = new THREE.PlaneGeometry(SIZE * 1.8, SIZE * 1.8, 1, 1); geo.rotateX(-Math.PI / 2);
    const nt = waterNormalTexture(); nt.repeat.set(90, 90);
    const mat = new THREE.MeshStandardMaterial({ color: w.waterColor, transparent: true, opacity: 0.78, roughness: 0.12, metalness: 0.05, normalMap: nt, normalScale: new THREE.Vector2(0.35, 0.35) });
    this.water = new THREE.Mesh(geo, mat); this.water.position.y = w.water; this.group.add(this.water);
    this.waterNormal = nt;
  }
  _buildProps() {
    const w = this.def, dens = w.props;
    const counts = { tree: Math.round(560 * dens.tree), rock: Math.round(260 * dens.rock), bush: Math.round(220 * dens.bush), ore: Math.round(90 * dens.ore), crystal: Math.round(60 * dens.crystal), grass: Math.round(500 * dens.grass) };
    const parts = this._propGeometries();
    Object.keys(counts).forEach(type => {
      const n = counts[type]; if (!n) return;
      const list = []; let tries = 0;
      while (list.length < n && tries++ < n * 6) {
        const x = (this.rnd() - 0.5) * SIZE * 0.8, z = (this.rnd() - 0.5) * SIZE * 0.8, h = this.heightAt(x, z);
        if (h < w.water + 0.6) continue;
        const slope = this.slopeAt(x, z);
        if (slope > 2.4 && type !== "rock" && type !== "ore" && type !== "crystal") continue;
        if (type === "crystal" && h < w.amp * 0.6 && this.rnd() < 0.7) continue;
        if (Math.hypot(x, z) < 10) continue;
        list.push({ type, x, y: h, z, rot: this.rnd() * Math.PI * 2, s: 0.75 + this.rnd() * 0.6, hp: PROP_INFO[type].hp, alive: true, dead: 0, tint: 0.85 + this.rnd() * 0.3 });
      }
      const meshes = parts[type].map(p => {
        const m = new THREE.InstancedMesh(p.geo, p.mat, list.length);
        m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; m.castShadow = type !== "grass"; m.receiveShadow = type === "rock" || type === "ore";
        this.group.add(m); return { mesh: m, tintable: !!p.tintable };
      });
      const col = new THREE.Color();
      list.forEach((it, i) => {
        it.index = i; it.meshes = meshes; this.props.push(it); this._writeInstance(it, 1);
        meshes.forEach(mm => { if (mm.tintable && mm.mesh.setColorAt) { col.setRGB(it.tint, 0.9 + (it.tint - 0.85) * 0.5, it.tint * 0.95); mm.mesh.setColorAt(i, col); } });
      });
      meshes.forEach(mm => { mm.mesh.instanceMatrix.needsUpdate = true; if (mm.mesh.instanceColor) mm.mesh.instanceColor.needsUpdate = true; });
      this.byType[type] = list;
    });
  }
  _propGeometries() {
    const w = this.def, T = A.tex, g = {};
    const barkMat = new THREE.MeshStandardMaterial({ color: w.trunk, roughness: 1, map: T.bark ? T.bark.diff : null, normalMap: T.bark ? T.bark.nor : null });
    if (T.bark && T.bark.diff) barkMat.color.set(0xffffff).lerp(new THREE.Color(w.trunk), 0.35);
    const trunk = new THREE.CylinderGeometry(0.17, 0.3, 2.6, 7); trunk.translate(0, 1.3, 0);
    const leafMat = new THREE.MeshStandardMaterial({ color: w.treeColor, roughness: 0.85 });
    if (w.id === 1) {
      const body = new THREE.CapsuleGeometry(0.38, 2.4, 6, 10); body.translate(0, 1.6, 0);
      const arm = new THREE.CapsuleGeometry(0.2, 0.9, 4, 8); arm.rotateZ(Math.PI / 2); arm.translate(0.6, 1.7, 0);
      const arm2 = new THREE.CapsuleGeometry(0.2, 0.8, 4, 8); arm2.translate(0.95, 2.3, 0);
      g.tree = [{ geo: body, mat: leafMat, tintable: true }, { geo: arm, mat: leafMat, tintable: true }, { geo: arm2, mat: leafMat, tintable: true }];
    } else if (w.id === 2) {
      const c1 = new THREE.ConeGeometry(1.6, 2.4, 8); c1.translate(0, 2.4, 0); const c2 = new THREE.ConeGeometry(1.25, 2.1, 8); c2.translate(0, 3.6, 0); const c3 = new THREE.ConeGeometry(0.85, 1.8, 8); c3.translate(0, 4.7, 0);
      const snowMat = new THREE.MeshStandardMaterial({ color: 0xf4f8ff, roughness: 1 });
      const cap = new THREE.ConeGeometry(0.9, 0.5, 8); cap.translate(0, 5.5, 0);
      g.tree = [{ geo: trunk, mat: barkMat }, { geo: c1, mat: leafMat, tintable: true }, { geo: c2, mat: leafMat, tintable: true }, { geo: c3, mat: leafMat, tintable: true }, { geo: cap, mat: snowMat }];
    } else {
      const c1 = new THREE.IcosahedronGeometry(1.55, 2); c1.translate(0, 3.1, 0);
      const c2 = new THREE.IcosahedronGeometry(1.1, 2); c2.translate(0.9, 3.7, 0.4);
      const c3 = new THREE.IcosahedronGeometry(1.0, 2); c3.translate(-0.8, 3.9, -0.5);
      g.tree = [{ geo: trunk, mat: barkMat }, { geo: c1, mat: leafMat, tintable: true }, { geo: c2, mat: leafMat, tintable: true }, { geo: c3, mat: leafMat, tintable: true }];
    }
    const rockMat = new THREE.MeshStandardMaterial({ color: T.rock ? 0xffffff : w.rockColor, roughness: 0.95, map: T.rock ? T.rock.diff : null, normalMap: T.rock ? T.rock.nor : null, flatShading: !T.rock });
    const rock = new THREE.DodecahedronGeometry(1, 1); rock.scale(1, 0.75, 1); rock.translate(0, 0.45, 0);
    g.rock = [{ geo: rock, mat: rockMat, tintable: true }];
    const bush = new THREE.IcosahedronGeometry(0.85, 2); bush.scale(1, 0.8, 1); bush.translate(0, 0.6, 0);
    const berries = new THREE.IcosahedronGeometry(0.95, 1); berries.scale(1, 0.8, 1); berries.translate(0, 0.65, 0);
    g.bush = [{ geo: bush, mat: new THREE.MeshStandardMaterial({ color: 0x3e8a3f, roughness: 0.9 }), tintable: true }, { geo: berries, mat: new THREE.MeshStandardMaterial({ color: 0xe0334d, roughness: 0.5, wireframe: true }) }];
    const ore = new THREE.DodecahedronGeometry(1.1, 1); ore.translate(0, 0.55, 0);
    const vein = new THREE.OctahedronGeometry(0.45, 0); vein.translate(0.35, 1.0, 0.25);
    g.ore = [{ geo: ore, mat: new THREE.MeshStandardMaterial({ color: 0x3e3e46, roughness: 0.8, map: T.rock ? T.rock.diff : null }) }, { geo: vein, mat: new THREE.MeshStandardMaterial({ color: 0xffc23a, metalness: 0.9, roughness: 0.25 }) }];
    const cry = new THREE.OctahedronGeometry(0.7, 0); cry.scale(0.7, 1.8, 0.7); cry.translate(0, 1.1, 0);
    const cry2 = new THREE.OctahedronGeometry(0.45, 0); cry2.scale(0.6, 1.5, 0.6); cry2.translate(0.5, 0.7, 0.2);
    const cryMat = new THREE.MeshStandardMaterial({ color: 0x9af0ff, emissive: 0x2ab6d8, emissiveIntensity: 0.8, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.9 });
    g.crystal = [{ geo: cry, mat: cryMat }, { geo: cry2, mat: cryMat }];
    const gr = new THREE.ConeGeometry(0.3, 0.9, 5); gr.translate(0, 0.45, 0);
    g.grass = [{ geo: gr, mat: new THREE.MeshStandardMaterial({ color: w.id === 3 ? 0x9a6ad0 : 0x7fbf5a, roughness: 1 }), tintable: true }];
    return g;
  }
  _buildGrass() {
    const w = this.def; if (!w.props.grass) return;
    const n = Math.round(2600 * w.props.grass), tex = grassBladeTexture();
    const quad = new THREE.PlaneGeometry(1.1, 0.9); quad.translate(0, 0.45, 0);
    const quad2 = quad.clone(); quad2.rotateY(Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 1, color: w.id === 3 ? 0xc9a6ff : 0xffffff });
    const m1 = new THREE.InstancedMesh(quad, mat, n), m2 = new THREE.InstancedMesh(quad2, mat, n);
    m1.frustumCulled = m2.frustumCulled = false;
    const M = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    let placed = 0, tries = 0;
    while (placed < n && tries++ < n * 4) {
      const x = (this.rnd() - 0.5) * SIZE * 0.8, z = (this.rnd() - 0.5) * SIZE * 0.8, h = this.heightAt(x, z);
      if (h < w.water + 1.2 || this.slopeAt(x, z) > 1.6 || h > w.amp * 1.05) continue;
      q.setFromAxisAngle(up, this.rnd() * Math.PI); const k = 0.8 + this.rnd() * 0.7; s.set(k, k, k); v.set(x, h - 0.05, z);
      M.compose(v, q, s); m1.setMatrixAt(placed, M); m2.setMatrixAt(placed, M); placed++;
    }
    m1.count = m2.count = placed; m1.instanceMatrix.needsUpdate = m2.instanceMatrix.needsUpdate = true;
    this.group.add(m1, m2);
  }
  _writeInstance(it, scaleMul) {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), it.rot), s = it.s * scaleMul;
    m.compose(new THREE.Vector3(it.x, it.y, it.z), q, new THREE.Vector3(s, s, s));
    it.meshes.forEach(mm => { mm.mesh.setMatrixAt(it.index, m); mm.mesh.instanceMatrix.needsUpdate = true; });
  }
  nearest(x, z, maxDist) {
    let best = null, bd = maxDist * maxDist;
    for (const it of this.props) { if (!it.alive) continue; const dx = it.x - x, dz = it.z - z, d = dx * dx + dz * dz; if (d < bd) { bd = d; best = it; } }
    return best;
  }
  hit(it, dmg) {
    it.hp -= dmg; this._writeInstance(it, 0.92);
    if (it.hp <= 0) { it.alive = false; it.dead = 0; this._writeInstance(it, 0.0001); return true; }
    return false;
  }
  tick(dt, t) {
    for (const it of this.props) { if (it.alive) continue; it.dead += dt; if (it.dead >= PROP_INFO[it.type].respawn) { it.alive = true; it.hp = PROP_INFO[it.type].hp; this._writeInstance(it, 1); } }
    if (this.waterNormal) this.waterNormal.offset.set(t * 0.012, t * 0.009);
  }
  dispose() { this.group.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
  place(kind, x, z, rotY) {
    const y = this.heightAt(x, z), g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rotY || 0;
    const T = A.tex, stoneMat = new THREE.MeshStandardMaterial({ color: T.rock ? 0xdddddd : 0x777777, roughness: 1, map: T.rock ? T.rock.diff : null });
    const woodMat = new THREE.MeshStandardMaterial({ color: T.bark ? 0xffffff : 0x6b4a2b, roughness: 1, map: T.bark ? T.bark.diff : null });
    if (kind === "campfire") {
      for (let i = 0; i < 7; i++) { const s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.25, 0), stoneMat); const a = i / 7 * Math.PI * 2; s.position.set(Math.cos(a) * 0.75, 0.15, Math.sin(a) * 0.75); s.castShadow = true; g.add(s); }
      for (let i = 0; i < 3; i++) { const log = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.1, 6), woodMat); log.rotation.z = Math.PI / 2.6; log.rotation.y = i * 2.1; log.position.y = 0.3; g.add(log); }
      const fire = new THREE.Mesh(new THREE.ConeGeometry(0.33, 0.9, 7), new THREE.MeshStandardMaterial({ color: 0xffb040, emissive: 0xff6a00, emissiveIntensity: 1.6, transparent: true, opacity: 0.9 })); fire.position.y = 0.65; fire.name = "fire"; g.add(fire);
      const light = new THREE.PointLight(0xffa040, 2.2, 16, 1.6); light.position.y = 1.2; g.add(light);
    } else if (kind === "hut") {
      const wall = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.4, 2.4, 10), woodMat); wall.position.y = 1.2; wall.castShadow = true; g.add(wall);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(3.1, 2.1, 10), new THREE.MeshStandardMaterial({ color: 0x5a3f2a, roughness: 1 })); roof.position.y = 3.35; roof.castShadow = true; g.add(roof);
      const door = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.6, 0.2), new THREE.MeshStandardMaterial({ color: 0x2e2015 })); door.position.set(0, 0.8, 2.3); g.add(door);
      const lamp = new THREE.PointLight(0xffd090, 0.8, 8, 1.6); lamp.position.set(0, 1.9, 2.6); g.add(lamp);
    } else if (kind === "portal") {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(2, 0.3, 12, 36), new THREE.MeshStandardMaterial({ color: 0x8a6fe0, emissive: 0x6a3fe0, emissiveIntensity: 0.9, metalness: 0.6, roughness: 0.25 })); ring.position.y = 2.4; ring.castShadow = true; g.add(ring);
      const disk = new THREE.Mesh(new THREE.CircleGeometry(1.8, 36), new THREE.MeshBasicMaterial({ color: 0xc9b6ff, transparent: true, opacity: 0.55, side: THREE.DoubleSide })); disk.position.y = 2.4; disk.name = "disk"; g.add(disk);
      for (let i = 0; i < 2; i++) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2.6, 0.5), stoneMat); p.position.set(i ? 2.2 : -2.2, 1.3, 0); p.castShadow = true; g.add(p); }
      const light = new THREE.PointLight(0x9a7fff, 3, 20, 1.6); light.position.y = 2.4; g.add(light);
    }
    this.group.add(g);
    const rec = { kind, x, z, rotY: rotY || 0, obj: g }; this.placed.push(rec); return rec;
  }
}
