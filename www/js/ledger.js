// 장부 화면 — 입력, 목록, 장부별·부문별 집계, 고정비 묶음 수정/삭제
import * as D from "./data.js";
import * as S from "./store.js";
import { $, el, msgAt, setState, fmtAmtInput } from "./ui.js";
import { P, rangeMonths, rangeLabel, setRange } from "./period.js";

const { won, signed, today, num, nf, WD, CATS, PLACES, SEGS_BY, BK_NAME, BOOKS, BOOK_LABEL, SEG_LABEL, PROOFS, KINDS, PROOF_LABEL, KIND_LABEL,
  bookOf, segFor, kindFor, ymLabel, shiftDay, addMonths } = D;

// 입력 상태
let t = "out", biz = false, place = "", bk = "rental", cat = CATS.out_p[0], proof = "card", kind = "taxable", seg = "common";
let book = "rental", bookFilt = "all", segFilt = "all";
let editId = null, editTs = 0, editOrig = null, confirmId = null, confirmSeries = null;
let hooks = { onAction: () => {} };

export function getBookFilt() { return bookFilt; }
export function setBookFilt(b) { bookFilt = b; segFilt = "all"; if (editId) endEdit(); applyBook(b === "all" ? book : b); }

function SEGS() { return SEGS_BY[bk] || SEGS_BY.rental; }
function catList() { return CATS[t + (place === "ojeong" ? "_s" : place === "sunhwa" ? "_w" : biz ? (t === "in" && bk === "other" ? "_o" : "_b") : "_p")]; }

function buildChips() {
  const box = $("chips"); box.textContent = "";
  catList().forEach(c => {
    const b = el("button", c === cat ? "on" : "", c); b.type = "button";
    b.addEventListener("click", () => { cat = c; if (t === "in" && biz) { kind = kindFor(c); $("wh").checked = c === "레슨비(학원)"; seg = place ? PLACES[place].seg : segFor(c); } buildChips(); buildSub(); });
    box.appendChild(b);
  });
}
function applyBook(b) {
  book = b; place = PLACES[b] ? b : ""; biz = b === "other" || b === "rental"; bk = b === "other" ? "other" : "rental";
  setForm(t, biz);
}
function buildSub() {
  $("subOut").hidden = !(biz && t === "out");
  $("subIn").hidden = !(biz && t === "in");
  $("subSeg").hidden = !biz || !!place;
  const bc = $("bookChips"); bc.textContent = ""; bc.hidden = bookFilt !== "all" && !editId;
  if (!bc.hidden) BOOKS.forEach(b => {
    const btn = el("button", b[0] === book ? "on" : "", b[1]); btn.type = "button";
    btn.addEventListener("click", () => applyBook(b[0])); bc.appendChild(btn);
  });
  const sc = $("segChips"); sc.textContent = "";
  SEGS().forEach(s => { const b = el("button", s[0] === seg ? "on" : "", s[1]); b.type = "button"; b.addEventListener("click", () => { seg = s[0]; buildSub(); }); sc.appendChild(b); });
  const pc = $("proofChips"); pc.textContent = "";
  PROOFS.forEach(p => { const b = el("button", p[0] === proof ? "on" : "", p[1]); b.type = "button"; b.addEventListener("click", () => { proof = p[0]; buildSub(); }); pc.appendChild(b); });
  const kc = $("kindChips"); kc.textContent = "";
  KINDS.forEach(k => { const b = el("button", k[0] === kind ? "on" : "", k[1]); b.type = "button"; b.addEventListener("click", () => { kind = k[0]; buildSub(); }); kc.appendChild(b); });
  $("togRepeat").hidden = !(t === "out" && $("fixed").checked && !editId);
}
function pickCat(prev) {
  const list = catList();
  if (list.indexOf(prev) >= 0) return prev;
  if (/월세|임대/.test(prev || "")) { const r = list.filter(c => /월세|임대/.test(c))[0]; if (r) return r; }
  if (editId && list.indexOf("기타") >= 0) return "기타";
  return list[0];
}
function setForm(nt, nb) {
  t = nt; biz = nb; cat = pickCat(cat);
  if (place) { seg = PLACES[place].seg; if (biz) { kind = kindFor(cat); $("wh").checked = false; if (t === "out" && proof === "card" && /월세/.test(cat)) proof = "bank"; } }
  else if (t === "in" && biz) { kind = kindFor(cat); $("wh").checked = false; seg = segFor(cat); }
  else if (t === "out" && biz) { if (segFilt !== "all") seg = segFilt; else if (!SEGS().some(s => s[0] === seg)) seg = "common"; }
  $("segOut").className = t === "out" ? "on" : ""; $("segIn").className = t === "in" ? "on" : "";
  $("togFixed").hidden = t === "in";
  buildChips(); buildSub();
}

// ---- 저장 ----
function bodyFromForm(d) {
  const amt = num($("amt").value);
  const body = { d, m: d.slice(0, 7), y: d.slice(0, 4), amt, t, biz, cat, memo: $("memo").value.trim(), ts: editId ? editTs : Date.now(), fixed: t === "out" && $("fixed").checked };
  if (biz && t === "out") { body.proof = proof; body.ded = $("ded").checked; }
  if (biz && t === "in") { body.kind = kind; body.wh = $("wh").checked; }
  if (biz || place) body.seg = seg;
  if (place) body.place = place;
  if (biz && !place) body.bk = bk;
  return body;
}
function clearForm() { $("amt").value = ""; $("memo").value = ""; $("fixed").checked = false; $("repeat").checked = false; buildSub(); }

function onSubmit(e) {
  e.preventDefault();
  const amt = num($("amt").value);
  if (!amt) { msgAt("formMsg", "금액부터 넣어"); $("amt").focus(); return; }
  const d = $("date").value || today();
  const isEdit = !!editId;
  const body = bodyFromForm(d);
  if (isEdit && editOrig && (editOrig.fixed || body.fixed)) {
    const sibs = findSeries(editOrig);
    if (sibs.length > 1) { showSeriesChoice(sibs, body); return; }
  }
  if (isEdit) {
    S.upsertEntry(editId, body);
    endEdit(); clearForm(); msgAt("formMsg", "고쳤어", true);
    hooks.onAction("entry", { edit: true });
  } else {
    const id = D.uid("e");
    S.upsertEntry(id, body);
    let n = 1;
    if (body.fixed && $("repeat").checked) {
      const day = +d.slice(8, 10);
      for (let i = 1; i < 12; i++) {
        const ym = addMonths(d.slice(0, 7), i), nd = shiftDay(ym + "-01", day);
        S.upsertEntry(D.uid("e"), Object.assign({}, body, { d: nd, m: nd.slice(0, 7), y: nd.slice(0, 4), ts: body.ts + i }));
        n++;
      }
    }
    clearForm();
    msgAt("formMsg", n > 1 ? n + "개월치 기록했어" : (body.m !== P.range.e && body.m !== P.range.s ? parseInt(d.slice(5, 7), 10) + "월에 기록됨" : "기록했어"), true);
    hooks.onAction("entry", { edit: false, memo: !!body.memo, proof: !!(biz && t === "out" && proof !== "none"), date: d });
  }
  renderLedger();
}

// ---- 고정비 묶음 ----
function findSeries(orig) {
  const ob = bookOf(orig);
  return S.fixedEntries().filter(e => e.t === orig.t && e.cat === orig.cat && e.amt === orig.amt && bookOf(e) === ob).sort((a, b) => a.d < b.d ? -1 : 1);
}
function showSeriesChoice(sibs, body) {
  const box = $("seriesBox"); box.hidden = false; box.textContent = "";
  const after = sibs.filter(s => s.d >= editOrig.d);
  box.appendChild(el("span", "lbl", "같은 고정비가 " + sibs.length + "건 있어 (" + sibs[0].d.slice(0, 7).replace("-", "년 ") + "월 ~ " + sibs[sibs.length - 1].d.slice(0, 7).replace("-", "년 ") + "월). 어디까지 고칠까?"));
  const btns = el("div", "btns");
  const mk = (label, cls, scope) => { const x = el("button", cls, label); x.type = "button"; x.addEventListener("click", () => applySeriesEdit(sibs, body, scope)); btns.appendChild(x); };
  mk("이 건만", "", "one"); mk("이 날부터 이후 " + after.length + "건", "main", "after"); mk("전부 " + sibs.length + "건", "", "all");
  const c = el("button", "", "취소"); c.type = "button"; c.addEventListener("click", () => { box.hidden = true; box.textContent = ""; }); btns.appendChild(c);
  box.appendChild(btns); box.scrollIntoView({ behavior: "smooth", block: "nearest" });
}
function applySeriesEdit(sibs, body, scope) {
  const box = $("seriesBox"); box.hidden = true; box.textContent = "";
  let targets = scope === "one" ? sibs.filter(s => s.id === editOrig.id) : scope === "after" ? sibs.filter(s => s.d >= editOrig.d) : sibs;
  if (!targets.some(s => s.id === editOrig.id)) targets = targets.concat([editOrig]);
  const keys = ["amt", "t", "biz", "cat", "memo", "fixed", "seg", "place", "bk", "proof", "ded", "kind", "wh"];
  const changed = {};
  keys.forEach(k => { let nv = body[k], ov = editOrig[k]; if (["seg", "place", "bk", "proof", "kind"].indexOf(k) >= 0) { nv = nv == null ? "" : nv; ov = ov == null ? "" : ov; } if (nv !== ov) changed[k] = body[k]; });
  const newDay = +body.d.slice(8, 10), oldDay = +editOrig.d.slice(8, 10), dayChanged = newDay !== oldDay;
  let n = 0;
  targets.forEach(tg => {
    if (tg.id === editOrig.id) { S.upsertEntry(tg.id, body); n++; return; }
    const e2 = Object.assign({}, tg, changed);
    if (dayChanged) e2.d = shiftDay(tg.d, newDay);
    S.upsertEntry(tg.id, D.docFromEntry(e2)); n++;
  });
  endEdit(); clearForm(); msgAt("formMsg", n + "건 고쳤어", true);
  hooks.onAction("entry", { edit: true });
  renderLedger();
}
function removeSeries(x, scope) {
  const sibs = confirmSeries && confirmSeries.id === x.id ? confirmSeries.list : [x];
  const targets = scope === "one" ? [x] : scope === "after" ? sibs.filter(s => s.d >= x.d) : sibs;
  targets.forEach(tg => S.deleteEntry(tg.id));
  confirmId = null; confirmSeries = null; renderLedger();
  if (targets.length > 1) msgAt("formMsg", targets.length + "건 지웠어", true);
}
function openConfirm(x) {
  confirmId = x.id; confirmSeries = null;
  if (x.fixed) { const sibs = findSeries(x); if (sibs.length > 1) confirmSeries = { id: x.id, list: sibs }; }
  renderLedger();
}
export function startEdit(x) {
  if (x.isPay) { location.hash = "#tax"; setTimeout(() => hooks.loadPayEdit && hooks.loadPayEdit(x.pay), 50); return; }
  const bo = bookOf(x);
  if (P.view !== "all") location.hash = "#all";
  if (bookFilt !== "all" && bookFilt !== bo) bookFilt = bo;
  editId = x.id; editTs = x.ts; editOrig = x; $("seriesBox").hidden = true; $("seriesBox").textContent = "";
  applyBook(bo); setForm(x.t, biz);
  if (catList().indexOf(x.cat) >= 0) cat = x.cat;
  if (x.seg) seg = x.seg;
  if (x.biz && x.t === "out") { proof = x.proof; $("ded").checked = x.ded; }
  if (x.biz && x.t === "in") { kind = x.kind; $("wh").checked = x.wh; }
  $("fixed").checked = x.fixed; $("date").value = x.d; $("amt").value = nf.format(x.amt); $("memo").value = x.memo;
  buildChips(); buildSub();
  $("add").textContent = "저장"; $("cancelEdit").hidden = false; $("form").classList.add("editing");
  msgAt("formMsg", (x.memo || x.cat) + " " + won(x.amt) + " 고치는 중", true);
  setTimeout(() => $("form").scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  renderLedger();
}
function endEdit() {
  editId = null; editTs = 0; editOrig = null;
  $("seriesBox").hidden = true; $("seriesBox").textContent = "";
  $("add").textContent = "기록"; $("cancelEdit").hidden = true; $("form").classList.remove("editing");
  buildSub();
}
function removeEntry(id) { S.deleteEntry(id); confirmId = null; renderLedger(); }

// 달력에서 "이 날짜로 기록"
export function prefillDate(d) { $("date").value = d; location.hash = "#all"; setTimeout(() => { $("form").scrollIntoView({ behavior: "smooth", block: "start" }); $("amt").focus(); }, 80); }

// ---- 목록 ----
function sourceRows() {
  const ms = rangeMonths();
  return S.entriesIn(ms).concat(S.paysIn(ms).map(D.payAsEntry));
}
export function renderLedger() {
  if (P.view !== "all") return;
  const bf = bookFilt;
  const inRange = x => { const b = bookOf(x); return bf === "all" || b === bf; };
  const src = sourceRows().filter(inRange);
  const multi = P.range.s !== P.range.e;
  const segOn = bf === "rental" || bf === "other";
  const rows = segOn && segFilt !== "all" ? src.filter(x => x.seg === segFilt) : src;
  const segLbl = segOn && segFilt !== "all" ? SEG_LABEL[segFilt] + " " : "";
  const pv = PLACES[bf] ? bf : "";
  $("lblIn").textContent = pv ? "모은 회비" : bf === "dark" || bf === "all" ? "들어온 돈" : segLbl + "수입";
  $("lblOut").textContent = pv ? "관리비로 쓴 돈" : bf === "dark" || bf === "all" ? "나간 돈" : segLbl + "지출";
  $("lblLeft").textContent = pv ? "남은 회비" : "남은 돈";
  renderBookTable(src);
  renderSegTable(segOn ? src : [], segOn);
  $("ledgerNote").textContent = pv ? "동호회 팀들이 걷은 회비와 그 돈으로 낸 " + PLACES[pv].name + " 월세·관리비. 걷은 만큼 쓰는 공동 경비라 세금 계산에 안 들어가." : bf === "rental" ? "섭외·음향·악기·공연으로 번 돈과 거기 쓴 돈. 세무 계산에 들어가." : bf === "other" ? "레슨 등 렌탈 말고 번 돈과 거기 쓴 돈. 세무 계산에 대전악기렌탈과 합쳐서 들어가." : bf === "dark" ? "소득 아닌 돈과 개인 생활비. 빌린 돈·갚은 돈·축의금·이체·생활비. 세금 계산에는 안 들어가." : "다섯 장부를 한눈에. 위 버튼으로 하나씩 골라 보고, 적을 때는 입력칸 맨 위에서 어느 장부인지 고르면 돼. 세무에는 대전악기렌탈·기타 사업만 들어가.";
  let inSum = 0, outSum = 0, fixedSum = 0;
  rows.forEach(x => { if (x.t === "in") inSum += x.amt; else { outSum += x.amt; if (x.fixed) fixedSum += x.amt; } });
  $("sumIn").textContent = won(inSum); $("sumOut").textContent = won(outSum);
  const left = inSum - outSum;
  $("sumLeft").textContent = signed(left); $("sumLeft").className = "num" + (left < 0 ? " minus" : "");
  $("sumFixed").textContent = won(fixedSum);
  $("fixedNote").textContent = multi ? "· 이 기간 고정비 합계" : fixedSum > 0 && inSum >= fixedSum ? "· 이 달 고정비는 넘겼어" : "· 이 달에 최소 벌어야 하는 선";
  const fill = $("barFill");
  const ratio = inSum > 0 ? Math.min(outSum / inSum, 1) : (outSum > 0 ? 1 : 0);
  fill.style.width = (ratio * 100) + "%"; fill.className = outSum > inSum ? "over" : "";

  const list = $("list"); list.textContent = "";
  if (!rows.length) {
    const nm = bf === "all" ? "" : BOOK_LABEL[bf];
    setState("state", multi ? rangeLabel() + " " + nm + " 기록이 없어." : "이 달 " + nm + " 기록이 아직 없어. 위에 첫 줄 적어.");
    return;
  }
  setState("state", "");
  if (multi) { renderYearList(list, rows, inSum, outSum); list.appendChild(el("p", "note", "달을 누르면 그 달 내역으로 들어가고, 거기서 줄을 누르면 바로 고칠 수 있어.")); }
  const byDay = {};
  rows.forEach(x => { (byDay[x.d] = byDay[x.d] || []).push(x); });
  let lastMonth = null;
  const crossYear = P.range.s.slice(0, 4) !== P.range.e.slice(0, 4);
  Object.keys(byDay).sort().reverse().forEach(day => {
    const items = byDay[day].sort((a, b) => b.ts - a.ts);
    let dayOut = 0; items.forEach(x => { if (x.t === "out") dayOut += x.amt; });
    const parts = day.split("-"), dt = new Date(+parts[0], +parts[1] - 1, +parts[2]);
    if (multi && day.slice(0, 7) !== lastMonth) {
      lastMonth = day.slice(0, 7);
      let mi = 0, mo = 0; rows.forEach(x => { if (x.d.slice(0, 7) !== lastMonth) return; if (x.t === "in") mi += x.amt; else mo += x.amt; });
      const mh = el("div", "mon-h"); mh.appendChild(el("span", "", ymLabel(lastMonth, true)));
      mh.appendChild(el("span", "tot", (mi ? "+" + won(mi) + " " : "") + (mo ? "−" + won(mo) : ""))); list.appendChild(mh);
    }
    const h = el("div", "day");
    h.appendChild(el("span", "", (crossYear && !multi ? (+parts[0]) + "년 " : "") + (+parts[1]) + "월 " + (+parts[2]) + "일 (" + WD[dt.getDay()] + ")"));
    h.appendChild(el("span", "tot", dayOut ? "−" + won(dayOut) : ""));
    list.appendChild(h);
    items.forEach(x => list.appendChild(itemRow(x)));
  });
}
function renderBookTable(src) {
  const fb = $("bookFilter"), box = $("bookTable"); fb.textContent = ""; box.textContent = "";
  const all = el("button", bookFilt === "all" ? "on" : "", "전체"); all.type = "button";
  all.addEventListener("click", () => { setBookFilt("all"); renderLedger(); }); fb.appendChild(all);
  BOOKS.forEach(b => { const btn = el("button", bookFilt === b[0] ? "on" : "", b[1]); btn.type = "button"; btn.addEventListener("click", () => { setBookFilt(b[0]); renderLedger(); }); fb.appendChild(btn); });
  if (bookFilt !== "all") return;
  const by = {}; src.forEach(x => { const k = bookOf(x), b = by[k] = by[k] || { i: 0, o: 0 }; if (x.t === "in") b.i += x.amt; else b.o += x.amt; });
  const keys = BOOKS.map(b => b[0]).filter(k => by[k]);
  if (keys.length < 2) return;
  box.style.marginTop = "10px";
  const head = el("div", "mrow head"); ["장부", "수입", "지출", "남는 돈"].forEach((h, i) => head.appendChild(el("span", i ? "v" : "", h))); box.appendChild(head);
  keys.forEach(k => {
    const b = by[k], r = el("div", "mrow tap"); r.setAttribute("role", "button"); r.tabIndex = 0;
    r.addEventListener("click", () => { setBookFilt(k); renderLedger(); });
    r.appendChild(el("span", "", BOOK_LABEL[k])); r.appendChild(el("span", "v in", b.i ? "+" + won(b.i) : "·")); r.appendChild(el("span", "v", b.o ? "−" + won(b.o) : "·"));
    r.appendChild(el("span", "v" + (b.i - b.o < 0 ? " minus" : ""), signed(b.i - b.o))); box.appendChild(r);
  });
}
function renderSegTable(src, isBiz) {
  const box = $("segTable"), fb = $("segFilter"); box.textContent = ""; fb.textContent = ""; fb.hidden = !isBiz; if (!isBiz) return;
  const all = el("button", segFilt === "all" ? "on" : "", "전체"); all.type = "button"; all.addEventListener("click", () => { segFilt = "all"; renderLedger(); }); fb.appendChild(all);
  SEGS().forEach(s => { const b = el("button", segFilt === s[0] ? "on" : "", s[1]); b.type = "button"; b.addEventListener("click", () => { segFilt = s[0]; if (t === "out") seg = s[0]; buildSub(); renderLedger(); }); fb.appendChild(b); });
  const by = {}; src.forEach(x => { const b = by[x.seg] = by[x.seg] || { i: 0, o: 0 }; if (x.t === "in") b.i += x.amt; else b.o += x.amt; });
  const keys = SEGS().map(s => s[0]).filter(k => by[k]);
  if (keys.length < 2) return;
  const head = el("div", "mrow head"); ["부문", "수입", "지출", "남는 돈"].forEach((h, i) => head.appendChild(el("span", i ? "v" : "", h))); box.appendChild(head);
  keys.forEach(k => {
    const b = by[k], r = el("div", "mrow" + (segFilt === k ? " sel" : ""));
    r.appendChild(el("span", "", SEG_LABEL[k])); r.appendChild(el("span", "v in", b.i ? "+" + won(b.i) : "·")); r.appendChild(el("span", "v", b.o ? "−" + won(b.o) : "·"));
    r.appendChild(el("span", "v" + (b.i - b.o < 0 ? " minus" : ""), signed(b.i - b.o))); box.appendChild(r);
  });
}
function renderYearList(list, rows, inSum, outSum) {
  const head = el("div", "mrow head"); ["월", "수입", "지출", "남은 돈"].forEach((h, i) => head.appendChild(el("span", i ? "v" : "", h))); list.appendChild(head);
  const by = {}, crossYear = P.range.s.slice(0, 4) !== P.range.e.slice(0, 4);
  rows.forEach(x => { const k = x.d.slice(0, 7); const b = by[k] = by[k] || { i: 0, o: 0 }; if (x.t === "in") b.i += x.amt; else b.o += x.amt; });
  Object.keys(by).sort().forEach(k => {
    const b = by[k], r = el("div", "mrow tap"); r.setAttribute("role", "button"); r.tabIndex = 0;
    r.addEventListener("click", () => setRange(k, k, "custom"));
    r.appendChild(el("span", "", ymLabel(k, crossYear))); r.appendChild(el("span", "v in", b.i ? "+" + won(b.i) : "·")); r.appendChild(el("span", "v", b.o ? "−" + won(b.o) : "·"));
    r.appendChild(el("span", "v" + (b.i - b.o < 0 ? " minus" : ""), signed(b.i - b.o))); list.appendChild(r);
  });
  const s = el("div", "mrow sum"); s.appendChild(el("span", "", "합계")); s.appendChild(el("span", "v in", "+" + won(inSum))); s.appendChild(el("span", "v", "−" + won(outSum)));
  s.appendChild(el("span", "v" + (inSum - outSum < 0 ? " minus" : ""), signed(inSum - outSum))); list.appendChild(s);
}

export function itemRow(x, opts) {
  opts = opts || {};
  const row = el("div", "item"), what = el("div", "what");
  const rerender = opts.rerender || renderLedger;
  if (x.isPay) {
    const p = x.pay;
    what.appendChild(el("span", "memo-t", p.name + " · " + D.PAY_KINDS[p.kind] + (p.memo ? " · " + p.memo : "")));
    const pm = el("span", "meta"); pm.appendChild(el("span", "b", "사업")); pm.appendChild(el("span", "", "인건비·외주비"));
    pm.appendChild(el("span", "", "원천징수 " + won(p.tax + p.local) + " · 실지급 " + won(p.net))); what.appendChild(pm); row.appendChild(what);
    if (confirmId === x.id) {
      const pc = el("div", "confirm"); pc.appendChild(el("span", "", p.name + " 지급 기록을 지울까?"));
      const pdel = el("button", "del", "지우기"); pdel.type = "button"; pdel.addEventListener("click", ev => { ev.stopPropagation(); confirmId = null; S.deletePay(p.id); rerender(); });
      const pno = el("button", "", "취소"); pno.type = "button"; pno.addEventListener("click", ev => { ev.stopPropagation(); confirmId = null; rerender(); });
      pc.appendChild(pdel); pc.appendChild(pno); row.appendChild(pc); return row;
    }
    row.appendChild(el("span", "won", "−" + won(p.gross)));
    row.classList.add("tap"); row.setAttribute("role", "button"); row.tabIndex = 0;
    row.addEventListener("click", () => startEdit(x));
    const pxb = el("button", "x", "지우기"); pxb.type = "button"; pxb.addEventListener("click", ev => { ev.stopPropagation(); confirmId = x.id; rerender(); }); row.appendChild(pxb);
    return row;
  }
  what.appendChild(el("span", "memo-t", x.memo || x.cat || (x.t === "in" ? "수입" : "지출")));
  const meta = el("span", "meta");
  if (x.memo) meta.appendChild(el("span", "", x.cat));
  const bo = bookOf(x);
  if (bookFilt === "all" || opts.showBook) meta.appendChild(el("span", "b", BOOK_LABEL[bo] + (PLACES[bo] ? " 회비" : "")));
  if (x.biz && x.seg && !x.place && x.seg !== "common") meta.appendChild(el("span", "b", SEG_LABEL[x.seg] || x.seg));
  if (x.fixed) meta.appendChild(el("span", "b", "고정비"));
  if (x.biz && x.t === "out") { meta.appendChild(el("span", x.proof === "none" ? "w" : "", PROOF_LABEL[x.proof])); if (!x.ded) meta.appendChild(el("span", "w", "경비 제외")); }
  if (x.biz && x.t === "in") { meta.appendChild(el("span", "", KIND_LABEL[x.kind])); if (x.wh) meta.appendChild(el("span", "", "3.3% 뗀 금액")); }
  if (meta.childNodes.length) what.appendChild(meta);
  row.appendChild(what);
  if (confirmId === x.id) {
    const c = el("div", "confirm"), sb = el("div", "sbtn");
    if (confirmSeries && confirmSeries.id === x.id) {
      const sibs = confirmSeries.list, after = sibs.filter(s => s.d >= x.d);
      c.appendChild(el("span", "", "같은 고정비 " + sibs.length + "건. 어디까지 지울까?"));
      [["이 건만", "one"], ["이후 " + after.length + "건", "after"], ["전부 " + sibs.length + "건", "all"]].forEach(([lb, sc]) => {
        const b = el("button", "del", lb); b.type = "button"; b.addEventListener("click", ev => { ev.stopPropagation(); removeSeries(x, sc); rerender(); }); sb.appendChild(b);
      });
    } else {
      c.appendChild(el("span", "", won(x.amt) + " 지울까?"));
      const del = el("button", "del", "지우기"); del.type = "button"; del.addEventListener("click", ev => { ev.stopPropagation(); removeEntry(x.id); rerender(); }); sb.appendChild(del);
    }
    const no = el("button", "", "취소"); no.type = "button"; no.addEventListener("click", ev => { ev.stopPropagation(); confirmId = null; confirmSeries = null; rerender(); });
    sb.appendChild(no); c.appendChild(sb); row.appendChild(c);
    c.addEventListener("click", ev => ev.stopPropagation());
    return row;
  }
  row.appendChild(el("span", "won" + (x.t === "in" ? " in" : ""), (x.t === "in" ? "+" : "−") + won(x.amt)));
  row.classList.add("tap"); if (editId === x.id) row.classList.add("editing");
  row.setAttribute("role", "button"); row.tabIndex = 0;
  row.addEventListener("click", () => startEdit(x));
  row.addEventListener("keydown", ev => { if (ev.key === "Enter") startEdit(x); });
  const xb = el("button", "x", "지우기"); xb.type = "button";
  xb.addEventListener("click", ev => { ev.stopPropagation(); openConfirm(x); rerender(); });
  row.appendChild(xb);
  return row;
}

export function onLedgerShown() {
  if (editId) { /* 수정 중이면 유지 */ } else applyBook(bookFilt === "all" ? book : bookFilt);
  confirmId = null; renderLedger();
}

export function initLedger(h) {
  hooks = Object.assign(hooks, h || {});
  $("segOut").addEventListener("click", () => setForm("out", biz));
  $("segIn").addEventListener("click", () => setForm("in", biz));
  fmtAmtInput($("amt"));
  $("date").value = today();
  $("fixed").addEventListener("change", buildSub);
  $("form").addEventListener("submit", onSubmit);
  $("cancelEdit").addEventListener("click", () => { endEdit(); clearForm(); $("formMsg").hidden = true; renderLedger(); });
  setForm("out", false);
}
