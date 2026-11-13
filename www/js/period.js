// 기간(월/범위/연도) 상태 — 장부·달력·세무 화면이 같이 쓴다
import { today, addMonths, monthsBetween, ymLabel } from "./data.js";

const t0 = today().slice(0, 7);
export const P = {
  view: "home",                 // home | all | calendar | tax | more
  range: { s: t0, e: t0, preset: "month" },
  month: t0,                    // 달력에서 보는 달 (장부 범위의 끝 달과 맞춰 둔다)
  year: today().slice(0, 4),    // 세무 연도
};
const subs = new Set();
export function onPeriod(fn) { subs.add(fn); return () => subs.delete(fn); }
function emit() { subs.forEach(fn => fn()); }

export function rangeLen() { return monthsBetween(P.range.s, P.range.e).length; }
export function rangeMonths() { return monthsBetween(P.range.s, P.range.e); }
export function rangeLabel() {
  const r = P.range;
  if (r.s === r.e) return ymLabel(r.s, true);
  const sameYear = r.s.slice(0, 4) === r.e.slice(0, 4);
  return ymLabel(r.s, true) + " ~ " + ymLabel(r.e, !sameYear);
}
export function setRange(s, e, preset) {
  if (e < s) { const t = s; s = e; e = t; }
  if (monthsBetween(s, e).length > 24) s = addMonths(e, -23);
  P.range = { s, e, preset: preset || "custom" };
  P.month = e;
  emit();
}
export function applyPreset(p) {
  const t = today().slice(0, 7);
  if (p === "month") setRange(t, t, p);
  else if (p === "last") { const l = addMonths(t, -1); setRange(l, l, p); }
  else if (p === "3m") setRange(addMonths(t, -2), t, p);
  else if (p === "6m") setRange(addMonths(t, -5), t, p);
  else if (p === "year") setRange(t.slice(0, 4) + "-01", t.slice(0, 4) + "-12", p);
  else { P.range.preset = "custom"; emit(); }
}
export function setMonth(ym) { P.month = ym; emit(); }
export function setYear(y) { P.year = String(y); emit(); }
export function shiftPeriod(n) {
  if (P.view === "all") { const len = rangeLen(); setRange(addMonths(P.range.s, n * len), addMonths(P.range.e, n * len), "custom"); }
  else if (P.view === "calendar") setMonth(addMonths(P.month, n));
  else if (P.view === "tax") setYear(parseInt(P.year, 10) + n);
}
