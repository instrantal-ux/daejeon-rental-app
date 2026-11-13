// 세무 화면 — 종소세·부가세 예상, 원천징수 지급, 할 일, 절세 제안, 설정
import * as D from "./data.js";
import * as S from "./store.js";
import { $, el, msgAt, setState, fmtAmtInput, onAll } from "./ui.js";
import { P } from "./period.js";

const { won, signed, today, num, nf, PAY_KINDS, PAY_HINT, BK_NAME, PLACES, SEG_LABEL, BRACKETS, BASIC_DED, umbrellaCap, SIMPLE_EXEMPT, SIMPLE_LIMIT, BOOKKEEPING_LIMIT, PENSION_CAP, PENSION_LOW,
  payTax, grossFromNet, dday, ddayText, mdText, whDue, stmtDue } = D;

let payKind = "biz", payBk = "rental", payEditId = null, payEditTs = 0, payConfirmId = null;
let hooks = { onAction: () => {} };

function yearDocs() { return S.entriesYear(P.year); }
function payDocs() { return S.paysYear(P.year); }

// ---- 지급 입력 ----
function setPayKind(k) {
  payKind = k;
  Array.prototype.forEach.call($("paySeg").querySelectorAll("button"), b => { b.className = b.getAttribute("data-k") === k ? "on" : ""; });
  $("payHint").textContent = PAY_HINT[k];
  $("payNetWrap").hidden = k === "daily"; $("payDaysWrap").hidden = k !== "daily";
  if (k === "daily") $("payNet").checked = false;
  $("payAmtLbl").textContent = $("payNet").checked ? "실수령액" : (k === "daily" ? "총 일당 합계" : "세전 지급액");
  payPreview();
}
function setPayBk(b) { payBk = b; Array.prototype.forEach.call($("payBkSeg").querySelectorAll("button"), x => { x.className = x.getAttribute("data-b") === b ? "on" : ""; }); }
function payInputs() {
  const amt = num($("payAmt").value), days = Math.max(1, num($("payDays").value) || 1), isNet = payKind !== "daily" && $("payNet").checked;
  const gross = isNet ? grossFromNet(payKind, amt) : amt;
  const r = payTax(payKind, gross, days);
  return { gross, days, tax: r.tax, local: r.local, net: r.net, isNet };
}
function payPreview() {
  const p = payInputs(), box = $("payCalc"); box.textContent = "";
  if (!p.gross) { box.hidden = true; return; }
  box.hidden = false;
  const line = (k, v, big) => { box.appendChild(el("span", big ? "big" : "", k)); box.appendChild(el("span", "v" + (big ? " big" : ""), v)); };
  line("세전 지급액", won(p.gross));
  line("소득세 " + (payKind === "biz" ? "3%" : payKind === "other" ? "8%" : "2.7%"), "−" + won(p.tax));
  line("지방소득세 (소득세의 10%)", "−" + won(p.local));
  line("통장에 보낼 돈", won(p.net), true);
  if (p.tax === 0 && p.gross) box.appendChild(el("span", "", payKind === "daily" ? "일당이 공제 한도 안이라 뗄 세금 없음" : "소액이라 뗄 세금 없음 (1천 원 미만)"));
}
function onPaySubmit(e) {
  e.preventDefault();
  const p = payInputs(), name = $("payName").value.trim();
  if (!p.gross) { msgAt("payMsg", "지급액부터 넣어"); $("payAmt").focus(); return; }
  if (!name) { msgAt("payMsg", "받는 사람 이름을 적어야 지급명세서를 낼 수 있어"); $("payName").focus(); return; }
  const d = $("payDate").value || today();
  const isEdit = !!payEditId;
  const id = isEdit ? payEditId : D.uid("p");
  const body = { d, m: d.slice(0, 7), y: d.slice(0, 4), name, kind: payKind, bk: payBk, gross: p.gross, days: p.days, tax: p.tax, local: p.local, net: p.net, memo: $("payMemo").value.trim(), ts: isEdit ? payEditTs : Date.now() };
  S.upsertPay(id, body);
  $("payAmt").value = ""; $("payMemo").value = ""; payPreview();
  if (isEdit) { endPayEdit(); msgAt("payMsg", name + " 지급 기록 고쳤어", true); }
  else msgAt("payMsg", name + "에게 " + won(p.net) + " 보내면 돼. 뗀 세금 " + won(p.tax + p.local) + "은 다음 달 10일까지", true);
  hooks.onAction("pay", { edit: isEdit, date: d });
  renderTax();
}
export function loadPayEdit(p) {
  $("payNet").checked = false; setPayKind(p.kind); setPayBk(p.bk);
  $("payName").value = p.name; $("payAmt").value = nf.format(p.gross); $("payDays").value = p.days; $("payMemo").value = p.memo; $("payDate").value = p.d;
  payPreview();
  payEditId = p.id; payEditTs = p.ts;
  $("payAdd").textContent = "저장"; $("payCancel").hidden = false; $("payForm").classList.add("editing");
  msgAt("payMsg", p.name + " " + won(p.gross) + " 고치는 중", true);
  setTimeout(() => $("payForm").scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  renderTax();
}
function endPayEdit() { payEditId = null; payEditTs = 0; $("payAdd").textContent = "기록"; $("payCancel").hidden = true; $("payForm").classList.remove("editing"); }
function removePay(id) { S.deletePay(id); payConfirmId = null; renderTax(); }

// ---- 설정 ----
function fillSettings() {
  const s = S.taxSettings();
  $("sVat").value = s.vatType; $("sRate").value = String(s.vatRate); $("sDeps").value = s.deps;
  $("sPension").value = s.pension ? nf.format(s.pension) : ""; $("sUmbrella").value = s.umbrella ? nf.format(s.umbrella) : "";
  $("sPrepaid").value = s.prepaid ? nf.format(s.prepaid) : ""; $("sCredits").value = s.credits ? nf.format(s.credits) : "";
  $("sSimple").value = s.simpleRate ? s.simpleRate : "";
  $("sPensionAcct").value = s.pensionAcct ? nf.format(s.pensionAcct) : ""; $("sHalf").checked = s.halfYear;
}
function onSettingsSubmit(e) {
  e.preventDefault();
  const body = { vatType: $("sVat").value, vatRate: Number($("sRate").value), deps: Math.max(1, num($("sDeps").value) || 1),
    pension: num($("sPension").value), umbrella: num($("sUmbrella").value), prepaid: num($("sPrepaid").value),
    credits: num($("sCredits").value), simpleRate: Math.min(99, num($("sSimple").value)), pensionAcct: num($("sPensionAcct").value), halfYear: $("sHalf").checked };
  S.saveTaxSettings(body); msgAt("settingsMsg", "저장됐어", true);
  hooks.onAction("settings", {});
  renderTax();
}

function trow(box, k, v, opts) {
  opts = opts || {};
  const r = el("div", "trow" + (opts.total ? " total" : "") + (opts.indent ? " indent" : ""));
  const kk = el("div", "k", k); if (opts.sub) kk.appendChild(el("small", "", opts.sub));
  const vv = el("div", "v" + (opts.cls ? " " + opts.cls : ""), typeof v === "number" ? signed(v) : v);
  r.appendChild(kk); r.appendChild(vv); box.appendChild(r);
}

export function computeNow() { return D.computeTax(yearDocs(), payDocs(), S.rawState().settings.tax); }

export function renderTax() {
  if (P.view !== "tax") return;
  const yd = yearDocs(), pd = payDocs();
  const c = D.computeTax(yd, pd, S.rawState().settings.tax), s = c.s, year = P.year;
  const hasBiz = yd.some(x => x.biz && !x.place) || pd.length > 0;
  $("kIn").textContent = won(c.income); $("kExp").textContent = won(c.expense);
  $("kNet").textContent = signed(c.net); $("kNet").className = "num" + (c.net < 0 ? " minus" : "");
  $("kVat").textContent = c.vatExempt ? "면제" : signed(c.vatDue);
  const total = c.dueTax + c.dueLocal;
  $("kDue").textContent = total < 0 ? "환급 " + won(-total) : won(total);
  $("kDue").className = "num" + (total < 0 ? " in" : "");
  setState("taxState", hasBiz ? "" : year + "년에 '대전악기렌탈'이나 '기타 사업' 장부로 적은 게 아직 없어. 장부에서 그 장부를 골라 적으면 여기 잡혀.");

  // 일정
  const y = parseInt(year, 10), ny = y + 1;
  $("schedYear").textContent = y + "년 귀속";
  const sc = $("sched"); sc.textContent = "";
  const li = (d, title, sub) => { const x = el("li"); x.appendChild(el("span", "d", d)); const b = el("span", "", title); b.appendChild(el("small", "", sub)); x.appendChild(b); sc.appendChild(x); };
  if (s.vatType === "general") { li(y + ".07.25", "부가세 1기 확정 신고", "1~6월 매출·매입"); li(ny + ".01.25", "부가세 2기 확정 신고", "7~12월 매출·매입"); }
  else if (s.vatType === "simple") { li(y + ".07.25", "부가세 예정부과 납부", "작년 납부세액의 절반이 고지됨. 없으면 넘어감"); li(ny + ".01.25", "부가세 신고 (연 1회)", "1~12월 전체. 매출 4,800만 미만이면 납부 면제, 신고는 해야 함"); }
  li(y + ".11.30", "소득세 중간예납", "작년 세액의 절반이 고지됨. 낸 금액은 설정에 적어");
  li(ny + ".05.31", "종합소득세 신고·납부", "5월 1일~31일. 지방소득세도 같이");

  // 증빙
  const pc = $("proofCheck"); pc.textContent = "";
  if (c.noProofCnt) {
    const a = el("div", "alert");
    a.appendChild(el("b", "", "적격증빙 없는 3만 원 초과 경비 " + c.noProofCnt + "건, " + won(c.noProofSum)));
    a.appendChild(document.createTextNode(" → 증빙불비가산세 약 " + won(c.penalty) + ". 세금계산서나 현금영수증 다시 받을 수 있으면 받아."));
    pc.appendChild(a);
  } else pc.appendChild(el("p", "note", hasBiz ? "3만 원 넘는 경비는 전부 적격증빙이 있어. 좋아." : "아직 점검할 경비가 없어."));
  if (c.noDed) trow(pc, "경비에서 뺀 사업 지출", c.noDed, { sub: "경비로 잡기 체크 안 한 것", cls: "minus" });

  const ri = $("rowsIn"); ri.textContent = "";
  if (s.vatType === "general") trow(ri, "과세 매출 (공급가)", c.T - c.outTax, { sub: "받은 돈 " + won(c.T) + " 중 부가세 " + won(c.outTax) + " 제외" });
  else trow(ri, "과세 매출", c.T, { sub: s.vatType === "simple" ? "간이과세는 받은 돈 전액이 수입" : "" });
  trow(ri, "면세 매출 (레슨 등)", c.E, { sub: c.whGross ? "3.3% 떼기 전 금액으로 환산 " + won(c.whGross) : "" });
  if (c.O) trow(ri, "기타 수입", c.O);
  trow(ri, "수입금액 합계", c.income, { total: true, cls: "in" });

  const re = $("rowsExp"); re.textContent = "";
  trow(re, "경비로 잡은 지출", c.dedAll - c.payGross, { sub: "적격증빙 " + won(c.dedProof - c.payGross) });
  if (c.payGross) trow(re, "인건비·외주비 (원천징수 지급분)", c.payGross, { sub: pd.length + "건 · 지급명세서로 증빙" });
  if (s.vatType === "general") trow(re, "매입세액 (부가세로 돌려받는 몫)", -c.inTax, { indent: true });
  if (s.vatType === "simple" && c.vatDue) trow(re, "부가세 납부액 (경비 산입)", c.vatDue, { indent: true });
  trow(re, "필요경비 합계", c.expense, { total: true });
  trow(re, "소득금액 (수입 − 경비)", c.net, { total: true, cls: c.net < 0 ? "minus" : "" });
  if (c.simpleNet != null) trow(re, "단순경비율 " + s.simpleRate + "% 적용 시 소득금액", c.simpleNet, { sub: "장부 없이 추계 신고할 때. 낮은 쪽이 유리", indent: true });

  const rt = $("rowsTax"); rt.textContent = "";
  trow(rt, "소득금액", Math.max(0, c.net));
  trow(rt, "기본공제", -BASIC_DED * s.deps, { indent: true, sub: s.deps + "명 × 150만 원" });
  if (s.pension) trow(rt, "국민연금", -s.pension, { indent: true });
  if (s.umbrella) trow(rt, "노란우산공제", -c.umbrellaUsed, { indent: true, sub: c.umbrellaUsed < s.umbrella ? "한도 " + won(umbrellaCap(Math.max(0, c.net))) + "까지만" : "" });
  trow(rt, "과세표준", c.base, { total: true });
  trow(rt, "산출세액", c.calc, { sub: Math.round(c.br[1] * 100) + "% 구간" + (c.br[2] ? ", 누진공제 " + won(c.br[2]) : "") });
  trow(rt, "세액공제", -c.credits, { indent: true, sub: "표준 7만 + 전자신고 1만" + (c.pensionCredit ? " + 연금계좌 " + won(c.pensionCredit) + " (" + Math.round(c.pensionRate * 100) + "%)" : "") + (s.credits ? " + 기타 " + won(s.credits) : "") });
  trow(rt, "결정세액", c.determined, { total: true });
  if (c.whTax) trow(rt, "이미 낸 세금 (원천징수 3%)", -c.whTax, { indent: true });
  if (s.prepaid) trow(rt, "중간예납", -s.prepaid, { indent: true });
  trow(rt, c.dueTax < 0 ? "소득세 환급 예상" : "소득세 납부 예상", Math.abs(c.dueTax), { total: true, cls: c.dueTax < 0 ? "in" : "" });
  trow(rt, "지방소득세 (결정세액의 10%)", c.local, { sub: c.whLocal ? "원천징수 0.3% " + won(c.whLocal) + " 이미 냄" : "" });
  trow(rt, c.dueLocal < 0 ? "지방소득세 환급 예상" : "지방소득세 납부 예상", Math.abs(c.dueLocal), { cls: c.dueLocal < 0 ? "in" : "" });
  trow(rt, total < 0 ? "5월에 돌려받는 돈" : "5월에 낼 돈 합계", Math.abs(total), { total: true, cls: total < 0 ? "in" : "" });

  $("vatTypeLabel").textContent = s.vatType === "general" ? "일반과세자" : s.vatType === "simple" ? "간이과세자 · 부가가치율 " + s.vatRate + "%" : "면세·미등록";
  const rv = $("rowsVat"); rv.textContent = "";
  if (s.vatType === "general") {
    trow(rv, "매출세액", c.outTax, { sub: "과세 매출 ÷ 11" });
    trow(rv, "매입세액", -c.inTax, { indent: true, sub: "적격증빙 매입 ÷ 11 (접대비·보험·인건비 제외)" });
    trow(rv, c.vatDue < 0 ? "부가세 환급 예상" : "부가세 납부 예상", Math.abs(c.vatDue), { total: true, cls: c.vatDue < 0 ? "in" : "" });
  } else if (s.vatType === "simple") {
    trow(rv, "과세 매출 (공급대가)", c.T, { sub: c.vatExempt ? "4,800만 원 미만 → 납부 면제" : "4,800만 원 이상 → 납부 대상" });
    if (!c.vatExempt) {
      trow(rv, "납부세액", c.T * (s.vatRate / 100) * 0.1, { sub: "매출 × " + s.vatRate + "% × 10%" });
      trow(rv, "세금계산서 등 수취 공제", -Math.min(c.dedProof * 0.005, c.T * (s.vatRate / 100) * 0.1), { indent: true, sub: "적격증빙 매입 × 0.5%" });
    }
    trow(rv, "부가세 납부 예상", c.vatExempt ? "0원 (면제)" : won(c.vatDue), { total: true });
    if (c.T >= SIMPLE_LIMIT) rv.appendChild(el("p", "note", "매출이 1억 400만 원을 넘었어. 다음 해 7월부터 일반과세로 바뀌니까 설정도 바꿔."));
  } else rv.appendChild(el("p", "note", "면세·미등록이면 부가세 신고 없음. 렌탈·합주실 매출이 있으면 사업자등록이 필요할 수 있으니 세무사에게 확인."));

  renderPayouts(pd); renderTodo(c, pd); renderTips(c, hasBiz, yd); renderMonthly(yd, pd); renderPrep(c, hasBiz, pd);
}

function renderPayouts(pd) {
  const pm = $("payMonths"), pl = $("payList"); pm.textContent = ""; pl.textContent = "";
  const year = P.year, paid = S.whPaid(), half = S.taxSettings().halfYear;
  if (!pd.length) { pm.appendChild(el("p", "note", "올해 사람한테 준 돈이 아직 없어. 위에 적으면 월별 납부액이 여기 나와.")); return; }
  const by = {};
  pd.forEach(p => { const b = by[p.m] = by[p.m] || { gross: 0, tax: 0, local: 0, n: 0, names: {} }; b.gross += p.gross; b.tax += p.tax; b.local += p.local; b.n++; b.names[p.name] = 1; });
  Object.keys(by).sort().reverse().forEach(m => {
    const b = by[m], due = whDue(m, half), sd = stmtDue(m), isPaid = !!paid[m], dd = dday(due);
    const r = el("div", "paym");
    const k = el("div", "k", (+m.slice(5, 7)) + "월 지급분 원천세 · " + Object.keys(b.names).join(", "));
    k.appendChild(el("small", "", b.n + "건 · 지급 " + won(b.gross) + " · 납부 " + mdText(due) + (due.getFullYear() !== +year ? " (" + due.getFullYear() + "년)" : "") + " · 간이지급명세서 " + mdText(sd) + "까지"));
    r.appendChild(k);
    const v = el("div", "v" + (!isPaid && dd < 0 ? " due" : ""), b.tax + b.local ? won(b.tax + b.local) : "뗀 것 없음");
    v.appendChild(document.createElement("br")); v.appendChild(el("small", "", b.tax + b.local ? "소득세 " + won(b.tax) + " · 지방 " + won(b.local) : "신고는 해야 함"));
    r.appendChild(v);
    const tg = el("label", "tog"); const cb = document.createElement("input"); cb.type = "checkbox"; cb.checked = isPaid;
    cb.addEventListener("change", () => { S.toggleWhPaid(m); renderTax(); });
    tg.appendChild(cb); tg.appendChild(document.createTextNode(isPaid ? "신고·납부함" : "신고·납부 전"));
    r.appendChild(tg); pm.appendChild(r);
  });
  const h = el("div", "tsec", "지급 내역 " + year + "년"); h.appendChild(el("span", "", "사람별로 모아 지급명세서에 쓰면 돼")); pl.appendChild(h);
  const byName = {};
  pd.forEach(p => { (byName[p.name] = byName[p.name] || []).push(p); });
  Object.keys(byName).sort().forEach(nm => {
    const items = byName[nm].sort((a, b) => b.d < a.d ? -1 : 1);
    let tg = 0, tt = 0; items.forEach(p => { tg += p.gross; tt += p.tax + p.local; });
    const d = el("div", "day"); d.appendChild(el("span", "", nm + " · " + items.length + "건")); d.appendChild(el("span", "tot", "지급 " + won(tg) + " · 뗀 세금 " + won(tt))); pl.appendChild(d);
    items.forEach(p => {
      const row = el("div", "item"), what = el("div", "what");
      what.appendChild(el("span", "memo-t", (+p.d.slice(5, 7)) + "월 " + (+p.d.slice(8, 10)) + "일 · " + PAY_KINDS[p.kind] + (p.kind === "daily" ? " " + p.days + "일" : "") + " · " + BK_NAME[p.bk] + (p.memo ? " · " + p.memo : "")));
      const meta = el("span", "meta"); meta.appendChild(el("span", "", "세전 " + won(p.gross))); meta.appendChild(el("span", "", "소득세 " + won(p.tax))); meta.appendChild(el("span", "", "지방 " + won(p.local)));
      what.appendChild(meta); row.appendChild(what);
      if (payConfirmId === p.id) {
        const cf = el("div", "confirm"); cf.appendChild(el("span", "", "이 지급 기록을 지울까?"));
        const del = el("button", "del", "지우기"); del.type = "button"; del.addEventListener("click", () => removePay(p.id));
        const no = el("button", "", "취소"); no.type = "button"; no.addEventListener("click", () => { payConfirmId = null; renderTax(); });
        cf.appendChild(del); cf.appendChild(no); row.appendChild(cf);
      } else {
        row.appendChild(el("span", "won", "실지급 " + won(p.net)));
        row.classList.add("tap"); if (payEditId === p.id) row.classList.add("editing");
        row.setAttribute("role", "button"); row.tabIndex = 0;
        row.addEventListener("click", () => loadPayEdit(p));
        const xb = el("button", "x", "지우기"); xb.type = "button"; xb.addEventListener("click", ev => { ev.stopPropagation(); payConfirmId = p.id; renderTax(); }); row.appendChild(xb);
      }
      pl.appendChild(row);
    });
  });
}

export function todoItems(c, pd) {
  const s = c.s, paid = S.whPaid(), now = new Date(), items = [];
  const add = (dt, title, sub, amt, done) => { const n = dday(dt); if (n < -40 || n > 45) return; items.push({ dt, n, title, sub, amt, done }); };
  const by = {};
  pd.forEach(p => { const b = by[p.m] = by[p.m] || { tax: 0, local: 0, names: {} }; b.tax += p.tax; b.local += p.local; b.names[p.name] = 1; });
  Object.keys(by).forEach(m => {
    const b = by[m], due = whDue(m, s.halfYear);
    add(due, (+m.slice(5, 7)) + "월 지급분 원천세 신고·납부 (" + Object.keys(b.names).join(", ") + ")", "홈택스 원천세 신고 → 소득세 납부, 위택스 → 지방소득세 납부", b.tax + b.local, !!paid[m]);
    add(stmtDue(m), (+m.slice(5, 7)) + "월 지급분 간이지급명세서 제출", "홈택스 · 사업소득·기타소득·일용직 모두 다음 달 말일 · 늦으면 지급액의 0.25% 가산세", 0, false);
  });
  const y = now.getFullYear();
  [y, y + 1].forEach(yy => {
    if (s.vatType === "general") { add(new Date(yy, 0, 25), "부가세 2기 확정 신고", "전년 7~12월", 0, false); add(new Date(yy, 6, 25), "부가세 1기 확정 신고", "1~6월", 0, false); }
    else if (s.vatType === "simple") { add(new Date(yy, 0, 25), "부가세 신고 (간이, 1년치)", "4,800만 미만이면 납부 면제, 신고는 필수", 0, false); add(new Date(yy, 6, 25), "부가세 예정부과 납부", "고지서 오면 그 금액만", 0, false); }
    add(new Date(yy, 4, 31), "종합소득세 신고·납부", "5월 한 달 · 지방소득세 같이", 0, false);
    add(new Date(yy, 10, 30), "소득세 중간예납", "고지서 금액 · 낸 뒤 설정에 적기", 0, false);
  });
  items.sort((a, b) => a.n - b.n);
  return items;
}
function renderTodo(c, pd) {
  const box = $("todo"); box.textContent = "";
  const now = new Date();
  $("todoLabel").textContent = (now.getMonth() + 1) + "월 " + now.getDate() + "일 기준 · 앞으로 45일";
  const items = todoItems(c, pd);
  if (!items.length) { box.appendChild(el("p", "note", "45일 안에 닥친 신고·납부가 없어.")); return; }
  items.forEach(it => {
    const r = el("div", "todo");
    r.appendChild(el("span", "dd" + (it.done ? " done" : it.n <= 7 ? " soon" : ""), it.done ? "완료" : ddayText(it.n)));
    const k = el("div", "", it.title + " · " + mdText(it.dt));
    if (it.amt) k.appendChild(el("span", "amtline", " " + won(it.amt)));
    k.appendChild(el("small", "", it.sub)); r.appendChild(k); box.appendChild(r);
  });
}

function renderTips(c, hasBiz, yd) {
  const s = c.s, box = $("tips"); box.textContent = "";
  const tip = (kind, head, body) => { const t = el("div", "tip"); t.appendChild(el("b", kind, head)); if (body) t.appendChild(el("span", "", body)); box.appendChild(t); };
  Object.keys(PLACES).forEach(pk => {
    const nm = PLACES[pk].name; let poolIn = 0, poolOut = 0;
    yd.forEach(x => { if (x.biz || x.place !== pk) return; if (x.t === "in") poolIn += x.amt; else poolOut += x.amt; });
    if (poolIn > poolOut + 100000) tip("warn", nm + " 회비가 관리비보다 " + won(poolIn - poolOut) + " 더 걷혔어", "걷은 만큼만 쓰는 공동 경비는 소득이 아니지만, 남는 돈이 계속 쌓이면 세무서가 대관 수입으로 볼 수 있어. 남는 건 팀들한테 돌려주거나 관리비(월세·공과금)로 다 쓰고, 애매하면 세무사한테 물어봐.");
    else if (poolIn > 0) tip("", nm + " 회비 " + won(poolIn) + " 걷어서 관리비 " + won(poolOut) + " 씀", "걷은 돈과 쓴 돈이 맞아떨어져서 소득 아님. 팀별 입금 내역과 월세·공과금 이체 내역은 같이 보관해둬.");
    else if (poolOut > 0) tip("", nm + " 관리비 " + won(poolOut) + " 썼는데 걷은 회비 기록이 없어", "팀들한테 받은 회비도 " + nm + " 장부에 적어둬야 걷은 돈과 쓴 돈이 맞는 게 보여.");
  });
  if (!hasBiz) { box.appendChild(el("p", "note", "사업 기록이 쌓이면 여기 숫자로 짚어줄게.")); return; }
  const rate = c.br[1], mrate = rate * 1.1;
  tip("", "지금 세율 구간 " + Math.round(rate * 100) + "% (지방세 포함 " + (mrate * 100).toFixed(1) + "%)",
    c.base <= 0 ? "과세표준이 0이라 소득세가 없어. 경비 처리가 잘 됐거나 아직 수입이 적은 거야." :
    "과세표준 " + won(c.base) + ". " + (c.br[0] === Infinity ? "" : "다음 구간까지 " + won(c.br[0] - c.base) + " 남았고, ") + "지금부터 경비 1만 원 늘리면 세금 " + Math.round(mrate * 10000) + "원 줄어.");
  const cap = umbrellaCap(Math.max(0, c.net)), room = Math.max(0, cap - s.umbrella);
  if (c.base > 0 && room > 0) tip("save", "노란우산 " + won(room) + " 더 넣으면 약 " + won(Math.min(room, c.base) * mrate) + " 절세", "올해 소득 기준 공제 한도 " + won(cap) + ". 12월 31일까지 낸 것만 올해 공제. 폐업·퇴직 때 목돈으로 돌려받는 적금 성격이라 손해 아님.");
  else if (s.umbrella >= cap && cap > 0) tip("save", "노란우산 한도 " + won(cap) + " 다 채웠어", "");
  const proom = Math.max(0, PENSION_CAP - s.pensionAcct);
  if (c.determined > 0 && proom > 0) tip("save", "연금저축·IRP " + won(proom) + " 더 넣으면 최대 " + won(Math.min(proom * c.pensionRate * 1.1, c.determined * 1.1)) + " 돌려받음", "소득 " + (c.net <= PENSION_LOW ? "4,500만 이하라 16.5%" : "4,500만 초과라 13.2%") + " 세액공제. 단 55세까지 못 빼는 돈이니 당장 현금 급하면 노란우산부터.");
  if (c.noProofCnt) tip("warn", "증빙 없는 경비 " + won(c.noProofSum) + " → 가산세 " + won(c.penalty) + (s.vatType === "general" ? " + 매입세액 " + won(c.noProofSum / 11) + " 손해" : ""), "세금계산서·현금영수증 다시 받을 수 있으면 받아. 못 받으면 계좌이체 내역이라도 모아둬 (경비는 인정, 가산세만 냄).");
  if (c.noDed) tip("", "경비에서 뺀 사업 지출 " + won(c.noDed), "진짜 사업용이면 '경비로 잡기' 켜. 지금 켜면 세금 약 " + won(c.noDed * mrate) + " 줄어.");
  if (s.vatType === "simple" && c.T > 0) {
    if (c.genVat < c.vatDue - 100000) tip("save", "일반과세로 바꾸면 부가세 " + won(c.vatDue - c.genVat) + " 유리", "장비 구입처럼 세금계산서 받은 매입이 많아서야. 간이과세 포기 신고하면 다음 달부터 일반과세 (3년간 못 돌아옴). 장비 더 살 계획이면 세무사랑 상의.");
    if (c.T >= SIMPLE_LIMIT) tip("warn", "매출 1억 400만 넘음 → 내년 7월부터 일반과세 전환", "설정도 바꿔야 하고, 세금계산서 발행 의무 생김.");
    else if (c.T >= SIMPLE_EXEMPT) tip("", "매출 4,800만 넘어서 부가세 납부 대상이고 세금계산서 발행도 가능", "렌탈 손님이 사업자면 세금계산서 끊어줘야 거래가 커져.");
  }
  if (s.vatType === "general" && c.T > 0 && c.T < SIMPLE_LIMIT && c.simVat < c.vatDue - 100000) tip("", "간이과세였다면 부가세 " + won(c.vatDue - c.simVat) + " 적었을 것", "매입이 적은 해엔 간이가 유리. 다만 매출 1억 400만 미만이어야 하고 전환은 세무사랑.");
  if (c.income >= BOOKKEEPING_LIMIT) tip("warn", "수입 7,500만 넘음 → 내년부터 복식부기 의무", "간편장부로는 안 되고 세무사 기장(월 10~15만)이 필요해. 기장세액공제 20%(한도 100만)도 받을 수 있어.");
  else tip("", "간편장부 대상 · 이 장부 그대로 쓰면 돼", "수입 7,500만 넘기 전까지는 세무사 없이도 신고 가능. 기장세액공제는 복식부기만 해당.");
  if (c.simpleNet != null) {
    if (c.simpleNet < c.net) tip("save", "단순경비율로 신고하면 소득금액 " + won(c.net - c.simpleNet) + " 낮아짐", "장부 경비가 경비율보다 적어. 다만 추계신고는 가산세·무기장 불이익이 있을 수 있어 세무사 확인.");
    else tip("", "장부 신고가 추계보다 " + won(c.simpleNet - c.net) + " 유리", "경비를 잘 모은 거야. 이대로 장부로 신고.");
  }
  const total = c.dueTax + c.dueLocal;
  if (total < 0) tip("save", "5월에 " + won(-total) + " 환급 예상", "학원에서 뗀 3.3%가 결정세액보다 많아. 신고 안 하면 못 돌려받으니 5월 꼭 신고.");
  else if (total > 0) {
    const left = Math.max(1, 12 - new Date().getMonth() + 4);
    tip("", "5월 세금 " + won(total) + (c.vatDue > 0 ? " + 1월 부가세 " + won(c.vatDue) : "") + " → 매달 " + won((total + Math.max(0, c.vatDue)) / left) + "씩 떼어 둬", "세금 통장 따로 만들어서 수입 들어올 때마다 옮겨 놓으면 5월에 안 흔들려.");
  }
  if (c.payGross > 0 && !s.halfYear) tip("", "원천세 매달 내기 번거로우면 반기납부 신청", "상시 직원 20명 이하면 가능. 6월·12월에 홈택스에서 신청하면 7월·1월 10일에 몰아서 냄. 승인되면 설정에서 체크.");
  tip("", "건강보험 지역가입자면 5월 신고 소득으로 11월부터 보험료 재산정", "소득이 늘면 보험료도 오르니 미리 알고 있어.");
}

function renderMonthly(yd, pd) {
  const box = $("monthly"); box.textContent = "";
  const by = {}, segSum = {}; let any = false;
  yd.forEach(x => { if (!x.biz || x.place) return; any = true; const k = x.d.slice(5, 7); const b = by[k] = by[k] || { i: 0, o: 0 }; if (x.t === "in") b.i += x.amt; else if (x.ded) b.o += x.amt;
    const sgk = x.seg || "common", sg = segSum[sgk] = segSum[sgk] || { i: 0, o: 0 }; if (x.t === "in") sg.i += x.amt; else if (x.ded) sg.o += x.amt; });
  pd.forEach(p => { any = true; const k = p.d.slice(5, 7); const b = by[k] = by[k] || { i: 0, o: 0 }; b.o += p.gross; });
  if (!any) { box.appendChild(el("p", "note", "사업 기록이 생기면 달별로 나와.")); return; }
  const row4 = (parent, a, b, c, d, cls) => { const r = el("div", "mrow" + (cls || "")); r.appendChild(el("span", "", a)); r.appendChild(el("span", "v in", b)); r.appendChild(el("span", "v", c)); r.appendChild(el("span", "v" + (d < 0 ? " minus" : ""), signed(d))); parent.appendChild(r); };
  const head = el("div", "mrow head"); ["월", "수입", "경비", "남는 돈"].forEach((h, i) => head.appendChild(el("span", i ? "v" : "", h))); box.appendChild(head);
  let ti = 0, to = 0;
  Object.keys(by).sort().forEach(k => { const b = by[k]; ti += b.i; to += b.o; row4(box, (+k) + "월", b.i ? "+" + won(b.i) : "·", b.o ? "−" + won(b.o) : "·", b.i - b.o); });
  row4(box, "합계", "+" + won(ti), "−" + won(to), ti - to, " sum");
  const n = Object.keys(by).length; if (n) box.appendChild(el("p", "note", "월평균 수입 " + won(ti / n) + " · 월평균 경비 " + won(to / n)));
  const bkSum = {};
  yd.forEach(x => { if (!x.biz || x.place) return; const b = bkSum[x.bk] = bkSum[x.bk] || { i: 0, o: 0 }; if (x.t === "in") b.i += x.amt; else if (x.ded) b.o += x.amt; });
  pd.forEach(p => { const b = bkSum[p.bk] = bkSum[p.bk] || { i: 0, o: 0 }; b.o += p.gross; });
  const h2 = el("div", "mrow head"); ["사업", "수입", "경비", "남는 돈"].forEach((h, i) => h2.appendChild(el("span", i ? "v" : "", h))); h2.style.marginTop = "14px"; box.appendChild(h2);
  ["rental", "other"].forEach(k => { const b = bkSum[k] || { i: 0, o: 0 }; row4(box, BK_NAME[k], b.i ? "+" + won(b.i) : "·", b.o ? "−" + won(b.o) : "·", b.i - b.o); });
  const sks = ["booking", "sound", "rental", "event", "lesson", "common"].filter(k => segSum[k]);
  if (sks.length > 1) {
    const h3 = el("div", "mrow head"); ["부문", "수입", "경비", "남는 돈"].forEach((h, i) => h3.appendChild(el("span", i ? "v" : "", h))); h3.style.marginTop = "14px"; box.appendChild(h3);
    sks.forEach(k => { const b = segSum[k]; row4(box, SEG_LABEL[k] || k, b.i ? "+" + won(b.i) : "·", b.o ? "−" + won(b.o) : "·", b.i - b.o); });
  }
}

function renderPrep(c, hasBiz, pd) {
  const s = c.s, box = $("prep"), paid = S.whPaid(); box.textContent = "";
  const row = (st, label, sub) => { const r = el("div", "prep"); r.appendChild(el("span", "st " + st, st === "ok" ? "있음" : st === "no" ? "필요" : "확인")); const d = el("div", "d", label); if (sub) d.appendChild(el("small", "", sub)); r.appendChild(d); box.appendChild(r); };
  row(hasBiz ? "ok" : "no", "수입·경비 장부 (이 가계부)", "홈택스 신고 때 수입금액·필요경비 숫자 그대로 옮기면 돼. 더보기 → 엑셀 내보내기");
  row(c.noProofCnt ? "no" : "ok", "경비 증빙 (세금계산서·카드·현금영수증)", c.noProofCnt ? "증빙 없는 " + c.noProofCnt + "건 챙기기" : "3만 원 넘는 경비 전부 증빙 있음");
  row(c.payGross ? (pd.every(p => !!paid[p.m]) ? "ok" : "no") : "ok", "원천세 신고·지급명세서 제출", c.payGross ? "지급명세서 안 내면 인건비 경비 인정 안 될 수 있음" : "사람한테 준 돈 없음");
  row(c.whGross ? "ask" : "ok", "학원 등에서 받은 원천징수영수증", c.whGross ? "3.3% 뗀 곳에서 받아두면 신고 때 기납부세액 자동 반영 확인 가능" : "");
  row(s.pension ? "ok" : "ask", "국민연금 납부내역", "홈택스 연말정산간소화에서 조회 가능");
  row(s.umbrella ? "ok" : "ask", "노란우산공제 납부증명", "중소기업중앙회 홈페이지에서 출력");
  row(s.vatType === "none" ? "ask" : "ok", "사업자등록증 · 과세유형 확인", s.vatType === "none" ? "렌탈·합주실 매출 있으면 등록 필요할 수 있음" : (s.vatType === "simple" ? "간이과세" : "일반과세") + "로 설정됨");
  row("ask", "오정동·선화동 회비 입금 내역", "동호회 공동 경비라는 걸 보이려면 팀별 입금 내역과 월세·공과금 이체 내역을 같이 보관");
}

export function initTax(h) {
  hooks = Object.assign(hooks, h || {});
  onAll($("paySeg").querySelectorAll("button"), "click", b => setPayKind(b.getAttribute("data-k")));
  onAll($("payBkSeg").querySelectorAll("button"), "click", b => setPayBk(b.getAttribute("data-b")));
  fmtAmtInput($("payAmt")); $("payAmt").addEventListener("input", payPreview);
  $("payDays").addEventListener("input", payPreview);
  $("payNet").addEventListener("change", () => setPayKind(payKind));
  $("payDate").value = today();
  setPayKind("biz");
  $("payForm").addEventListener("submit", onPaySubmit);
  $("payCancel").addEventListener("click", () => { endPayEdit(); $("payAmt").value = ""; $("payMemo").value = ""; $("payName").value = ""; payPreview(); $("payMsg").hidden = true; renderTax(); });
  ["sPension", "sUmbrella", "sPrepaid", "sCredits", "sPensionAcct"].forEach(id => fmtAmtInput($(id)));
  $("settings").addEventListener("submit", onSettingsSubmit);
  fillSettings();
}
