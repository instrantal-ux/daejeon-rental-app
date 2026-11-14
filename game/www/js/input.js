// 터치 입력: 왼쪽 화면 = 가상 조이스틱, 오른쪽 화면 = 카메라 회전, 버튼 = 점프·행동. PC 는 WASD·마우스.
export class Input {
  constructor(root) {
    this.root = root;
    this.mx = 0; this.mz = 0; this.jump = false; this.act = false; this.actHeld = false; this.sprint = false;
    this.yawDelta = 0; this.pitchDelta = 0;
    this.joy = null; this.cam = null;
    this.keys = {};
    this._bind();
  }
  _bind() {
    const r = this.root;
    const stick = document.getElementById("joy"), knob = document.getElementById("joyKnob");
    const isUI = t => !!(t.closest && t.closest(".hud-btn, .panel, .topbar, .modal"));
    r.addEventListener("touchstart", e => {
      for (const t of e.changedTouches) {
        if (isUI(t.target)) continue;
        if (t.clientX < window.innerWidth * 0.45 && !this.joy) {
          this.joy = { id: t.identifier, ox: t.clientX, oy: t.clientY };
          stick.style.left = (t.clientX - 60) + "px"; stick.style.top = (t.clientY - 60) + "px"; stick.classList.add("on");
        } else if (!this.cam) this.cam = { id: t.identifier, x: t.clientX, y: t.clientY };
      }
      if (!isUI(e.target)) e.preventDefault();
    }, { passive: false });
    r.addEventListener("touchmove", e => {
      for (const t of e.changedTouches) {
        if (this.joy && t.identifier === this.joy.id) {
          let dx = t.clientX - this.joy.ox, dy = t.clientY - this.joy.oy; const len = Math.hypot(dx, dy), max = 55;
          if (len > max) { dx *= max / len; dy *= max / len; }
          knob.style.transform = `translate(${dx}px, ${dy}px)`;
          this.mx = dx / max; this.mz = dy / max; this.sprint = len > max * 0.98;
        } else if (this.cam && t.identifier === this.cam.id) {
          this.yawDelta += (t.clientX - this.cam.x) * 0.0045; this.pitchDelta += (t.clientY - this.cam.y) * 0.003;
          this.cam.x = t.clientX; this.cam.y = t.clientY;
        }
      }
      if (this.joy || this.cam) e.preventDefault();
    }, { passive: false });
    const end = e => {
      for (const t of e.changedTouches) {
        if (this.joy && t.identifier === this.joy.id) { this.joy = null; this.mx = this.mz = 0; this.sprint = false; knob.style.transform = ""; stick.classList.remove("on"); }
        if (this.cam && t.identifier === this.cam.id) this.cam = null;
      }
    };
    r.addEventListener("touchend", end); r.addEventListener("touchcancel", end);
    // 버튼
    const hold = (id, on, off) => { const b = document.getElementById(id); if (!b) return;
      const d = e => { e.preventDefault(); on(); }, u = e => { e.preventDefault(); off && off(); };
      b.addEventListener("touchstart", d, { passive: false }); b.addEventListener("touchend", u); b.addEventListener("touchcancel", u);
      b.addEventListener("mousedown", d); b.addEventListener("mouseup", u); b.addEventListener("mouseleave", () => off && off()); };
    hold("btnJump", () => { this.jump = true; }, () => {});
    hold("btnAct", () => { this.act = true; this.actHeld = true; }, () => { this.actHeld = false; });
    // 키보드 (PC)
    window.addEventListener("keydown", e => { this.keys[e.code] = true; if (e.code === "Space") this.jump = true; if (e.code === "KeyE") { this.act = true; this.actHeld = true; } if (e.code === "ShiftLeft") this.sprint = true; });
    window.addEventListener("keyup", e => { this.keys[e.code] = false; if (e.code === "KeyE") this.actHeld = false; if (e.code === "ShiftLeft") this.sprint = false; });
    // 마우스 드래그로 카메라
    let md = null;
    r.addEventListener("mousedown", e => { if (isUI(e.target)) return; md = { x: e.clientX, y: e.clientY }; });
    window.addEventListener("mousemove", e => { if (!md) return; this.yawDelta += (e.clientX - md.x) * 0.004; this.pitchDelta += (e.clientY - md.y) * 0.003; md = { x: e.clientX, y: e.clientY }; });
    window.addEventListener("mouseup", () => { md = null; });
  }
  poll() {
    let mx = this.mx, mz = this.mz;
    if (!this.joy) {
      const k = this.keys; mx = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0); mz = (k.KeyS || k.ArrowDown ? 1 : 0) - (k.KeyW || k.ArrowUp ? 1 : 0);
      if (!mx && !mz) { mx = this.mx; mz = this.mz; }
    }
    const out = { mx, mz, jump: this.jump, act: this.act, actHeld: this.actHeld, sprint: this.sprint, yawDelta: this.yawDelta, pitchDelta: this.pitchDelta };
    this.jump = false; this.act = false; this.yawDelta = 0; this.pitchDelta = 0;
    return out;
  }
}
