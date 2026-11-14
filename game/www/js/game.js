// 게임 본체 — 렌더링, 세계 전환, 채집·제작·설치, 포탈, 낮밤, 저장
import * as THREE from "three";
import { World, WORLDS, PROP_INFO, SIZE } from "./world.js";
import { Player } from "./player.js";
import { Input } from "./input.js";
import * as I from "./items.js";
import { HUD } from "./hud.js";
import * as C from "./cloud.js";
import { checkUpdate, openUrl } from "./update.js";
import { loadAssets, loadEnv } from "./assets.js";

const SAVE_KEY = "pw.save.v1";
const DAY_LEN = 360;             // 하루 길이(초)

function blankState(nick) {
  return { v: 1, nick: nick || "모험가", world: 0, unlocked: [0], inv: {}, tool: null, score: 0, day: 0.28,
    stats: { gathered: 0, crafted: 0, placed: 0, distance: 0 }, placed: { 0: [] }, pos: {}, updated: Date.now() };
}

export class Game {
  constructor(canvas, nick) {
    this.canvas = canvas;
    this.state = this.load() || blankState(nick);
    if (nick) this.state.nick = nick;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 900);
    this.camYaw = 0.6; this.camPitch = 0.42; this.camDist = 7.5;
    this.sun = new THREE.DirectionalLight(0xffffff, 2.2); this.scene.add(this.sun); this.scene.add(this.sun.target);
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(2048, 2048); this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.03;
    const sc = this.sun.shadow.camera; sc.left = sc.bottom = -45; sc.right = sc.top = 45; sc.near = 10; sc.far = 320;
    this.hemi = new THREE.HemisphereLight(0xbfdfff, 0x6b5a3a, 0.9); this.scene.add(this.hemi);
    this.player = new Player(); this.scene.add(this.player.group);
    this.input = new Input(document.body);
    this.hud = new HUD(this);
    this.clock = new THREE.Clock();
    this.target = null; this.prog = 0; this.lastSave = 0; this.lastCloud = 0; this.cloudSavedAt = 0; this.dayT = this.state.day;
    this.portalCool = 0; this.lastPos = new THREE.Vector3();
    this.elapsed = 0;
    this.ready = loadAssets(this.renderer).catch(() => null).then(() => { this.loadWorld(this.state.world, true); this.player.setTool(this.state.tool); });
    window.addEventListener("resize", () => this.resize()); this.resize();
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") { this.save(); this.cloudSave(false).catch(() => {}); } });
    this._raf = this._raf || (() => {});
  }
  resize() { const w = window.innerWidth, h = window.innerHeight; this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }

  // ---- 세계 ----
  loadWorld(id, first) {
    if (this.world) { this.scene.remove(this.world.group); this.world.dispose(); }
    const def = WORLDS[id]; this.world = new World(def); this.scene.add(this.world.group);
    this.scene.background = new THREE.Color(def.sky); this.scene.fog = new THREE.Fog(def.sky, def.fogNear, def.fogFar);
    this.env = null; this.scene.environment = null;
    loadEnv(def.hdri).then(env => { if (this.world.def !== def || !env) return; this.env = env; this.scene.environment = env.env; this.scene.background = env.sky; });
    this.state.world = id; if (!this.state.placed[id]) this.state.placed[id] = [];
    this.state.placed[id].forEach(p => this.world.place(p.kind, p.x, p.z, p.rotY));
    const p = this.state.pos[id];
    let x = 0, z = 6; if (p) { x = p.x; z = p.z; }
    else { // 물 밖 시작점 찾기
      for (let r = 0; r < 60 && this.world.heightAt(x, z) < def.water + 1; r += 4) { x = r; z = 6 + r * 0.5; }
    }
    this.player.pos.set(x, this.world.heightAt(x, z) + 0.2, z); this.player.vel.set(0, 0, 0); this.lastPos.copy(this.player.pos);
    this.hud.setWorld(def.name);
    if (!first) this.hud.toast("🌍 " + def.name + "에 도착했어", true);
    this.hud.hint(id === 0 ? "나무·바위·덤불 옆에서 [행동]을 꾹 눌러 채집 · 🎒에서 제작" : "이 세계는 광석·수정이 많아. 곡괭이 챙겼지?");
  }

  // ---- 아이템 ----
  equip(tool) { this.state.tool = tool; this.player.setTool(tool); if (tool) this.hud.toast(I.ITEMS[tool].icon + " " + I.ITEMS[tool].name + " 장착"); }
  gain(k, n) { I.add(this.state.inv, k, n); }
  addScore(n, why) { this.state.score += n; const L0 = I.levelFor(this.state.score - n), L1 = I.levelFor(this.state.score); if (L1 > L0) { this.hud.toast("⭐ 레벨 " + L1 + " 달성!", true); this.player.speed = 7.5 + Math.min(3, (L1 - 1) * 0.25); } void why; }
  craft(r) {
    if (!I.craft(this.state.inv, r)) { this.hud.toast("재료가 모자라"); return; }
    this.state.stats.crafted++; this.addScore(r.out === "portal" ? 150 : r.out === "hut" ? 60 : r.out === "shard" ? 40 : 15);
    this.hud.toast(I.ITEMS[r.out].icon + " " + I.ITEMS[r.out].name + " 완성!", true);
    if (I.ITEMS[r.out].tool && !this.state.tool) this.equip(r.out);
    this.save();
  }
  placeItem(kind) {
    if (!I.has(this.state.inv, kind)) return;
    const p = this.player.pos, f = 2.6, x = p.x + Math.sin(this.player.yaw) * f, z = p.z + Math.cos(this.player.yaw) * f;
    if (this.world.heightAt(x, z) < this.world.def.water + 0.3) { this.hud.toast("물 위에는 못 지어"); return; }
    if (this.world.placed.some(q => Math.hypot(q.x - x, q.z - z) < 4)) { this.hud.toast("너무 가까워. 조금 떨어져서"); return; }
    I.add(this.state.inv, kind, -1); if (this.state.inv[kind] <= 0) delete this.state.inv[kind];
    const rec = { kind, x, z, rotY: this.player.yaw + Math.PI };
    this.world.place(kind, x, z, rec.rotY); this.state.placed[this.state.world].push(rec);
    this.state.stats.placed++;
    this.addScore(kind === "portal" ? 500 : kind === "hut" ? 200 : 50);
    this.hud.toast(I.ITEMS[kind].icon + " " + I.ITEMS[kind].name + " 설치!" + (kind === "portal" ? " 들어가면 다음 세계로" : ""), true);
    this.hud.togglePanel(null); this.save();
  }

  // ---- 채집 ----
  gatherTick(dt, inp) {
    const p = this.player.pos, t = this.world.nearest(p.x, p.z, 3.4);
    if (t !== this.target) { this.target = t; this.prog = 0; }
    this.player.gathering = false;
    if (!t) return null;
    const info = PROP_INFO[t.type], tool = this.state.tool;
    const needTool = info.need && tool !== info.need;
    const label = info.label + (needTool ? " — " + I.ITEMS[info.need].name + " 필요" : (tool && tool === info.tool) ? " (" + I.ITEMS[tool].name + ")" : "");
    if (inp.actHeld && !needTool && !this.hud.open) {
      this.player.gathering = true;
      const rate = ((tool && tool === info.tool) ? info.toolMul : 1) * 1.6;
      this.prog += dt * rate;
      if (this.prog >= 1) {
        this.prog = 0;
        const dead = this.world.hit(t, 1);
        if (dead) {
          let txt = [];
          info.gives.forEach(([k, n]) => { const q = n + (Math.random() < 0.3 ? 1 : 0); this.gain(k, q); txt.push(I.ITEMS[k].icon + "+" + q); });
          this.state.stats.gathered++; this.addScore(t.type === "crystal" ? 25 : t.type === "ore" ? 12 : 5);
          this.hud.toast(txt.join("  "), true);
          this.target = null;
        }
      }
    } else if (inp.act && needTool) this.hud.toast(I.ITEMS[info.need].name + "이(가) 있어야 캘 수 있어. 제작 탭에서 만들어");
    return { text: "[행동] 꾹: " + label, hp: t.hp };
  }

  // ---- 포탈 ----
  portalTick(dt) {
    this.portalCool = Math.max(0, this.portalCool - dt);
    const p = this.player.pos;
    for (const q of this.world.placed) {
      if (q.kind === "portal") { const disk = q.obj.getObjectByName("disk"); if (disk) disk.rotation.z += dt * 1.5; const ring = q.obj.children[0]; if (ring) ring.rotation.y += dt * 0.6; }
      if (q.kind === "campfire") { const f = q.obj.getObjectByName("fire"); if (f) f.scale.setScalar(0.9 + Math.sin(performance.now() * 0.012) * 0.12); }
      if (q.kind === "portal" && this.portalCool <= 0 && Math.hypot(q.x - p.x, q.z - p.z) < 1.6) { this.enterPortal(); return; }
    }
  }
  enterPortal() {
    const cur = this.state.world, next = (cur + 1) % WORLDS.length;
    this.portalCool = 6;
    const fade = document.getElementById("fade"); fade.classList.add("on");
    this.state.pos[cur] = { x: this.player.pos.x + Math.sin(this.player.yaw) * -3, z: this.player.pos.z + Math.cos(this.player.yaw) * -3 };
    setTimeout(() => {
      if (this.state.unlocked.indexOf(next) < 0) { this.state.unlocked.push(next); this.addScore(300); this.hud.toast("🌀 새 세계 개방! +300", true); }
      this.loadWorld(next, false);
      // 도착 세계에 귀환 포탈이 없으면 하나 놓아준다 (왕복 가능)
      if (!this.world.placed.some(q => q.kind === "portal")) { const x = this.player.pos.x, z = this.player.pos.z - 4; this.world.place("portal", x, z, 0); this.state.placed[next].push({ kind: "portal", x, z, rotY: 0 }); }
      this.save(); this.cloudSave(false).catch(() => {});
      setTimeout(() => fade.classList.remove("on"), 300);
    }, 650);
  }

  // ---- 낮밤 ----
  dayTick(dt) {
    this.dayT = (this.dayT + dt / DAY_LEN) % 1; this.state.day = this.dayT;
    const a = this.dayT * Math.PI * 2;                  // 0 = 자정
    const sunH = -Math.cos(a);                          // -1 자정 … 1 정오
    const day = THREE.MathUtils.clamp((sunH + 0.15) / 0.5, 0, 1);
    this.sun.position.set(Math.sin(a) * 100, sunH * 100 + 20, 40).add(this.player.pos); this.sun.target.position.copy(this.player.pos);
    this.sun.intensity = 0.15 + day * 2.1; this.sun.color.setHSL(0.09, 0.6, 0.55 + day * 0.45);
    this.hemi.intensity = 0.25 + day * 0.75;
    const sky = new THREE.Color(this.world.def.sky), night = new THREE.Color(0x0a0e22), dusk = new THREE.Color(0xff8a5a);
    const c = night.clone().lerp(sky, day); if (day > 0.05 && day < 0.6) c.lerp(dusk, (0.6 - Math.abs(day - 0.3) * 2) * 0.5);
    if (this.env) { this.scene.backgroundIntensity = 0.12 + day * 0.88; this.scene.environmentIntensity = 0.25 + day * 0.75; this.scene.backgroundBlurriness = 0.02; }
    else this.scene.background = c;
    this.scene.fog.color.copy(c);
    this.scene.fog.near = this.world.def.fogNear * (0.6 + day * 0.4); this.scene.fog.far = this.world.def.fogFar * (0.55 + day * 0.45);
  }

  // ---- 카메라 ----
  cameraTick(dt, inp) {
    this.camYaw -= inp.yawDelta; this.camPitch = THREE.MathUtils.clamp(this.camPitch + inp.pitchDelta, 0.08, 1.2);
    const p = this.player.pos, tgt = new THREE.Vector3(p.x, p.y + 1.7, p.z);
    const off = new THREE.Vector3(Math.sin(this.camYaw) * Math.cos(this.camPitch), Math.sin(this.camPitch), Math.cos(this.camYaw) * Math.cos(this.camPitch)).multiplyScalar(this.camDist);
    const want = tgt.clone().add(off);
    const floor = this.world.heightAt(want.x, want.z) + 0.7; if (want.y < floor) want.y = floor;
    this.camera.position.lerp(want, Math.min(1, dt * 9)); this.camera.lookAt(tgt);
  }

  // ---- 루프 ----
  async start() { await this.ready; this.running = true; this.clock.start(); const loop = () => { if (!this.running) return; this.frame(); requestAnimationFrame(loop); }; requestAnimationFrame(loop); }
  frame() {
    const dt = Math.min(0.05, this.clock.getDelta());
    const inp = this.input.poll();
    if (this.hud.open) { inp.mx = inp.mz = 0; inp.jump = false; }
    this.player.update(dt, { mx: inp.mx, mz: inp.mz, jump: inp.jump, sprint: inp.sprint }, this.camYaw, this.world.heightAt, this.world.def.water);
    const moved = this.player.pos.distanceTo(this.lastPos); if (moved < 3) this.state.stats.distance += moved; this.lastPos.copy(this.player.pos);
    const tg = this.gatherTick(dt, inp);
    this.elapsed += dt; this.world.tick(dt, this.elapsed); this.portalTick(dt); this.dayTick(dt); this.cameraTick(dt, inp);
    this.hud.update(this.state, tg, this.prog);
    this.renderer.render(this.scene, this.camera);
    const now = performance.now();
    if (now - this.lastSave > 8000) { this.lastSave = now; this.save(); }
    if (now - this.lastCloud > 60000 && C.user()) { this.lastCloud = now; this.cloudSave(false).catch(() => {}); }
  }

  // ---- 저장 ----
  save() { this.state.updated = Date.now(); this.state.pos[this.state.world] = { x: this.player.pos.x, z: this.player.pos.z }; try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.state)); } catch (e) { /* */ } }
  load() { try { const s = JSON.parse(localStorage.getItem(SAVE_KEY) || "null"); return s && s.v === 1 ? s : null; } catch (e) { return null; } }
  async cloudSave(force) {
    if (!C.user()) return;
    this.save();
    await C.pushSave(this.state);
    await C.pushPlayer({ nickname: this.state.nick, level: I.levelFor(this.state.score), score: this.state.score, worlds: this.state.unlocked.length, distance: Math.round(this.state.stats.distance) });
    this.cloudSavedAt = Date.now(); void force;
  }
  async afterLogin() {
    try {
      const remote = await C.loadSave();
      if (remote && remote.data && remote.data.v === 1 && (remote.data.score || 0) > (this.state.score || 0)) {
        if (confirm("서버에 더 진행된 기록이 있어 (점수 " + remote.data.score + "). 그걸로 이어서 할까?\n취소하면 지금 기기 기록을 서버에 올려.")) {
          this.state = remote.data; this.loadWorld(this.state.world, true); this.player.setTool(this.state.tool); this.save();
        }
      }
      await this.cloudSave(true);
      this.hud.toast("로그인 완료 · 서버 저장 켜짐", true);
    } catch (e) { this.hud.toast("서버 연결 실패: " + e.message); }
  }
  async checkUpdate(manual) {
    try {
      const r = await checkUpdate();
      const bar = document.getElementById("updateBar"); bar.textContent = "";
      if (r.isNew) {
        bar.hidden = false; bar.appendChild(document.createTextNode("새 버전 " + r.latest + " 나왔어 "));
        const b = document.createElement("button"); b.textContent = "받아서 설치"; b.addEventListener("click", () => openUrl(r.url)); bar.appendChild(b);
        const x = document.createElement("button"); x.textContent = "✕"; x.addEventListener("click", () => { bar.hidden = true; }); bar.appendChild(x);
      } else if (manual) this.hud.toast("지금이 최신 버전이야 (" + r.current + ")");
    } catch (e) { if (manual) this.hud.toast("확인 못 했어: " + e.message); }
  }
}
export { SIZE };
