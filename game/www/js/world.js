// 세계(지형·소품) 생성. 세계마다 시드·색·소품 밀도가 다르다.
import * as THREE from "three";
import { makeNoise } from "./noise.js";

export const SIZE = 640;          // 한 변 길이 (유닛 ≈ 미터)
const SEG = 160;                  // 지형 분할 수
export const WORLDS = [
  { id: 0, name: "초록 평원", seed: 20261114, sky: 0x9fd3ff, fogNear: 60, fogFar: 260, amp: 16, water: 1.2,
    low: 0x6fae4e, high: 0x4e7f3a, cliff: 0x7a6e5a, peak: 0xcfd3cc, sand: 0xd9c98a,
    props: { tree: 1.0, rock: 0.6, bush: 0.8, ore: 0.18, crystal: 0.03, grass: 1 }, treeColor: 0x3f8a3a, trunk: 0x6b4a2b, rockColor: 0x8a8a84 },
  { id: 1, name: "붉은 사막", seed: 7777, sky: 0xffcf9a, fogNear: 50, fogFar: 240, amp: 22, water: -5,
    low: 0xd8a35a, high: 0xb77a3c, cliff: 0x8a4e2a, peak: 0xe8c9a0, sand: 0xe2b877,
    props: { tree: 0.35, rock: 0.9, bush: 0.3, ore: 0.5, crystal: 0.15, grass: 0.2 }, treeColor: 0x4f9a4a, trunk: 0x5c7a3a, rockColor: 0xa06a4a },
  { id: 2, name: "하얀 설원", seed: 4242, sky: 0xdbe8f5, fogNear: 40, fogFar: 200, amp: 28, water: -2,
    low: 0xeef3f7, high: 0xd3dde8, cliff: 0x6f7784, peak: 0xffffff, sand: 0xcfd7df,
    props: { tree: 0.7, rock: 0.7, bush: 0.25, ore: 0.35, crystal: 0.3, grass: 0 }, treeColor: 0x2f5f4a, trunk: 0x4a3a2e, rockColor: 0x6d7580 },
  { id: 3, name: "보랏빛 심연", seed: 99119, sky: 0x3b2a5a, fogNear: 30, fogFar: 160, amp: 34, water: 0.5,
    low: 0x5a3f7a, high: 0x3e2b5e, cliff: 0x2a1f3a, peak: 0xb79fe0, sand: 0x6a5590,
    props: { tree: 0.6, rock: 0.5, bush: 0.5, ore: 0.6, crystal: 0.6, grass: 0.4 }, treeColor: 0xb06ad8, trunk: 0x2e1f44, rockColor: 0x4b3f66 },
];
export const PROP_INFO = {
  tree:    { label: "나무",   gives: [["wood", 3], ["fiber", 1]], hp: 3, tool: "axe", toolMul: 3, respawn: 240, r: 1.4 },
  rock:    { label: "바위",   gives: [["stone", 2]], hp: 2, tool: "pick", toolMul: 2, respawn: 200, r: 1.3 },
  bush:    { label: "열매 덤불", gives: [["berry", 2], ["fiber", 1]], hp: 1, tool: null, toolMul: 1, respawn: 120, r: 1.1 },
  ore:     { label: "광맥",   gives: [["ore", 2], ["stone", 1]], hp: 3, tool: "pick", need: "pick", toolMul: 1, respawn: 300, r: 1.4 },
  crystal: { label: "수정",   gives: [["crystal", 1]], hp: 2, tool: "pick", need: "pick", toolMul: 1, respawn: 420, r: 1.1 },
  grass:   { label: "풀",     gives: [["fiber", 1]], hp: 1, tool: null, toolMul: 1, respawn: 90, r: 0.9 },
};

export function makeTerrainFn(w) {
  const N = makeNoise(w.seed);
  const half = SIZE / 2;
  return function heightAt(x, z) {
    // 가장자리로 갈수록 낮아져서 섬 느낌 (떨어지지 않게 벽 대신 바다)
    const d = Math.max(Math.abs(x), Math.abs(z)) / half;
    const edge = d > 0.82 ? (d - 0.82) / 0.18 : 0;
    let h = N.fbm(x * 0.0045, z * 0.0045, 5, 2.05, 0.5) * w.amp;
    const ridge = 1 - Math.abs(N.n2(x * 0.0015 + 9, z * 0.0015 - 4));
    h += ridge * ridge * w.amp * 0.6;
    h += N.n2(x * 0.03, z * 0.03) * 0.6;
    h = h * (1 - edge * edge) - edge * edge * 30;
    return h;
  };
}

export class World {
  constructor(def) {
    this.def = def; this.heightAt = makeTerrainFn(def); this.group = new THREE.Group();
    this.props = []; this.byType = {}; this.placed = []; this.rnd = makeNoise(def.seed + 1).rnd;
    this._buildTerrain(); this._buildWater(); this._buildProps();
  }
  _buildTerrain() {
    const w = this.def, geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position, colors = new Float32Array(pos.count * 3);
    const cLow = new THREE.Color(w.low), cHigh = new THREE.Color(w.high), cCliff = new THREE.Color(w.cliff), cPeak = new THREE.Color(w.peak), cSand = new THREE.Color(w.sand), tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i), h = this.heightAt(x, z);
      pos.setY(i, h);
      const slope = Math.abs(this.heightAt(x + 2, z) - h) + Math.abs(this.heightAt(x, z + 2) - h);
      const t = THREE.MathUtils.clamp((h - 2) / (w.amp * 1.2), 0, 1);
      tmp.copy(cLow).lerp(cHigh, t);
      if (h > w.amp * 1.1) tmp.lerp(cPeak, THREE.MathUtils.clamp((h - w.amp * 1.1) / (w.amp * 0.5), 0, 1));
      if (slope > 2.2) tmp.lerp(cCliff, THREE.MathUtils.clamp((slope - 2.2) / 2, 0, 1));
      if (h < w.water + 1.5) tmp.lerp(cSand, THREE.MathUtils.clamp((w.water + 1.5 - h) / 1.5, 0, 1));
      colors[i * 3] = tmp.r; colors[i * 3 + 1] = tmp.g; colors[i * 3 + 2] = tmp.b;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
    this.terrain = new THREE.Mesh(geo, mat); this.terrain.receiveShadow = false; this.group.add(this.terrain);
  }
  _buildWater() {
    const w = this.def;
    const geo = new THREE.PlaneGeometry(SIZE * 1.6, SIZE * 1.6); geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({ color: w.id === 3 ? 0x6a3fb0 : 0x3f8fd0, transparent: true, opacity: 0.72, roughness: 0.2, metalness: 0.1 });
    this.water = new THREE.Mesh(geo, mat); this.water.position.y = w.water; this.group.add(this.water);
  }
  _buildProps() {
    const w = this.def, dens = w.props;
    const counts = { tree: Math.round(520 * dens.tree), rock: Math.round(260 * dens.rock), bush: Math.round(220 * dens.bush), ore: Math.round(90 * dens.ore), crystal: Math.round(60 * dens.crystal), grass: Math.round(600 * dens.grass) };
    const parts = this._propGeometries();
    Object.keys(counts).forEach(type => {
      const n = counts[type]; if (!n) return;
      const list = [];
      let tries = 0;
      while (list.length < n && tries++ < n * 6) {
        const x = (this.rnd() - 0.5) * SIZE * 0.8, z = (this.rnd() - 0.5) * SIZE * 0.8;
        const h = this.heightAt(x, z);
        if (h < w.water + 0.6) continue;
        const slope = Math.abs(this.heightAt(x + 1.5, z) - h) + Math.abs(this.heightAt(x, z + 1.5) - h);
        if (slope > 2.4 && type !== "rock" && type !== "ore" && type !== "crystal") continue;
        if (type === "crystal" && h < w.amp * 0.6 && this.rnd() < 0.7) continue;  // 수정은 높은 곳에
        if (Math.hypot(x, z) < 10) continue;  // 시작 지점 비움
        list.push({ type, x, y: h, z, rot: this.rnd() * Math.PI * 2, s: 0.75 + this.rnd() * 0.6, hp: PROP_INFO[type].hp, alive: true, dead: 0 });
      }
      const meshes = parts[type].map(p => {
        const m = new THREE.InstancedMesh(p.geo, p.mat, list.length);
        m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; this.group.add(m); return { mesh: m, off: p.off, scale: p.scale || 1 };
      });
      list.forEach((it, i) => { it.index = i; it.meshes = meshes; this.props.push(it); this._writeInstance(it, 1); });
      meshes.forEach(mm => { mm.mesh.instanceMatrix.needsUpdate = true; });
      this.byType[type] = list;
    });
  }
  _propGeometries() {
    const w = this.def;
    const g = {};
    const trunk = new THREE.CylinderGeometry(0.18, 0.28, 2.2, 6); trunk.translate(0, 1.1, 0);
    const canopy = w.id === 1 ? new THREE.CapsuleGeometry(0.35, 2.2, 4, 8) : w.id === 2 ? new THREE.ConeGeometry(1.4, 3.2, 7) : new THREE.IcosahedronGeometry(1.5, 1);
    canopy.translate(0, w.id === 1 ? 2.2 : w.id === 2 ? 3.3 : 3.0, 0);
    g.tree = [
      { geo: trunk, mat: new THREE.MeshStandardMaterial({ color: w.trunk, roughness: 1 }) },
      { geo: canopy, mat: new THREE.MeshStandardMaterial({ color: w.treeColor, roughness: 0.9, flatShading: true }) },
    ];
    const rock = new THREE.DodecahedronGeometry(1, 0); rock.translate(0, 0.5, 0);
    g.rock = [{ geo: rock, mat: new THREE.MeshStandardMaterial({ color: w.rockColor, roughness: 1, flatShading: true }) }];
    const bush = new THREE.IcosahedronGeometry(0.8, 1); bush.translate(0, 0.6, 0);
    const berries = new THREE.IcosahedronGeometry(0.95, 0); berries.translate(0, 0.65, 0);
    g.bush = [
      { geo: bush, mat: new THREE.MeshStandardMaterial({ color: 0x3e8a3f, roughness: 1, flatShading: true }) },
      { geo: berries, mat: new THREE.MeshStandardMaterial({ color: 0xe0334d, roughness: 0.6, wireframe: true }) },
    ];
    const ore = new THREE.DodecahedronGeometry(1.1, 0); ore.translate(0, 0.55, 0);
    g.ore = [
      { geo: ore, mat: new THREE.MeshStandardMaterial({ color: 0x4a4a52, roughness: 0.8, flatShading: true }) },
      { geo: new THREE.OctahedronGeometry(0.5, 0).translate(0.3, 1.0, 0.2), mat: new THREE.MeshStandardMaterial({ color: 0xd9a83a, metalness: 0.6, roughness: 0.3 }) },
    ];
    const cry = new THREE.OctahedronGeometry(0.7, 0); cry.scale(0.7, 1.8, 0.7); cry.translate(0, 1.1, 0);
    g.crystal = [{ geo: cry, mat: new THREE.MeshStandardMaterial({ color: 0x8be6ff, emissive: 0x2aa6c8, emissiveIntensity: 0.6, roughness: 0.2, transparent: true, opacity: 0.9 }) }];
    const grass = new THREE.ConeGeometry(0.35, 0.9, 4); grass.translate(0, 0.45, 0);
    g.grass = [{ geo: grass, mat: new THREE.MeshStandardMaterial({ color: w.id === 3 ? 0x9a6ad0 : 0x79b85a, roughness: 1, flatShading: true }) }];
    return g;
  }
  _writeInstance(it, scaleMul) {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), it.rot);
    const s = it.s * scaleMul;
    m.compose(new THREE.Vector3(it.x, it.y, it.z), q, new THREE.Vector3(s, s, s));
    it.meshes.forEach(mm => { mm.mesh.setMatrixAt(it.index, m); mm.mesh.instanceMatrix.needsUpdate = true; });
  }
  // 채집 대상: 가장 가까운 살아있는 소품
  nearest(x, z, maxDist) {
    let best = null, bd = maxDist * maxDist;
    for (const it of this.props) {
      if (!it.alive) continue;
      const dx = it.x - x, dz = it.z - z, d = dx * dx + dz * dz;
      if (d < bd) { bd = d; best = it; }
    }
    return best;
  }
  hit(it, dmg) {
    it.hp -= dmg;
    // 맞을 때 살짝 흔들림(크기 변화)
    this._writeInstance(it, 0.9);
    if (it.hp <= 0) { it.alive = false; it.dead = 0; this._writeInstance(it, 0.0001); return true; }
    return false;
  }
  tick(dt) {
    for (const it of this.props) {
      if (it.alive) { if (it.hp < PROP_INFO[it.type].hp) { /* 서서히 복구 */ } continue; }
      it.dead += dt;
      const rs = PROP_INFO[it.type].respawn;
      if (it.dead >= rs) { it.alive = true; it.hp = PROP_INFO[it.type].hp; this._writeInstance(it, 1); }
    }
  }
  // 다른 세계를 메모리에서 지우기
  dispose() {
    this.group.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose()); } });
  }
  // 설치물 (모닥불·오두막·포탈)
  place(kind, x, z, rotY) {
    const y = this.heightAt(x, z), g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rotY || 0;
    if (kind === "campfire") {
      for (let i = 0; i < 6; i++) { const s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.25, 0), new THREE.MeshStandardMaterial({ color: 0x777777 })); const a = i / 6 * Math.PI * 2; s.position.set(Math.cos(a) * 0.7, 0.15, Math.sin(a) * 0.7); g.add(s); }
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1, 5), new THREE.MeshStandardMaterial({ color: 0x5a3a1e })); log.rotation.z = Math.PI / 2; log.position.y = 0.2; g.add(log);
      const log2 = log.clone(); log2.rotation.y = Math.PI / 2; g.add(log2);
      const fire = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.9, 6), new THREE.MeshStandardMaterial({ color: 0xffa030, emissive: 0xff6a00, emissiveIntensity: 1.2 })); fire.position.y = 0.6; fire.name = "fire"; g.add(fire);
      const light = new THREE.PointLight(0xffa040, 1.5, 14, 1.5); light.position.y = 1.2; g.add(light);
    } else if (kind === "hut") {
      const wall = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.4, 2.4, 8), new THREE.MeshStandardMaterial({ color: 0xa47a4a, flatShading: true })); wall.position.y = 1.2; g.add(wall);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(3, 2, 8), new THREE.MeshStandardMaterial({ color: 0x6b4a2b, flatShading: true })); roof.position.y = 3.3; g.add(roof);
      const door = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.6, 0.2), new THREE.MeshStandardMaterial({ color: 0x3a2a1a })); door.position.set(0, 0.8, 2.3); g.add(door);
    } else if (kind === "portal") {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(2, 0.3, 10, 28), new THREE.MeshStandardMaterial({ color: 0x8a6fe0, emissive: 0x6a3fe0, emissiveIntensity: 0.8, metalness: 0.4, roughness: 0.3 })); ring.position.y = 2.4; g.add(ring);
      const disk = new THREE.Mesh(new THREE.CircleGeometry(1.8, 28), new THREE.MeshBasicMaterial({ color: 0xc9b6ff, transparent: true, opacity: 0.6, side: THREE.DoubleSide })); disk.position.y = 2.4; disk.name = "disk"; g.add(disk);
      for (let i = 0; i < 2; i++) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2.6, 0.5), new THREE.MeshStandardMaterial({ color: 0x3f3357 })); p.position.set(i ? 2.2 : -2.2, 1.3, 0); g.add(p); }
      const light = new THREE.PointLight(0x9a7fff, 2, 18, 1.5); light.position.y = 2.4; g.add(light);
    }
    this.group.add(g);
    const rec = { kind, x, z, rotY: rotY || 0, obj: g };
    this.placed.push(rec); return rec;
  }
}
