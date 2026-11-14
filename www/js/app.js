// 앱 시작점 — 화면 전환, 상단 기간 조절, 저장소 변경 → 다시 그리기
import * as S from "./store.js";
import { $, el, toast, nativePlugin } from "./ui.js";
import { P, onPeriod, setRange, applyPreset, shiftPeriod, rangeLabel } from "./period.js";
import { monthsBetween } from "./data.js";
import { initLedger, renderLedger, onLedgerShown, getBookFilt } from "./ledger.js";
import { initTax, renderTax, loadPayEdit } from "./tax.js";
import { initCalendar, renderCalendar } from "./calendar.js";
import { initHome, renderHome, reward } from "./home.js";
import { initMore, renderMore } from "./exportx.js";
import { checkUpdate } from "./update.js";
import * as C from "./cloud.js";
import { initAccount, renderAccount, renderRank } from "./account.js";
import { BOOK_LABEL } from "./data.js";
import { loadNative } from "./native.js";

await loadNative();
S.init();

// 안드로이드에서는 저장할 때마다 앱 전용 폴더에도 사본을 남긴다 (앱 데이터가 꼬였을 때 복구용)
S.setPersistHook(json => {
  const fs = nativePlugin("Filesystem");
  if (!fs) return;
  fs.writeFile({ path: "ledger-autosave.json", data: json, directory: "DATA", encoding: "utf8" }).catch(() => {});
});

function onAction(action, ctx) { reward(action, ctx); C.syncSoon(); }

initLedger({ onAction, loadPayEdit });
initTax({ onAction });
initCalendar();
initHome({});
initMore({ onAction, onRestore: () => { renderAll(); C.syncSoon(); } });
initAccount();

// ---- 상단 ----
function periodLabel() {
  const h = $("periodLabel");
  if (P.view === "all") { h.textContent = rangeLabel(); h.appendChild(el("small", "", getBookFilt() === "all" ? "종합" : BOOK_LABEL[getBookFilt()])); }
  else if (P.view === "calendar") { h.textContent = parseInt(P.month.slice(0, 4), 10) + "년 " + parseInt(P.month.slice(5, 7), 10) + "월"; h.appendChild(el("small", "", "날짜별 기록")); }
  else if (P.view === "tax") { h.textContent = P.year + "년 세무"; h.appendChild(el("small", "", "예상치")); }
  else if (P.view === "more") h.textContent = "더보기";
  else h.textContent = "석재 가계부";
  const showNav = P.view === "all" || P.view === "calendar" || P.view === "tax";
  $("prevP").hidden = !showNav; $("nextP").hidden = !showNav;
  $("presets").hidden = P.view !== "all";
  $("rangeForm").hidden = P.view !== "all" || P.range.preset !== "custom";
  Array.prototype.forEach.call($("presets").querySelectorAll("button"), b => { b.className = b.getAttribute("data-p") === P.range.preset ? "on" : ""; });
  $("rangeS").value = P.range.s; $("rangeE").value = P.range.e;
}
$("prevP").addEventListener("click", () => shiftPeriod(-1));
$("nextP").addEventListener("click", () => shiftPeriod(1));
Array.prototype.forEach.call($("presets").querySelectorAll("button"), b => b.addEventListener("click", () => { applyPreset(b.getAttribute("data-p")); if (b.getAttribute("data-p") === "custom") $("rangeS").focus(); }));
$("rangeForm").addEventListener("submit", e => {
  e.preventDefault();
  const s = $("rangeS").value, en = $("rangeE").value;
  if (!/^\d{4}-\d{2}$/.test(s) || !/^\d{4}-\d{2}$/.test(en)) { const m = $("rangeMsg"); m.textContent = "시작 월과 끝 월을 둘 다 골라"; m.hidden = false; return; }
  if (monthsBetween(s < en ? s : en, s < en ? en : s).length > 24) { const m = $("rangeMsg"); m.textContent = "한 번에 24개월까지만 볼 수 있어서 끝 월 기준으로 잘랐어"; m.hidden = false; }
  setRange(s, en, "custom");
});

// ---- 화면 전환 ----
const VIEWS = { home: "viewHome", all: "viewLedger", calendar: "viewCal", tax: "viewTax", more: "viewMore" };
const TABS = { home: "tabHome", all: "tabAll", calendar: "tabCal", tax: "tabTax", more: "tabMore" };
function applyHash() {
  const h = location.hash.replace("#", "") || "home";
  const prev = P.view;
  P.view = VIEWS[h] ? h : "home";
  Object.keys(VIEWS).forEach(k => { $(VIEWS[k]).hidden = k !== P.view; $(TABS[k]).className = k === P.view ? "on" : ""; });
  if (P.view === "all") onLedgerShown();
  renderAll();
  if (prev !== P.view) window.scrollTo(0, 0);
}
function renderAll() {
  periodLabel();
  renderHome(); renderLedger(); renderCalendar(); renderTax(); renderMore(); renderAccount();
  if (P.view === "home") renderRank(false);
}
window.addEventListener("hashchange", applyHash);
onPeriod(renderAll);
S.subscribe(what => { renderAll(); if (what === "entries" || what === "payouts" || what === "settings") C.syncSoon(); });
applyHash();

// ---- 안드로이드 뒤로가기: 홈이 아니면 홈으로, 홈이면 종료 ----
(function () {
  const app = nativePlugin("App");
  if (!app || !app.addListener) return;
  app.addListener("backButton", () => {
    const lu = $("levelup"); if (!lu.hidden) { lu.hidden = true; return; }
    if (P.view !== "home") location.hash = "#home"; else if (app.exitApp) app.exitApp();
  });
  app.addListener("resume", () => { S.flush(); C.sync({ quiet: true }); setTimeout(() => checkUpdate().catch(() => {}), 1500); });
  app.addListener("pause", () => S.flush());
})();
window.addEventListener("pagehide", () => S.flush());
window.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") S.flush(); });

// ---- 새 버전 확인 · 켤 때 동기화 ----
setTimeout(() => checkUpdate().catch(() => {}), 2500);
setTimeout(() => C.sync({ quiet: true }), 800);
$("checkUpdBtn").addEventListener("click", async () => {
  const m = $("uMsg"); m.hidden = false; m.className = "msg ok"; m.textContent = "확인 중…";
  try {
    const r = await checkUpdate({ manual: true });
    m.textContent = r.isNew ? "새 버전 " + r.latest + " 있음 — 위 안내줄에서 받아" : "지금이 최신 버전이야 (" + r.current + ")";
  } catch (e) { m.className = "msg"; m.textContent = "확인 못 했어: " + (e && e.message ? e.message : e); }
});

// 첫 실행 안내
if (S.rawState().meta && S.rawState().meta.seeded && !S.gameState()) {
  setTimeout(() => toast("옛 가계부 기록 " + S.counts().entries + "건을 옮겨왔어", "", 3200), 600);
}
