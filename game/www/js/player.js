// 플레이어 캐릭터 — 기본 도형으로 만든 여성 모험가 (원본 디자인) + 이동·점프·애니메이션
import * as THREE from "three";

function faceTexture() {
  const c = document.createElement("canvas"); c.width = 256; c.height = 256;
  const g = c.getContext("2d");
  g.fillStyle = "#f7dcc4"; g.fillRect(0, 0, 256, 256);
  // 눈 (크고 또렷한 애니풍)
  const eye = (x) => {
    g.fillStyle = "#fff"; g.beginPath(); g.ellipse(x, 128, 22, 28, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#4a2d8f"; g.beginPath(); g.ellipse(x, 132, 15, 22, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#1a1030"; g.beginPath(); g.ellipse(x, 136, 9, 15, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#fff"; g.beginPath(); g.ellipse(x - 5, 122, 5, 7, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = "#2a1a1a"; g.lineWidth = 5; g.beginPath(); g.moveTo(x - 24, 104); g.quadraticCurveTo(x, 92, x + 24, 104); g.stroke();
  };
  eye(92); eye(164);
  // 볼 홍조 · 입
  g.fillStyle = "rgba(255,120,140,.45)"; g.beginPath(); g.ellipse(70, 170, 16, 9, 0, 0, Math.PI * 2); g.fill(); g.beginPath(); g.ellipse(186, 170, 16, 9, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = "#c9506a"; g.lineWidth = 4; g.beginPath(); g.moveTo(114, 182); g.quadraticCurveTo(128, 194, 142, 182); g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class Player {
  constructor() {
    this.group = new THREE.Group();
    this.pos = this.group.position;
    this.vel = new THREE.Vector3();
    this.yaw = 0; this.onGround = true; this.speed = 7.5; this.runT = 0; this.swimming = false;
    this.height = 1.75; this.tool = null;
    this._build();
    this.group.scale.setScalar(0.85);
  }
  _build() {
    const skin = new THREE.MeshStandardMaterial({ color: 0xf7dcc4, roughness: 0.7 });
    const hairM = new THREE.MeshStandardMaterial({ color: 0x6b3fb5, roughness: 0.5 });     // 보라빛 머리
    const topM = new THREE.MeshStandardMaterial({ color: 0xe8e4f2, roughness: 0.8 });
    const jacketM = new THREE.MeshStandardMaterial({ color: 0x2b2f6e, roughness: 0.7 });
    const shortsM = new THREE.MeshStandardMaterial({ color: 0x33364a, roughness: 0.9 });
    const bootM = new THREE.MeshStandardMaterial({ color: 0x3a2a1e, roughness: 0.9 });
    const g = this.group;
    // 다리
    this.legL = this._limb(0.13, 0.78, skin, bootM, -0.17, 0.78); this.legR = this._limb(0.13, 0.78, skin, bootM, 0.17, 0.78);
    g.add(this.legL, this.legR);
    // 몸통 (잘록한 허리 → 가슴)
    const torso = new THREE.Group(); torso.position.y = 0.78; this.torso = torso;
    const hip = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.22, 0.32, 10), shortsM); hip.position.y = 0.16; torso.add(hip);
    const waist = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.24, 0.28, 10), topM); waist.position.y = 0.46; torso.add(waist);
    const chest = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.22, 4, 10), jacketM); chest.position.y = 0.76; torso.add(chest);
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.05, 8, 14), topM); collar.position.y = 0.97; collar.rotation.x = Math.PI / 2; torso.add(collar);
    // 팔
    this.armL = this._limb(0.09, 0.62, skin, skin, -0.34, 0.95, jacketM); this.armR = this._limb(0.09, 0.62, skin, skin, 0.34, 0.95, jacketM);
    torso.add(this.armL, this.armR);
    // 머리
    const head = new THREE.Group(); head.position.y = 1.2; this.head = head;
    const face = new THREE.Mesh(new THREE.SphereGeometry(0.27, 20, 16), new THREE.MeshStandardMaterial({ map: faceTexture(), roughness: 0.7 }));
    face.rotation.y = Math.PI; head.add(face);                                  // 텍스처 정면이 -Z 를 보게
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.3, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.62), hairM); hair.position.y = 0.03; head.add(hair);
    const bang = new THREE.Mesh(new THREE.SphereGeometry(0.29, 14, 8, Math.PI * 0.15, Math.PI * 0.7, Math.PI * 0.35, Math.PI * 0.3), hairM); bang.rotation.y = Math.PI; bang.position.set(0, 0.02, -0.02); head.add(bang);
    this.tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.55, 4, 8), hairM); this.tail.position.set(0, -0.05, 0.3); this.tail.rotation.x = 0.5; head.add(this.tail);
    const ribbon = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.03, 6, 10), new THREE.MeshStandardMaterial({ color: 0xff5a8a })); ribbon.position.set(0, 0.12, 0.26); head.add(ribbon);
    torso.add(head);
    g.add(torso);
    // 손에 든 도구 자리
    this.hand = new THREE.Group(); this.hand.position.set(0.02, -0.6, 0); this.armR.add(this.hand);
    // 그림자 원판
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.55, 16), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28 }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.03; this.shadow = shadow; g.add(shadow);
    this.toolMeshes = this._buildTools();
  }
  _limb(r, len, matUpper, matLower, x, y, matSleeve) {
    const piv = new THREE.Group(); piv.position.set(x, y, 0);
    const up = new THREE.Mesh(new THREE.CapsuleGeometry(r, len * 0.5, 4, 8), matSleeve || matUpper); up.position.y = -len * 0.28; piv.add(up);
    const lo = new THREE.Mesh(new THREE.CapsuleGeometry(r * 0.9, len * 0.45, 4, 8), matLower); lo.position.y = -len * 0.75; piv.add(lo);
    return piv;
  }
  _buildTools() {
    const stick = () => new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.7, 6), new THREE.MeshStandardMaterial({ color: 0x7a5230 }));
    const axe = new THREE.Group(); const s1 = stick(); s1.position.y = 0.1; axe.add(s1);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.05), new THREE.MeshStandardMaterial({ color: 0xa8b0b8, metalness: 0.7, roughness: 0.3 })); blade.position.set(0.1, 0.4, 0); axe.add(blade);
    const pick = new THREE.Group(); const s2 = stick(); s2.position.y = 0.1; pick.add(s2);
    const headp = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.07, 0.07), new THREE.MeshStandardMaterial({ color: 0x8a9098, metalness: 0.7, roughness: 0.3 })); headp.position.y = 0.42; pick.add(headp);
    const torch = new THREE.Group(); const s3 = stick(); s3.position.y = 0.1; torch.add(s3);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.25, 6), new THREE.MeshStandardMaterial({ color: 0xffb040, emissive: 0xff7000, emissiveIntensity: 1.5 })); flame.position.y = 0.55; torch.add(flame);
    const light = new THREE.PointLight(0xffa040, 1.2, 10, 1.6); light.position.y = 0.6; torch.add(light);
    const all = { axe, pick, torch };
    Object.values(all).forEach(t => { t.visible = false; t.rotation.z = -0.4; this.hand.add(t); });
    return all;
  }
  setTool(name) { this.tool = name; Object.keys(this.toolMeshes).forEach(k => { this.toolMeshes[k].visible = k === name; }); }

  // dt 초, input: {mx, mz (카메라 기준 -1..1), jump}, camYaw, heightAt, waterLevel
  update(dt, input, camYaw, heightAt, waterLevel) {
    const moving = Math.abs(input.mx) > 0.05 || Math.abs(input.mz) > 0.05;
    const ground = heightAt(this.pos.x, this.pos.z);
    this.swimming = ground < waterLevel - 0.6;
    const spd = this.speed * (this.swimming ? 0.45 : 1) * (input.sprint ? 1.5 : 1);
    if (moving) {
      // 카메라가 보는 방향 기준으로 이동
      const sin = Math.sin(camYaw), cos = Math.cos(camYaw);
      const dx = (input.mx * cos - input.mz * sin), dz = (input.mx * sin + input.mz * cos);
      const len = Math.hypot(dx, dz) || 1;
      const k = Math.min(1, len);
      this.vel.x = dx / len * spd * k; this.vel.z = dz / len * spd * k;
      const target = Math.atan2(dx, dz);
      let diff = target - this.yaw; while (diff > Math.PI) diff -= Math.PI * 2; while (diff < -Math.PI) diff += Math.PI * 2;
      this.yaw += diff * Math.min(1, dt * 12);
    } else { this.vel.x *= Math.max(0, 1 - dt * 10); this.vel.z *= Math.max(0, 1 - dt * 10); }
    // 경사 제한: 너무 가파르면 미끄러짐
    const nx = this.pos.x + this.vel.x * dt, nz = this.pos.z + this.vel.z * dt;
    const nh = heightAt(nx, nz);
    if (nh - ground > 1.6 * dt * 10 && !this.swimming) { this.vel.x *= 0.2; this.vel.z *= 0.2; }
    else { this.pos.x = nx; this.pos.z = nz; }
    // 중력·점프
    const floor = Math.max(heightAt(this.pos.x, this.pos.z), this.swimming ? waterLevel - 0.9 : -Infinity);
    if (input.jump && this.onGround) { this.vel.y = this.swimming ? 5 : 8.5; this.onGround = false; }
    this.vel.y -= (this.swimming ? 12 : 26) * dt;
    this.pos.y += this.vel.y * dt;
    if (this.pos.y <= floor) { this.pos.y = floor; this.vel.y = 0; this.onGround = true; } else if (this.pos.y > floor + 0.05) this.onGround = false;
    this.group.rotation.y = this.yaw;
    // 애니메이션
    const sp = Math.hypot(this.vel.x, this.vel.z);
    this.runT += dt * (2 + sp * 1.6);
    const sw = Math.min(1, sp / this.speed) * (this.swimming ? 0.5 : 1);
    const a = Math.sin(this.runT) * 0.9 * sw;
    this.legL.rotation.x = a; this.legR.rotation.x = -a; this.armL.rotation.x = -a * 0.8; this.armR.rotation.x = a * 0.8;
    if (this.gathering) { this.armR.rotation.x = -1.2 + Math.sin(this.runT * 3) * 0.9; }
    this.torso.position.y = 0.78 + Math.abs(Math.sin(this.runT)) * 0.06 * sw + (sw < 0.1 ? Math.sin(this.runT * 0.5) * 0.015 : 0);
    this.torso.rotation.x = sw * 0.12;
    this.tail.rotation.x = 0.5 + Math.sin(this.runT * 1.1) * 0.25 * (0.3 + sw);
    this.shadow.position.y = (floor - this.pos.y) + 0.03;
    this.shadow.scale.setScalar(Math.max(0.5, 1 - (this.pos.y - floor) * 0.15));
    this.shadow.visible = !this.swimming;
  }
}
