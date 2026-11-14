// 플레이어 캐릭터 — 여전사 (원본 디자인, 기본 도형 + 금속 재질) + 이동·점프·애니메이션
// 나중에 외부 .glb 캐릭터로 교체할 수 있도록 loadExternal() 훅 제공.
import * as THREE from "three";

function faceTexture() {
  const c = document.createElement("canvas"); c.width = 256; c.height = 256;
  const g = c.getContext("2d");
  g.fillStyle = "#f3d3b8"; g.fillRect(0, 0, 256, 256);
  g.translate(128, 0); g.scale(0.42, 1); g.translate(-128, 0);          // 구에 감기니까 가로로 모아 그린다
  const eye = (x) => {
    g.fillStyle = "#fff"; g.beginPath(); g.ellipse(x, 128, 20, 24, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#2f8f6a"; g.beginPath(); g.ellipse(x, 131, 13, 19, 0, 0, Math.PI * 2); g.fill();     // 에메랄드 눈
    g.fillStyle = "#101418"; g.beginPath(); g.ellipse(x, 134, 8, 13, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#fff"; g.beginPath(); g.ellipse(x - 5, 122, 4, 6, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = "#2a1a1a"; g.lineWidth = 5; g.beginPath(); g.moveTo(x - 22, 106); g.quadraticCurveTo(x, 94, x + 22, 102); g.stroke(); // 날카로운 눈썹
    g.strokeStyle = "#1a1012"; g.lineWidth = 4; g.beginPath(); g.moveTo(x - 20, 112); g.quadraticCurveTo(x, 100, x + 20, 112); g.stroke(); // 아이라인
  };
  eye(92); eye(164);
  g.fillStyle = "rgba(220,90,110,.35)"; g.beginPath(); g.ellipse(72, 168, 15, 8, 0, 0, Math.PI * 2); g.fill(); g.beginPath(); g.ellipse(184, 168, 15, 8, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#b8384e"; g.beginPath(); g.moveTo(112, 182); g.quadraticCurveTo(128, 176, 144, 182); g.quadraticCurveTo(128, 194, 112, 182); g.fill();
  // 전사 페인트(얼굴 옆 줄)
  g.strokeStyle = "rgba(120,30,40,.6)"; g.lineWidth = 6; g.beginPath(); g.moveTo(40, 120); g.lineTo(56, 160); g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class Player {
  constructor() {
    this.group = new THREE.Group();
    this.pos = this.group.position;
    this.vel = new THREE.Vector3();
    this.yaw = 0; this.onGround = true; this.speed = 7.5; this.runT = 0; this.swimming = false;
    this.height = 1.8; this.tool = null;
    this._build();
    this.group.scale.setScalar(0.9);
  }
  _build() {
    const skin = new THREE.MeshStandardMaterial({ color: 0xf3d3b8, roughness: 0.6 });
    const hairM = new THREE.MeshStandardMaterial({ color: 0xb2232a, roughness: 0.45, metalness: 0.05 });          // 붉은 장발
    const steel = new THREE.MeshStandardMaterial({ color: 0xc9ccd2, metalness: 0.9, roughness: 0.28 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x2a2328, roughness: 0.7, metalness: 0.2 });               // 가죽
    const gold = new THREE.MeshStandardMaterial({ color: 0xd9a441, metalness: 0.95, roughness: 0.3 });
    const capeM = new THREE.MeshStandardMaterial({ color: 0x7a1026, roughness: 0.9, side: THREE.DoubleSide });
    const g = this.group;
    // 다리: 허벅지(피부) + 금속 그리브 부츠
    this.legL = this._limb(0.14, 0.86, skin, steel, -0.16, 0.86); this.legR = this._limb(0.14, 0.86, skin, steel, 0.16, 0.86);
    [this.legL, this.legR].forEach(l => { const knee = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), gold); knee.position.y = -0.45; l.add(knee); });
    g.add(this.legL, this.legR);
    // 몸통
    const torso = new THREE.Group(); torso.position.y = 0.86; this.torso = torso;
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.33, 0.3, 12, 1, true), dark); skirt.position.y = 0.12; torso.add(skirt);      // 가죽 전투 스커트
    const hip = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.23, 0.26, 12), dark); hip.position.y = 0.2; torso.add(hip);
    const belt = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.035, 8, 20), gold); belt.position.y = 0.34; belt.rotation.x = Math.PI / 2; torso.add(belt);
    const waist = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 0.3, 12), skin); waist.position.y = 0.5; torso.add(waist);              // 잘록한 허리(노출)
    const chest = new THREE.Mesh(new THREE.CapsuleGeometry(0.25, 0.2, 6, 14), steel); chest.position.y = 0.8; chest.scale.set(1, 1, 0.85); torso.add(chest); // 흉갑
    const bustL = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 10), steel); bustL.position.set(-0.12, 0.84, -0.17); torso.add(bustL);
    const bustR = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 10), steel); bustR.position.set(0.12, 0.84, -0.17); torso.add(bustR);
    const trim = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.03, 8, 20), gold); trim.position.y = 1.0; trim.rotation.x = Math.PI / 2; torso.add(trim);
    // 어깨 갑옷
    [-1, 1].forEach(s => { const p = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), steel); p.position.set(s * 0.33, 1.02, 0); p.rotation.z = -s * 0.35; torso.add(p);
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.16, 8), gold); spike.position.set(s * 0.42, 1.14, 0); spike.rotation.z = -s * 0.6; torso.add(spike); });
    // 팔: 위팔 피부, 아래팔 건틀릿
    this.armL = this._limb(0.09, 0.66, skin, steel, -0.36, 0.95); this.armR = this._limb(0.09, 0.66, skin, steel, 0.36, 0.95);
    torso.add(this.armL, this.armR);
    // 망토
    this.cape = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 1.25, 4, 8), capeM);
    this.cape.position.set(0, 1.0, 0.27); this.cape.rotation.x = 0.22; this.cape.geometry.translate(0, -0.6, 0); torso.add(this.cape);
    // 머리
    const head = new THREE.Group(); head.position.y = 1.24; this.head = head;
    const face = new THREE.Mesh(new THREE.SphereGeometry(0.26, 22, 16), new THREE.MeshStandardMaterial({ map: faceTexture(), roughness: 0.6 }));
    face.rotation.y = Math.PI / 2; head.add(face);                               // 텍스처 중앙(눈·입)이 -Z(앞)를 보게
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.29, 22, 16, 0, Math.PI * 2, 0, Math.PI * 0.42), hairM); hair.position.y = 0.03; head.add(hair);   // 정수리
    const back = new THREE.Mesh(new THREE.SphereGeometry(0.3, 22, 16, 0, Math.PI, Math.PI * 0.3, Math.PI * 0.5), hairM); back.position.y = 0.0; back.scale.set(1, 1.25, 1.05); head.add(back);   // 뒷머리(+Z)
    const bang = new THREE.Mesh(new THREE.SphereGeometry(0.295, 16, 8, Math.PI * 1.05, Math.PI * 0.9, Math.PI * 0.2, Math.PI * 0.17), hairM); bang.position.set(0, 0.03, 0); head.add(bang);   // 앞머리(-Z, 눈 위까지)
    this.tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.8, 6, 10), hairM); this.tail.position.set(0, -0.3, 0.22); this.tail.rotation.x = 0.25; head.add(this.tail);   // 긴 장발
    const sideL = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.4, 4, 8), hairM); sideL.position.set(-0.25, -0.12, -0.02); head.add(sideL);
    const sideR = sideL.clone(); sideR.position.x = 0.25; head.add(sideR);
    const circlet = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.02, 8, 24), gold); circlet.position.y = 0.08; circlet.rotation.x = Math.PI / 2; head.add(circlet);
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.04, 0), new THREE.MeshStandardMaterial({ color: 0x3ad6c8, emissive: 0x1a8f88, emissiveIntensity: 0.8 })); gem.position.set(0, 0.08, -0.27); head.add(gem);
    torso.add(head);
    g.add(torso);
    // 손 도구 자리 (오른손)
    this.hand = new THREE.Group(); this.hand.position.set(0.02, -0.64, 0); this.armR.add(this.hand);
    // 등의 검 (기본 무기, 도구 미장착 시 보임)
    this.sword = this._sword(steel, gold, dark); this.sword.position.set(0.12, 0.95, 0.22); this.sword.rotation.set(0.15, 0, -0.95); torso.add(this.sword);
    // 그림자 원판
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.55, 16), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25 }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.03; this.shadow = shadow; g.add(shadow);
    this.toolMeshes = this._buildTools();
    g.traverse(o => { if (o.isMesh && o !== shadow) o.castShadow = true; });
  }
  _sword(steel, gold, dark) {
    const s = new THREE.Group();
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.1, 0.018), steel); blade.position.y = 0.6; s.add(blade);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 4), steel); tip.position.y = 1.22; tip.rotation.y = Math.PI / 4; s.add(tip);
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.06), gold); guard.position.y = 0.04; s.add(guard);
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.26, 8), dark); grip.position.y = -0.12; s.add(grip);
    const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), gold); pommel.position.y = -0.27; s.add(pommel);
    return s;
  }
  _limb(r, len, matUpper, matLower, x, y) {
    const piv = new THREE.Group(); piv.position.set(x, y, 0);
    const up = new THREE.Mesh(new THREE.CapsuleGeometry(r, len * 0.46, 4, 10), matUpper); up.position.y = -len * 0.27; piv.add(up);
    const lo = new THREE.Mesh(new THREE.CapsuleGeometry(r * 1.02, len * 0.42, 4, 10), matLower); lo.position.y = -len * 0.74; piv.add(lo);
    return piv;
  }
  _buildTools() {
    const stick = () => new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.7, 6), new THREE.MeshStandardMaterial({ color: 0x5a3a22 }));
    const metal = new THREE.MeshStandardMaterial({ color: 0xb8bec6, metalness: 0.85, roughness: 0.3 });
    const axe = new THREE.Group(); const s1 = stick(); s1.position.y = 0.1; axe.add(s1);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.18, 0.04), metal); blade.position.set(0.1, 0.4, 0); axe.add(blade);
    const pick = new THREE.Group(); const s2 = stick(); s2.position.y = 0.1; pick.add(s2);
    const headp = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.07, 0.07), metal); headp.position.y = 0.42; pick.add(headp);
    const torch = new THREE.Group(); const s3 = stick(); s3.position.y = 0.1; torch.add(s3);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.25, 6), new THREE.MeshStandardMaterial({ color: 0xffb040, emissive: 0xff7000, emissiveIntensity: 1.5 })); flame.position.y = 0.55; torch.add(flame);
    const light = new THREE.PointLight(0xffa040, 1.2, 10, 1.6); light.position.y = 0.6; torch.add(light);
    const all = { axe, pick, torch };
    Object.values(all).forEach(t => { t.visible = false; t.rotation.z = -0.4; this.hand.add(t); });
    return all;
  }
  setTool(name) { this.tool = name; Object.keys(this.toolMeshes).forEach(k => { this.toolMeshes[k].visible = k === name; }); if (this.sword) this.sword.visible = true; }

  // 외부 리깅 모델(.glb)로 교체하는 훅. url 로드 성공 시 기본 도형 몸체를 숨기고 모델을 붙인다.
  async loadExternal(url) {
    try {
      const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
      const gltf = await new GLTFLoader().loadAsync(url);
      const m = gltf.scene; m.traverse(o => { if (o.isMesh) o.castShadow = true; });
      this.torso.visible = this.legL.visible = this.legR.visible = false;
      this.group.add(m); this.external = m;
      if (gltf.animations && gltf.animations.length) { this.mixer = new THREE.AnimationMixer(m); this.mixer.clipAction(gltf.animations[0]).play(); }
      return true;
    } catch (e) { console.warn("외부 캐릭터 로드 실패", e); return false; }
  }

  // dt 초, input: {mx, mz (카메라 기준 -1..1), jump}, camYaw, heightAt, waterLevel
  update(dt, input, camYaw, heightAt, waterLevel) {
    const moving = Math.abs(input.mx) > 0.05 || Math.abs(input.mz) > 0.05;
    const ground = heightAt(this.pos.x, this.pos.z);
    this.swimming = ground < waterLevel - 0.6;
    const spd = this.speed * (this.swimming ? 0.45 : 1) * (input.sprint ? 1.5 : 1);
    if (moving) {
      const sin = Math.sin(camYaw), cos = Math.cos(camYaw);
      const dx = (input.mx * cos - input.mz * sin), dz = (input.mx * sin + input.mz * cos);
      const len = Math.hypot(dx, dz) || 1;
      const k = Math.min(1, len);
      this.vel.x = dx / len * spd * k; this.vel.z = dz / len * spd * k;
      const target = Math.atan2(dx, dz);
      let diff = target - this.yaw; while (diff > Math.PI) diff -= Math.PI * 2; while (diff < -Math.PI) diff += Math.PI * 2;
      this.yaw += diff * Math.min(1, dt * 12);
    } else { this.vel.x *= Math.max(0, 1 - dt * 10); this.vel.z *= Math.max(0, 1 - dt * 10); }
    const nx = this.pos.x + this.vel.x * dt, nz = this.pos.z + this.vel.z * dt;
    const nh = heightAt(nx, nz);
    if (nh - ground > 1.6 * dt * 10 && !this.swimming) { this.vel.x *= 0.2; this.vel.z *= 0.2; }
    else { this.pos.x = nx; this.pos.z = nz; }
    const floor = Math.max(heightAt(this.pos.x, this.pos.z), this.swimming ? waterLevel - 0.9 : -Infinity);
    if (input.jump && this.onGround) { this.vel.y = this.swimming ? 5 : 8.5; this.onGround = false; }
    this.vel.y -= (this.swimming ? 12 : 26) * dt;
    this.pos.y += this.vel.y * dt;
    if (this.pos.y <= floor) { this.pos.y = floor; this.vel.y = 0; this.onGround = true; } else if (this.pos.y > floor + 0.05) this.onGround = false;
    this.group.rotation.y = this.yaw + Math.PI;
    // 애니메이션
    const sp = Math.hypot(this.vel.x, this.vel.z);
    this.runT += dt * (2 + sp * 1.6);
    const sw = Math.min(1, sp / this.speed) * (this.swimming ? 0.5 : 1);
    const a = Math.sin(this.runT) * 0.9 * sw;
    if (this.mixer) this.mixer.update(dt);
    this.legL.rotation.x = a; this.legR.rotation.x = -a; this.armL.rotation.x = -a * 0.8; this.armR.rotation.x = a * 0.8;
    if (this.gathering) { this.armR.rotation.x = -1.2 + Math.sin(this.runT * 3) * 0.9; }
    this.torso.position.y = 0.86 + Math.abs(Math.sin(this.runT)) * 0.06 * sw + (sw < 0.1 ? Math.sin(this.runT * 0.5) * 0.015 : 0);
    this.torso.rotation.x = sw * 0.12;
    this.tail.rotation.x = 0.25 + Math.sin(this.runT * 1.1) * 0.22 * (0.3 + sw);
    this.cape.rotation.x = 0.18 + sw * 0.55 + Math.sin(this.runT * 1.3) * 0.08 * (0.3 + sw);
    this.shadow.position.y = (floor - this.pos.y) + 0.03;
    this.shadow.scale.setScalar(Math.max(0.5, 1 - (this.pos.y - floor) * 0.15));
    this.shadow.visible = !this.swimming;
  }
}
