// 공통 상수·순수 함수 (화면 코드와 분리해 둔다 — 노드에서 테스트 가능)

export const nf = new Intl.NumberFormat("ko-KR");
export function won(n) { return nf.format(Math.round(n)) + "원"; }
export function signed(n) { return (n < 0 ? "−" : "") + won(Math.abs(n)); }
export function pad(n) { return (n < 10 ? "0" : "") + n; }
export function ymd(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
export function today() { return ymd(new Date()); }
export function num(v) { return parseInt(String(v == null ? "" : v).replace(/[^0-9]/g, ""), 10) || 0; }
export const WD = ["일", "월", "화", "수", "목", "금", "토"];

export function addMonths(ym, n) { const d = new Date(+ym.slice(0, 4), +ym.slice(5, 7) - 1 + n, 1); return d.getFullYear() + "-" + pad(d.getMonth() + 1); }
export function monthsBetween(s, e) { const out = []; let cur = s, guard = 0; while (cur <= e && guard++ < 36) { out.push(cur); cur = addMonths(cur, 1); } return out; }
export function ymLabel(ym, withYear) { return (withYear ? (+ym.slice(0, 4)) + "년 " : "") + (+ym.slice(5, 7)) + "월"; }
export function addDays(s, n) { const p = s.split("-"); return ymd(new Date(+p[0], +p[1] - 1, +p[2] + n)); }
export function shiftDay(dStr, day) { const y = +dStr.slice(0, 4), m = +dStr.slice(5, 7); const last = new Date(y, m, 0).getDate(); return y + "-" + pad(m) + "-" + pad(Math.min(day, last)); }
export function dday(dt) { const t = new Date(); t.setHours(0, 0, 0, 0); const d0 = new Date(dt); d0.setHours(0, 0, 0, 0); return Math.round((d0 - t) / 86400000); }
export function ddayText(n) { return n === 0 ? "오늘" : n > 0 ? "D-" + n : n + "일 지남"; }
export function mdText(dt) { return (dt.getMonth() + 1) + "월 " + dt.getDate() + "일"; }
export function compact(n) {
  if (n >= 1e8) return (n / 1e8).toFixed(1).replace(/\.0$/, "") + "억";
  if (n >= 1e6) return Math.round(n / 1e4) + "만";
  if (n >= 1e4) return (n / 1e4).toFixed(1).replace(/\.0$/, "") + "만";
  if (n >= 1e3) return Math.round(n / 1e3) + "천";
  return String(n);
}
export function uid(prefix) { return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

// ---- 분류 ----
export const CATS = {
  out_p: ["식비", "교통", "임대료", "주거·공과금", "통신", "구독", "생활", "의료", "경조사", "술·모임", "갚은 돈", "빌려준 돈", "기타"],
  out_b: ["악기·장비 구입", "수리·소모품", "임대료", "공과금", "통신", "광고·홍보", "차량·주유", "접대비", "보험료", "인건비", "수수료", "교육·자료", "세금·공과", "기타"],
  in_p: ["빌린 돈", "돌려받은 돈", "축의금·선물", "환불·보증금", "내 통장 이체", "용돈", "기타"],
  in_b: ["악기렌탈", "음향렌탈", "섭외", "공연", "기타"],
  in_o: ["레슨비(학원)", "레슨비(개인)", "공연·행사", "기타"],
  out_s: ["오정동 월세", "공과금", "관리비", "장비·소모품", "수리", "청소·관리", "간식·비품", "기타"],
  in_s: ["팀 회비", "모금", "돌려준 회비", "기타"],
  out_w: ["선화동 월세", "공과금", "관리비", "장비·소모품", "수리", "청소·관리", "간식·비품", "기타"],
  in_w: ["팀 회비", "모금", "돌려준 회비", "기타"],
};
export const PLACES = { ojeong: { name: "오정동", biz: false, seg: "studio" }, sunhwa: { name: "선화동", biz: false, seg: "sunhwa" } };
export const NO_VAT_CATS = ["접대비", "보험료", "인건비", "세금·공과"];
export const SEGS_BY = {
  rental: [["booking", "섭외"], ["sound", "음향"], ["rental", "악기"], ["event", "공연"], ["common", "공통"]],
  other: [["lesson", "레슨"], ["common", "공통"]],
};
export const BK_NAME = { rental: "대전악기렌탈", other: "기타 사업" };
export const BOOKS = [["rental", "대전악기렌탈"], ["other", "기타 사업"], ["dark", "어둠"], ["ojeong", "오정동"], ["sunhwa", "선화동"]];
export const BOOK_LABEL = {}; BOOKS.forEach(b => { BOOK_LABEL[b[0]] = b[1]; });
export const SEG_LABEL = { studio: "오정동 회비", sunhwa: "선화동 회비", booking: "섭외", sound: "음향", rental: "악기", event: "공연", lesson: "레슨", common: "공통" };
export const PROOFS = [["card", "카드"], ["tax", "세금계산서"], ["cash", "현금영수증"], ["bank", "계좌이체(월세 등)"], ["none", "없음·간이영수증"]];
export const KINDS = [["taxable", "과세 (부가세 포함)"], ["exempt", "면세 (레슨 등)"], ["other", "기타"]];
export const PROOF_LABEL = { card: "카드", tax: "세금계산서", cash: "현금영수증", bank: "계좌이체", none: "증빙 없음" };
export const KIND_LABEL = { taxable: "과세", exempt: "면세", other: "기타" };

export function bookOf(x) { return x.place ? x.place : x.biz ? (x.bk === "other" ? "other" : "rental") : "dark"; }
export function segFor(cat) { return cat === "렌탈" || cat === "악기렌탈" ? "rental" : /합주실/.test(cat) ? "studio" : /레슨/.test(cat) ? "lesson" : cat === "음향렌탈" ? "sound" : cat === "섭외" ? "booking" : cat === "공연" || cat === "공연·행사" ? "event" : "common"; }
export function bkFor(seg) { return seg === "lesson" ? "other" : "rental"; }
export function kindFor(cat) { return /레슨/.test(cat) ? "exempt" : cat === "기타" ? "other" : "taxable"; }

// 저장된 원본 → 화면용 기록 (누락 필드 보정)
export function normEntry(id, x) {
  x = x || {};
  const segRaw = SEG_LABEL[x.seg] ? String(x.seg) : "";
  const cat = String(x.cat || "");
  return {
    id, d: String(x.d || ""), amt: Number(x.amt) || 0, t: x.t === "in" ? "in" : "out", biz: !!x.biz,
    fixed: !!x.fixed, cat, memo: String(x.memo || ""), ts: Number(x.ts) || 0,
    ded: x.ded !== false, proof: PROOF_LABEL[x.proof] ? String(x.proof) : "none",
    kind: KIND_LABEL[x.kind] ? String(x.kind) : "other", wh: !!x.wh,
    seg: segRaw || (x.biz ? (x.t === "in" ? segFor(cat) : "common") : ""),
    place: PLACES[x.place] ? String(x.place) : (x.seg === "studio" ? "ojeong" : x.seg === "sunhwa" ? "sunhwa" : ""),
    bk: BK_NAME[x.bk] ? String(x.bk) : bkFor(segRaw || segFor(cat)),
  };
}
// 화면용 기록 → 저장용 원본
export function docFromEntry(e) {
  const o = { d: e.d, m: e.d.slice(0, 7), y: e.d.slice(0, 4), amt: e.amt, t: e.t, biz: e.biz, cat: e.cat, memo: e.memo, ts: e.ts, fixed: e.fixed };
  if (e.biz && e.t === "out") { o.proof = e.proof; o.ded = e.ded; }
  if (e.biz && e.t === "in") { o.kind = e.kind; o.wh = e.wh; }
  if (e.biz || e.place) o.seg = e.seg;
  if (e.place) o.place = e.place;
  if (e.biz && !e.place) o.bk = e.bk;
  return o;
}
export const PAY_KINDS = { biz: "사업소득", other: "기타소득", daily: "일용직" };
export const PAY_HINT = {
  biz: "프리랜서 강사·세션·외주. 지급액의 3% 소득세 + 0.3% 지방소득세를 떼고 줘.",
  other: "일회성 강연·원고·심사 같은 것. 60% 경비 인정 후 소득세 20% + 지방 2% → 지급액의 8.8%. 12만 5천 원 이하는 안 뗌.",
  daily: "하루 단위 알바. 일당에서 15만 원 빼고 남은 돈의 2.7% + 지방 0.27%. 하루 18만 7천 원 이하면 안 뗌.",
};
export function normPay(id, x) {
  x = x || {};
  return { id, d: String(x.d || ""), m: String(x.m || String(x.d || "").slice(0, 7)), name: String(x.name || ""), kind: PAY_KINDS[x.kind] ? String(x.kind) : "biz",
    gross: Number(x.gross) || 0, days: Number(x.days) || 1, tax: Number(x.tax) || 0, local: Number(x.local) || 0, net: Number(x.net) || 0,
    memo: String(x.memo || ""), ts: Number(x.ts) || 0, bk: BK_NAME[x.bk] ? String(x.bk) : "rental" };
}
export function payAsEntry(p) {
  return { id: p.id, d: p.d, amt: p.gross, t: "out", biz: true, fixed: false, cat: "인건비·외주비", memo: p.name, ts: p.ts, ded: true, proof: "tax", kind: "other", wh: false, isPay: true, pay: p, seg: "common", place: "", bk: p.bk };
}

// ---- 세율 (2026년 신고 기준) ----
export const BRACKETS = [
  [14000000, 0.06, 0], [50000000, 0.15, 1260000], [88000000, 0.24, 5760000], [150000000, 0.35, 15440000],
  [300000000, 0.38, 19940000], [500000000, 0.40, 25940000], [1000000000, 0.42, 35940000], [Infinity, 0.45, 65940000],
];
export function bracketOf(base) { for (let i = 0; i < BRACKETS.length; i++) if (base <= BRACKETS[i][0]) return BRACKETS[i]; return BRACKETS[BRACKETS.length - 1]; }
export function incomeTax(base) { const b = bracketOf(base); return Math.max(0, Math.floor(base * b[1] - b[2])); }
export function umbrellaCap(inc) { return inc <= 40000000 ? 6000000 : inc <= 60000000 ? 5000000 : inc <= 100000000 ? 4000000 : 2000000; }
export const BASIC_DED = 1500000, STD_CREDIT = 70000, EFILE_CREDIT = 10000, SIMPLE_EXEMPT = 48000000, PROOF_PENALTY = 0.02, PROOF_MIN = 30000;
export const SIMPLE_LIMIT = 104000000, BOOKKEEPING_LIMIT = 75000000, PENSION_CAP = 9000000, PENSION_LOW = 45000000;

// ---- 원천징수 ----
export function floor10(n) { return Math.floor(Math.max(0, n) / 10) * 10; }
export function payTax(kind, gross, days) {
  let tax = 0;
  if (kind === "biz") tax = gross * 0.03;
  else if (kind === "other") { const inc = gross * 0.4; tax = inc > 50000 ? inc * 0.2 : 0; }
  else { days = Math.max(1, days || 1); const perDay = gross / days; const t1 = Math.max(0, perDay - 150000) * 0.06 * 0.45; tax = floor10(t1) * days; }
  tax = floor10(tax); if (tax < 1000) tax = 0;
  const local = floor10(tax * 0.1);
  return { tax, local, net: gross - tax - local };
}
export function grossFromNet(kind, net) {
  if (kind === "daily") return net;
  const g = Math.round(net / (kind === "biz" ? 0.967 : 0.912));
  if (kind === "other" && g <= 125000) return net;
  const offs = [0, 10, -10, 20, -20, 30, -30];
  for (let i = 0; i < offs.length; i++) { if (payTax(kind, g + offs[i]).net === net) return g + offs[i]; }
  return g;
}

export function normSettings(s) {
  s = s || {};
  return {
    vatType: ["general", "simple", "none"].indexOf(s.vatType) >= 0 ? s.vatType : "simple",
    vatRate: Number(s.vatRate) || 40,
    deps: Math.max(1, Number(s.deps) || 1),
    pension: Number(s.pension) || 0, umbrella: Number(s.umbrella) || 0,
    prepaid: Number(s.prepaid) || 0, credits: Number(s.credits) || 0,
    simpleRate: Number(s.simpleRate) || 0, pensionAcct: Number(s.pensionAcct) || 0, halfYear: !!s.halfYear,
  };
}

// ---- 세금 계산 (순수 함수) ----
export function computeTax(yearDocs, payDocs, settingsRaw) {
  const s = normSettings(settingsRaw);
  let T = 0, E = 0, O = 0, whTax = 0, whLocal = 0, whGross = 0;
  let dedAll = 0, dedProof = 0, dedVat = 0, noDed = 0, noProofCnt = 0, noProofSum = 0;
  yearDocs.forEach(x => {
    if (!x.biz || x.place) return;
    if (x.t === "in") {
      const gross = x.wh ? x.amt / 0.967 : x.amt;
      if (x.wh) { whGross += gross; whTax += gross * 0.03; whLocal += gross * 0.003; }
      if (x.kind === "taxable") T += gross; else if (x.kind === "exempt") E += gross; else O += gross;
    } else {
      if (!x.ded) { noDed += x.amt; return; }
      dedAll += x.amt;
      if (x.proof !== "none") { dedProof += x.amt; if (x.proof !== "bank" && NO_VAT_CATS.indexOf(x.cat) < 0) dedVat += x.amt; }
      else if (x.amt > PROOF_MIN) { noProofCnt++; noProofSum += x.amt; }
    }
  });
  let payGross = 0, payTaxSum = 0, payLocalSum = 0;
  payDocs.forEach(p => { payGross += p.gross; payTaxSum += p.tax; payLocalSum += p.local; });
  dedAll += payGross; dedProof += payGross;
  let outTax = 0, inTax = 0, vatDue = 0, vatExempt = false, income, expense;
  const genVat = T / 11 - dedVat / 11;
  const simVat = T < SIMPLE_EXEMPT ? 0 : Math.max(0, T * (s.vatRate / 100) * 0.1 - (dedProof - payGross) * 0.005);
  if (s.vatType === "general") {
    outTax = T / 11; inTax = dedVat / 11; vatDue = outTax - inTax;
    income = T - outTax + E + O; expense = dedAll - inTax;
  } else if (s.vatType === "simple") {
    if (T < SIMPLE_EXEMPT) { vatExempt = true; vatDue = 0; } else vatDue = simVat;
    income = T + E + O; expense = dedAll + vatDue;
  } else { income = T + E + O; expense = dedAll; }
  const net = income - expense;
  const umbrellaUsed = Math.min(s.umbrella, umbrellaCap(Math.max(0, net)));
  const deductions = BASIC_DED * s.deps + s.pension + umbrellaUsed;
  const base = Math.max(0, net - deductions);
  const br = bracketOf(base);
  const calc = incomeTax(base);
  const pensionRate = net <= PENSION_LOW ? 0.15 : 0.12;
  const pensionCredit = Math.floor(Math.min(s.pensionAcct, PENSION_CAP) * pensionRate);
  const credits = Math.min(calc, STD_CREDIT + EFILE_CREDIT + s.credits + pensionCredit);
  const determined = Math.max(0, calc - credits);
  const local = Math.floor(determined * 0.1);
  const dueTax = determined - whTax - s.prepaid;
  const dueLocal = local - whLocal;
  const penalty = noProofSum * PROOF_PENALTY;
  const simpleNet = s.simpleRate ? income * (1 - s.simpleRate / 100) : null;
  return { s, T, E, O, whGross, whTax, whLocal, dedAll, dedProof, dedVat, noDed, noProofCnt, noProofSum, outTax, inTax, vatDue, vatExempt, genVat, simVat,
    income, expense, net, umbrellaUsed, deductions, base, br, calc, pensionRate, pensionCredit, credits, determined, local, dueTax, dueLocal, penalty, simpleNet,
    payGross, payTaxSum, payLocalSum };
}
export function whDue(m, halfYear) {
  const y = +m.slice(0, 4), mo = +m.slice(5, 7);
  if (halfYear) return mo <= 6 ? new Date(y, 6, 10) : new Date(y + 1, 0, 10);
  return new Date(y, mo, 10);
}
export function stmtDue(m) { const y = +m.slice(0, 4), mo = +m.slice(5, 7); return new Date(y, mo + 1, 0); }
