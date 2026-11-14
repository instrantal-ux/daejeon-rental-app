// 시작점 — 제목 화면 → 게임
import { Game } from "./game.js";

async function loadNative() {
  const c = window.Capacitor; if (!(c && c.isNativePlatform && c.isNativePlatform())) return;
  const r = await Promise.allSettled([import("@capacitor/app"), import("@capacitor/browser")]);
  r.forEach(x => { if (x.status === "rejected") console.warn("플러그인 로드 실패", x.reason && x.reason.message); });
}
await loadNative();

const title = document.getElementById("title"), nickIn = document.getElementById("nickInput"), info = document.getElementById("titleInfo");
let saved = null; try { saved = JSON.parse(localStorage.getItem("pw.save.v1") || "null"); } catch (e) { saved = null; }
if (saved) { nickIn.value = saved.nick || ""; info.textContent = "이어하기: 점수 " + (saved.score || 0).toLocaleString("ko-KR") + " · 세계 " + ((saved.unlocked || [0]).length) + "개 개방"; }
else info.textContent = "첫 모험. 이름을 정하고 시작해.";

let game = null;
function begin() {
  const nick = (nickIn.value.trim() || "모험가").slice(0, 12);
  title.hidden = true; document.getElementById("hud").hidden = false;
  game = new Game(document.getElementById("gl"), nick);
  window.__game = game;
  game.start();
  setTimeout(() => game.checkUpdate(false), 2500);
  // 안드로이드 뒤로가기: 패널 열려 있으면 닫기
  const app = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
  if (app && app.addListener) {
    app.addListener("backButton", () => { if (game.hud.open) game.hud.togglePanel(null); else if (confirm("게임을 종료할까? (진행은 저장돼)")) { game.save(); app.exitApp && app.exitApp(); } });
    app.addListener("pause", () => { game.save(); game.cloudSave(false).catch(() => {}); });
  }
}
document.getElementById("startBtn").addEventListener("click", begin);
nickIn.addEventListener("keydown", e => { if (e.key === "Enter") begin(); });
