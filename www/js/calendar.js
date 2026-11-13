// 달력 — 날짜별 수입·지출 (기기 안 기록만. 구글 캘린더는 2차)
import * as D from "./data.js";
import * as S from "./store.js";
import { $, el } from "./ui.js";
import { P } from "./period.js";
import { itemRow, prefillDate } from "./ledger.js";

const { won, today, compact, pad, WD } = D;
let selDay = today();

export function renderCalendar() {
  if (P.view !== "calendar") return;
  const month = P.month, y = +month.slice(0, 4), m = +month.slice(5, 7);
  const first = new Date(y, m - 1, 1), days = new Date(y, m, 0).getDate(), lead = first.getDay();
  const td = today();
  const docs = S.entriesIn([month]).concat(S.paysIn([month]).map(D.payAsEntry));
  const sums = {};
  docs.forEach(x => { const s = sums[x.d] = sums[x.d] || { i: 0, o: 0, n: 0 }; if (x.t === "in") s.i += x.amt; else s.o += x.amt; s.n++; });
  if (selDay.slice(0, 7) !== month) selDay = td.slice(0, 7) === month ? td : month + "-01";
  const grid = $("grid"); grid.textContent = "";
  for (let b = 0; b < lead; b++) grid.appendChild(el("div", "cell blank"));
  for (let d = 1; d <= days; d++) {
    const key = y + "-" + pad(m) + "-" + pad(d);
    const c = el("button", "cell" + (key === td ? " today" : "") + (key === selDay ? " sel" : "")); c.type = "button";
    c.appendChild(el("span", "dn" + ((lead + d - 1) % 7 === 0 ? " sun" : ""), String(d)));
    const s = sums[key];
    if (s && s.o) c.appendChild(el("span", "o", "−" + compact(s.o)));
    if (s && s.i) c.appendChild(el("span", "i", "+" + compact(s.i)));
    c.addEventListener("click", () => { selDay = key; renderCalendar(); });
    grid.appendChild(c);
  }
  const parts = selDay.split("-"), dt = new Date(+parts[0], +parts[1] - 1, +parts[2]);
  const head = $("dayHead"); head.textContent = "";
  head.appendChild(document.createTextNode((+parts[1]) + "월 " + (+parts[2]) + "일 (" + WD[dt.getDay()] + ")"));
  const s2 = sums[selDay];
  head.appendChild(el("span", "", s2 ? (s2.i ? "+" + won(s2.i) + " " : "") + (s2.o ? "−" + won(s2.o) : "") : ""));
  const di = $("dayItems"); di.textContent = "";
  docs.filter(x => x.d === selDay).sort((a, b) => b.ts - a.ts).forEach(x => di.appendChild(itemRow(x, { rerender: renderCalendar, showBook: true })));
  const dn = $("dayNote"); dn.textContent = di.childNodes.length ? "" : "이 날은 기록이 없어."; dn.hidden = !dn.textContent;
}
export function initCalendar() {
  $("dayAddBtn").addEventListener("click", () => prefillDate(selDay));
}
