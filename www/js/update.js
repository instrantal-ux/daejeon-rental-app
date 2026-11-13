// 새 버전 확인 — 깃허브 릴리스에서 최신 태그를 읽어 지금 버전과 비교
import { $, el, nativePlugin, isNative } from "./ui.js";

export const REPO = "instrantal-ux/daejeon-rental-app";
const API = "https://api.github.com/repos/" + REPO + "/releases/latest";

function parseVer(v) { return String(v || "").replace(/^v/i, "").split(".").map(n => parseInt(n, 10) || 0); }
export function newer(a, b) { // a > b ?
  const x = parseVer(a), y = parseVer(b);
  for (let i = 0; i < 3; i++) { if ((x[i] || 0) > (y[i] || 0)) return true; if ((x[i] || 0) < (y[i] || 0)) return false; }
  return false;
}

export async function checkUpdate(opts) {
  opts = opts || {};
  const cur = window.APP_VERSION || "0.0.0";
  const res = await fetch(API, { headers: { Accept: "application/vnd.github+json" }, cache: "no-store" });
  if (!res.ok) throw new Error("깃허브 응답 " + res.status);
  const rel = await res.json();
  const tag = String(rel.tag_name || "");
  const apk = (rel.assets || []).find(a => /\.apk$/i.test(a.name));
  const info = { current: cur, latest: tag.replace(/^v/, ""), isNew: newer(tag, cur), apkUrl: apk ? apk.browser_download_url : rel.html_url, notes: String(rel.body || "").slice(0, 400), page: rel.html_url };
  if (info.isNew) showBar(info); else if (opts.manual) hideBar();
  return info;
}
function showBar(info) {
  const bar = $("updateBar"); bar.textContent = ""; bar.hidden = false;
  const txt = el("span", ""); txt.appendChild(el("b", "", "새 버전 " + info.latest)); txt.appendChild(document.createTextNode(" 나왔어 (지금 " + info.current + ")"));
  bar.appendChild(txt);
  const b = el("button", "add", isNative() ? "받아서 설치" : "열기"); b.type = "button";
  b.addEventListener("click", () => openUrl(info.apkUrl));
  bar.appendChild(b);
  const x = el("button", "x", "✕"); x.type = "button"; x.setAttribute("aria-label", "닫기"); x.addEventListener("click", hideBar); bar.appendChild(x);
}
function hideBar() { const bar = $("updateBar"); bar.hidden = true; bar.textContent = ""; }
export async function openUrl(url) {
  const br = nativePlugin("Browser");
  if (br) { try { await br.open({ url }); return; } catch (e) { /* 아래로 */ } }
  window.open(url, "_blank", "noopener");
}
