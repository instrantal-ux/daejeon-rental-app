// 홈 화면 — 캐릭터·레벨·퀘스트·이번 달 요약
import * as D from "./data.js";
import * as S from "./store.js";
import * as G from "./game.js";
import { $, el, toast } from "./ui.js";
import { P } from "./period.js";

const { won, signed, today, addDays, dday, WD } = D;
let game = null;

export function getGame() { if (!game) game = G.normGame(S.gameState()); return game; }
function save() { S.saveGame(game); }

const LINES = {
  happy: ["오늘도 장부가 살아 있다. 사장님 멋져.", "기록 한 줄이 5월의 세금을 줄인다.", "이 기세면 다음 레벨 금방이야.", "오늘 할 일 끝. 기타 치러 가자."],
  normal: ["오늘 아직 한 줄도 안 적었어. 하나만 적자.", "영수증 받은 거 있지? 지금 넣어.", "연속 기록 끊기면 아까워. 한 건만.", "렌탈 나간 거 있으면 바로 적어."],
  sleepy: ["…장부가 조용하다. 깨워줘.", "며칠 쉬었네. 밀린 거 정리하면 보너스 있어.", "오늘부터 다시 1일. 한 줄만 적자."],
};
function pick(arr, seed) { return arr[seed % arr.length]; }

export function renderHome() {
  if (P.view !== "home") return;
  const g = getGame(), td = today();
  const pr = G.progress(g.xp), streak = G.streakOf(g.days, td), tc = G.todayCount(g, td);
  const mood = tc > 0 ? "happy" : streak >= 1 ? "normal" : "sleepy";
  $("charBox").innerHTML = G.characterSVG(pr.level, mood);
  $("hName").textContent = g.name || "석재";
  $("hTitle").textContent = G.titleFor(pr.level);
  $("hLevel").textContent = pr.level;
  $("hXpText").textContent = pr.have + " / " + pr.need + " xp";
  $("hXpFill").style.width = Math.round(pr.pct * 100) + "%";
  $("hStreak").textContent = streak; $("hBest").textContent = g.best; $("hToday").textContent = tc;
  const seed = parseInt(td.replace(/-/g, ""), 10) + g.xp;
  $("speech").textContent = pick(LINES[mood], seed);

  // 퀘스트
  $("questDate").textContent = (+td.slice(5, 7)) + "월 " + (+td.slice(8, 10)) + "일";
  const qb = $("quests"); qb.textContent = "";
  G.QUESTS.forEach(q => {
    const done = tc >= q.need, r = el("div", "quest" + (done ? " done" : ""));
    const k = el("div", "", q.label); k.appendChild(el("small", "", "+" + q.xp + " xp"));
    r.appendChild(k); r.appendChild(el("span", "q", done ? "달성 ✓" : Math.min(tc, q.need) + " / " + q.need));
    const bar = el("div", "qbar"); const i = el("i"); i.style.width = Math.min(100, tc / q.need * 100) + "%"; bar.appendChild(i); r.appendChild(bar);
    qb.appendChild(r);
  });
  const streakQ = el("div", "quest" + (streak >= 2 ? " done" : ""));
  const sk = el("div", "", "연속 기록 이어가기"); sk.appendChild(el("small", "", "하루에 한 건이면 돼 · 연속일 × 5 xp (최대 35)"));
  streakQ.appendChild(sk); streakQ.appendChild(el("span", "q", streak + "일째")); qb.appendChild(streakQ);

  // 이번 달
  const m = td.slice(0, 7);
  $("homeMonthLbl").textContent = (+m.slice(5, 7)) + "월 · 다섯 장부 합계";
  let i = 0, o = 0;
  S.entriesIn([m]).forEach(x => { if (x.t === "in") i += x.amt; else o += x.amt; });
  S.paysIn([m]).forEach(p => { o += p.gross; });
  $("homeIn").textContent = won(i); $("homeOut").textContent = won(o);
  $("homeLeft").textContent = signed(i - o); $("homeLeft").className = "num" + (i - o < 0 ? " minus" : "");

  // 곧 나갈 고정비
  const fb = $("homeFixed"); fb.textContent = "";
  const lim = addDays(td, 14);
  const ups = S.fixedEntries().filter(x => x.t === "out" && x.d >= td && x.d <= lim).sort((a, b) => a.d < b.d ? -1 : 1);
  if (!ups.length) fb.appendChild(el("p", "note", "2주 안에 잡힌 고정비가 없어."));
  ups.slice(0, 8).forEach(x => {
    const r = el("div", "todo"), n = dday(new Date(+x.d.slice(0, 4), +x.d.slice(5, 7) - 1, +x.d.slice(8, 10)));
    r.appendChild(el("span", "dd" + (n <= 3 ? " soon" : ""), D.ddayText(n)));
    const k = el("div", "", (x.memo || x.cat) + " · " + won(x.amt));
    k.appendChild(el("small", "", (+x.d.slice(5, 7)) + "월 " + (+x.d.slice(8, 10)) + "일 (" + WD[new Date(x.d).getDay()] + ") · " + D.BOOK_LABEL[D.bookOf(x)]));
    r.appendChild(k); fb.appendChild(r);
  });

  // 경험치 로그
  const lg = $("xpLog"); lg.textContent = "";
  if (!g.log.length) lg.appendChild(el("p", "note", "아직 없어. 장부에 한 줄 적으면 경험치가 들어와."));
  g.log.slice(0, 12).forEach(x => {
    const r = el("div", "xplog"), d = new Date(x.t);
    r.appendChild(el("span", "t", (d.getMonth() + 1) + "/" + d.getDate() + " " + D.pad(d.getHours()) + ":" + D.pad(d.getMinutes())));
    r.appendChild(el("span", "", x.why)); r.appendChild(el("span", "g", "+" + x.xp)); lg.appendChild(r);
  });
}

// 행동 → 경험치 지급 + 연출
export function reward(action, ctx) {
  const g = getGame();
  const r = G.award(g, action, ctx);
  game = r.g; save();
  if (r.gained) {
    toast("+" + r.gained + " xp  " + r.lines.map(l => l.why).join(" · "), "xp", 2600);
    const cb = $("charBox"); if (cb) { cb.classList.remove("bounce"); void cb.offsetWidth; cb.classList.add("bounce"); }
  }
  if (r.levelUp) showLevelUp(r.levelUp);
  renderHome();
  return r;
}
function showLevelUp(L) {
  const box = $("levelup"); box.textContent = ""; box.hidden = false;
  const card = el("div", "card");
  card.innerHTML = G.characterSVG(L, "happy");
  card.appendChild(el("h2", "", "레벨 " + L + " 달성!"));
  card.appendChild(el("div", "ttl", G.titleFor(L)));
  const extra = L === 3 ? "모자를 얻었어." : L === 5 ? "선글라스를 얻었어." : L === 8 ? "목도리를 얻었어." : L === 10 ? "왕관을 얻었어!" : "계속 이렇게만.";
  card.appendChild(el("p", "note", extra));
  const ok = el("button", "add", "좋아"); ok.type = "button"; ok.addEventListener("click", () => { box.hidden = true; });
  card.appendChild(ok); box.appendChild(card);
  box.addEventListener("click", e => { if (e.target === box) box.hidden = true; }, { once: true });
}

export function initHome(h) {
  $("renameBtn").addEventListener("click", () => {
    const g = getGame(); const nm = prompt("캐릭터 이름", g.name || "석재");
    if (nm && nm.trim()) { game.name = nm.trim().slice(0, 12); save(); renderHome(); import("./cloud.js").then(C => C.pushProfile().catch(() => {})); }
  });
  $("homeGoLedger").addEventListener("click", () => { location.hash = "#all"; setTimeout(() => { const a = $("amt"); if (a) { a.scrollIntoView({ behavior: "smooth", block: "center" }); a.focus(); } }, 120); });
  $("homeGoTax").addEventListener("click", () => { location.hash = "#tax"; });
  void h;
}
