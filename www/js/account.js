// 계정(로그인·동기화) 화면 + 홈 랭킹
import * as S from "./store.js";
import * as C from "./cloud.js";
import { $, el, msgAt, toast } from "./ui.js";
import { P } from "./period.js";
import { levelFor, titleFor } from "./game.js";

let status = { state: "idle", message: "" };
let rankCache = { at: 0, rows: [] };

function fmtTime(ms) { if (!ms) return "아직 없음"; const d = new Date(ms); return (d.getMonth() + 1) + "/" + d.getDate() + " " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); }

export function renderAccount() {
  const note = $("syncNote"), where = $("appWhere");
  const u = C.user(), sy = S.syncState();
  const dot = el("span", "syncdot " + (status.state === "busy" ? "busy" : status.state === "error" ? "bad" : u ? "on" : ""));
  if (note) { note.textContent = ""; note.appendChild(dot); note.appendChild(document.createTextNode(u ? (status.state === "busy" ? "동기화 중…" : status.state === "error" ? "오류" : "연결됨 · " + fmtTime(sy.lastSync)) : "로그인 안 함")); }
  if (where) where.textContent = u ? "이 기기 + 서버" : "이 기기 안";
  if (P.view !== "more") return;
  const box = $("acctBox"); box.textContent = ""; box.className = "morebox acct";
  if (!u) {
    box.appendChild(el("p", "note", "로그인하면 ① 폰·PC 어디서든 같은 장부 ② 앱 지워도 기록 보존 ③ 랭킹·친구 경쟁. 이메일 하나면 돼."));
    const em = document.createElement("input"); em.type = "email"; em.id = "acEmail"; em.placeholder = "이메일"; em.autocomplete = "username"; em.inputMode = "email";
    const pw = document.createElement("input"); pw.type = "password"; pw.id = "acPw"; pw.placeholder = "비밀번호 (6자 이상)"; pw.autocomplete = "current-password";
    box.appendChild(em); box.appendChild(pw);
    const btns = el("div", "btns");
    const login = el("button", "add", "로그인"); login.type = "button";
    const join = el("button", "ghost", "처음이야 (가입)"); join.type = "button";
    const forgot = el("button", "linkbtn", "비밀번호 잊음"); forgot.type = "button";
    btns.appendChild(login); btns.appendChild(join); btns.appendChild(forgot); box.appendChild(btns);
    const msg = el("p", "msg", ""); msg.id = "acMsg"; msg.hidden = true; box.appendChild(msg);
    const busy = on => { login.disabled = join.disabled = on; };
    login.addEventListener("click", async () => {
      if (!em.value.trim() || !pw.value) { msgAt("acMsg", "이메일과 비밀번호를 적어"); return; }
      busy(true); msgAt("acMsg", "로그인 중…", true);
      try { await C.signIn(em.value.trim(), pw.value); toast("로그인했어. 동기화 완료", "xp"); }
      catch (e) { msgAt("acMsg", e.message); }
      finally { busy(false); renderAccount(); }
    });
    join.addEventListener("click", async () => {
      if (!em.value.trim() || pw.value.length < 6) { msgAt("acMsg", "이메일과 6자 이상 비밀번호를 적어"); return; }
      busy(true); msgAt("acMsg", "가입 중…", true);
      try {
        const r = await C.signUp(em.value.trim(), pw.value);
        if (r.needConfirm) msgAt("acMsg", "가입됐어. 메일함(스팸함도)에서 확인 링크 누른 뒤 로그인해", true);
        else toast("가입하고 로그인했어. 이 기기 기록을 서버에 올렸어", "xp", 3200);
      } catch (e) { msgAt("acMsg", e.message); }
      finally { busy(false); renderAccount(); }
    });
    forgot.addEventListener("click", async () => {
      if (!em.value.trim()) { msgAt("acMsg", "이메일부터 적어"); return; }
      try { await C.resetPassword(em.value.trim()); msgAt("acMsg", "재설정 메일 보냈어 (스팸함도 확인)", true); } catch (e) { msgAt("acMsg", e.message); }
    });
    return;
  }
  const g = S.gameState() || {};
  const row = (k, v) => { const r = el("div", "trow"); r.appendChild(el("div", "k", k)); r.appendChild(el("div", "v", v)); box.appendChild(r); };
  row("계정", u.email);
  row("별명 (랭킹에 보임)", g.name || "사장님");
  row("마지막 동기화", fmtTime(sy.lastSync));
  const pend = Object.keys(sy.dirty || {}).length;
  row("아직 안 올린 변경", pend ? pend + "건" : "없음");
  if (status.state === "error") box.appendChild(el("p", "msg", "마지막 오류: " + status.message));
  const btns = el("div", "btns");
  const now = el("button", "add", "지금 동기화"); now.type = "button";
  now.addEventListener("click", async () => { now.disabled = true; try { const r = await C.sync(); toast("동기화 완료 · 받음 " + r.pulled + " 보냄 " + r.pushed); } catch (e) { toast("동기화 실패: " + e.message); } finally { now.disabled = false; renderAccount(); } });
  const out = el("button", "ghost", "로그아웃"); out.type = "button";
  out.addEventListener("click", async () => { if (!confirm("로그아웃할까? 이 기기 기록은 그대로 남아.")) return; await C.signOut(); renderAccount(); });
  btns.appendChild(now); btns.appendChild(out); box.appendChild(btns);
  box.appendChild(el("p", "fine", "장부는 본인 계정만 읽고 쓸 수 있게 서버 규칙이 걸려 있어. 랭킹에는 별명·레벨·경험치·연속일만 올라가."));
}

export async function renderRank(force) {
  if (P.view !== "home") return;
  const box = $("rank"), note = $("rankNote"); if (!box) return;
  const u = C.user();
  if (!C.isOnline()) { box.textContent = ""; box.appendChild(el("p", "note", "오프라인이라 랭킹을 못 불러와.")); return; }
  if (!force && Date.now() - rankCache.at < 60000 && rankCache.rows.length) { draw(rankCache.rows); return; }
  try {
    const rows = await C.leaderboard(30);
    rankCache = { at: Date.now(), rows }; draw(rows);
  } catch (e) {
    box.textContent = ""; box.appendChild(el("p", "note", "랭킹을 못 불러왔어: " + e.message));
  }
  function draw(rows) {
    box.textContent = "";
    note.textContent = rows.length + "명 참여" + (u ? "" : " · 로그인하면 나도 올라가");
    if (!rows.length) { box.appendChild(el("p", "note", u ? "아직 아무도 없어. 기록 한 줄 적으면 1등." : "로그인하고 첫 번째 사장님이 되어봐.")); return; }
    rows.forEach((r, i) => {
      const me = u && r.id === u.id, d = el("div", "rankrow" + (me ? " me" : ""));
      d.appendChild(el("span", "no" + (i < 3 ? " top" : ""), i < 3 ? ["🥇", "🥈", "🥉"][i] : String(i + 1)));
      const nm = el("div", "nm"); nm.appendChild(el("b", "", (r.nickname || "사장님") + (me ? " (나)" : "")));
      nm.appendChild(el("small", "", "Lv." + (r.level || levelFor(r.xp || 0)) + " " + titleFor(r.level || 1) + " · " + (r.streak || 0) + "일 연속 · 최고 " + (r.best || 0) + "일"));
      d.appendChild(nm); d.appendChild(el("span", "xp", (r.xp || 0).toLocaleString("ko-KR") + " xp")); box.appendChild(d);
    });
    if (!u) {
      const b = el("button", "ghost", "로그인하러 가기"); b.type = "button"; b.style.marginTop = "8px"; b.addEventListener("click", () => { location.hash = "#more"; }); box.appendChild(b);
    }
  }
}

export function initAccount() {
  C.onCloud(ev => {
    if (ev.type === "start") status = { state: "busy", message: "" };
    else if (ev.type === "done") { status = { state: "ok", message: "" }; rankCache.at = 0; }
    else if (ev.type === "error") status = { state: "error", message: ev.message };
    else if (ev.type === "logout") { status = { state: "idle", message: "" }; if (ev.reason === "expired") toast("로그인이 만료됐어. 더보기에서 다시 로그인"); }
    else if (ev.type === "login") { status = { state: "ok", message: "" }; C.startAuto(); }
    renderAccount(); if (ev.type === "done") renderRank(true);
  });
  if (C.user()) C.startAuto();
  window.addEventListener("online", () => C.sync({ quiet: true }));
}
