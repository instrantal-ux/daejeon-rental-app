// 새 버전 확인 — 릴리스 중 game-v 태그만 본다
import { REPO, TAG_PREFIX } from "./config.js";
function parse(v) { return String(v || "").replace(/^.*?v/i, "").split(".").map(n => parseInt(n, 10) || 0); }
export function newer(a, b) { const x = parse(a), y = parse(b); for (let i = 0; i < 3; i++) { if (x[i] > y[i]) return true; if (x[i] < y[i]) return false; } return false; }
export async function checkUpdate() {
  const cur = window.APP_VERSION || "0.0.0";
  const r = await fetch("https://api.github.com/repos/" + REPO + "/releases?per_page=30", { headers: { Accept: "application/vnd.github+json" }, cache: "no-store" });
  if (!r.ok) throw new Error("깃허브 응답 " + r.status);
  const rels = (await r.json()).filter(x => String(x.tag_name).startsWith(TAG_PREFIX) && !x.draft);
  if (!rels.length) return { current: cur, latest: cur, isNew: false };
  rels.sort((a, b) => newer(a.tag_name, b.tag_name) ? -1 : 1);
  const top = rels[0], apk = (top.assets || []).find(a => /\.apk$/i.test(a.name));
  return { current: cur, latest: top.tag_name.replace(TAG_PREFIX, ""), isNew: newer(top.tag_name, cur), url: apk ? apk.browser_download_url : top.html_url };
}
export async function openUrl(url) {
  const c = window.Capacitor; const br = c && c.isNativePlatform && c.isNativePlatform() && c.Plugins && c.Plugins.Browser;
  if (br) { try { await br.open({ url }); return; } catch (e) { /* */ } }
  window.open(url, "_blank", "noopener");
}
