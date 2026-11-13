// 작은 화면 도우미
export const $ = id => document.getElementById(id);
export function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
export function msgAt(id, text, ok) {
  const m = $(id); if (!m) return;
  m.textContent = text; m.className = "msg" + (ok ? " ok" : ""); m.hidden = !text;
  clearTimeout(m._t); if (text) m._t = setTimeout(() => { m.hidden = true; }, 3500);
}
export function setState(id, text, bad) { const s = $(id); if (!s) return; s.textContent = text; s.className = "state" + (bad ? " bad" : ""); s.hidden = !text; }
export function toast(text, cls, ms) {
  const box = $("toasts"); if (!box) return;
  const t = el("div", "toast" + (cls ? " " + cls : ""), text);
  box.appendChild(t);
  setTimeout(() => { t.style.opacity = "0"; t.style.transition = "opacity .3s"; setTimeout(() => t.remove(), 320); }, ms || 2200);
}
export function fmtAmtInput(input) {
  const nf = new Intl.NumberFormat("ko-KR");
  input.addEventListener("input", e => { const d = e.target.value.replace(/[^0-9]/g, "").slice(0, 12); e.target.value = d ? nf.format(parseInt(d, 10)) : ""; });
}
export function onAll(nodeList, ev, fn) { Array.prototype.forEach.call(nodeList, n => n.addEventListener(ev, () => fn(n))); }

// 네이티브(안드로이드) 플러그인 — 앱 안에서만 존재. 웹에서는 null
export function isNative() { const c = window.Capacitor; return !!(c && c.isNativePlatform && c.isNativePlatform()); }
export function nativePlugin(name) {
  if (!isNative()) return null;
  const c = window.Capacitor;
  if (c.Plugins && c.Plugins[name]) return c.Plugins[name];
  if (typeof c.registerPlugin === "function") { try { return c.registerPlugin(name); } catch (e) { return null; } }
  return null;
}
