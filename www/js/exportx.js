// 내보내기(엑셀·CSV)·백업·복원 — 폰에서는 공유 창, 웹에서는 다운로드
import * as D from "./data.js";
import * as S from "./store.js";
import { $, el, msgAt, nativePlugin } from "./ui.js";
import { P, rangeMonths } from "./period.js";

const { won, today, bookOf, BOOK_LABEL, SEG_LABEL, PROOF_LABEL, KIND_LABEL, PAY_KINDS, BK_NAME } = D;
let hooks = { onAction: () => {} };

const plugin = nativePlugin;

function b64FromString(str) { return btoa(unescape(encodeURIComponent(str))); }
async function deliver(filename, base64, mime, title) {
  const fs = plugin("Filesystem"), sh = plugin("Share");
  if (fs && sh) {
    const w = await fs.writeFile({ path: filename, data: base64, directory: "CACHE" });
    await sh.share({ title: title || filename, files: [w.uri], dialogTitle: "어디로 보낼까?" });
    return "shared";
  }
  const bin = atob(base64), bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
  const a = document.createElement("a"); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return "downloaded";
}

function pickEntries(mode) {
  const y = today().slice(0, 4);
  if (mode === "year") return { label: y + "년", e: S.entriesYear(y), p: S.paysYear(y) };
  if (mode === "last") { const ly = String(+y - 1); return { label: ly + "년", e: S.entriesYear(ly), p: S.paysYear(ly) }; }
  if (mode === "range") { const ms = rangeMonths(); return { label: ms[0] + (ms.length > 1 ? "~" + ms[ms.length - 1] : ""), e: S.entriesIn(ms), p: S.paysIn(ms) }; }
  return { label: "전체", e: S.allEntries(), p: S.allPays() };
}
function rowsOf(entries) {
  const head = ["날짜", "장부", "구분", "분류", "부문", "메모", "금액", "고정비", "증빙", "경비인정", "과세구분", "3.3%뗀금액"];
  const rows = entries.sort((a, b) => a.d < b.d ? -1 : a.d > b.d ? 1 : a.ts - b.ts).map(x => [
    x.d, BOOK_LABEL[bookOf(x)], x.t === "in" ? "수입" : "지출", x.cat, x.biz && !x.place ? (SEG_LABEL[x.seg] || "") : "", x.memo,
    x.t === "in" ? x.amt : -x.amt, x.fixed ? "O" : "", x.biz && x.t === "out" ? PROOF_LABEL[x.proof] : "", x.biz && x.t === "out" ? (x.ded ? "O" : "X") : "",
    x.biz && x.t === "in" ? KIND_LABEL[x.kind] : "", x.biz && x.t === "in" && x.wh ? "O" : "",
  ]);
  return [head].concat(rows);
}
function monthlyRows(entries, pays) {
  const by = {};
  entries.forEach(x => { const k = x.d.slice(0, 7) + "|" + bookOf(x); const b = by[k] = by[k] || { i: 0, o: 0 }; if (x.t === "in") b.i += x.amt; else b.o += x.amt; });
  pays.forEach(p => { const k = p.m + "|" + (p.bk === "other" ? "other" : "rental"); const b = by[k] = by[k] || { i: 0, o: 0 }; b.o += p.gross; });
  const rows = [["월", "장부", "수입", "지출", "남는 돈"]];
  Object.keys(by).sort().forEach(k => { const [m, bk] = k.split("|"), b = by[k]; rows.push([m, BOOK_LABEL[bk], b.i, b.o, b.i - b.o]); });
  return rows;
}
function payRows(pays) {
  const rows = [["지급일", "받는 사람", "소득구분", "사업", "세전 지급액", "소득세", "지방소득세", "실지급액", "근무일수", "메모"]];
  pays.sort((a, b) => a.d < b.d ? -1 : 1).forEach(p => rows.push([p.d, p.name, PAY_KINDS[p.kind], BK_NAME[p.bk], p.gross, p.tax, p.local, p.net, p.kind === "daily" ? p.days : "", p.memo]));
  return rows;
}
function taxRows(year) {
  const c = D.computeTax(S.entriesYear(year), S.paysYear(year), S.rawState().settings.tax), s = c.s;
  const r = n => Math.round(n);
  return [["항목", "금액(원)"],
    ["귀속연도", year], ["과세유형", s.vatType === "general" ? "일반과세" : s.vatType === "simple" ? "간이과세 (부가가치율 " + s.vatRate + "%)" : "면세·미등록"],
    ["과세 매출", r(c.T)], ["면세 매출", r(c.E)], ["기타 수입", r(c.O)], ["수입금액 합계", r(c.income)],
    ["경비로 잡은 지출", r(c.dedAll - c.payGross)], ["인건비·외주비(원천징수 지급)", r(c.payGross)], ["적격증빙 경비", r(c.dedProof)], ["증빙 없는 3만 초과 경비", r(c.noProofSum)],
    ["필요경비 합계", r(c.expense)], ["소득금액", r(c.net)], ["기본공제", -D.BASIC_DED * s.deps], ["국민연금", -s.pension], ["노란우산", -r(c.umbrellaUsed)],
    ["과세표준", r(c.base)], ["산출세액", r(c.calc)], ["세액공제", -r(c.credits)], ["결정세액", r(c.determined)], ["기납부(원천징수 3%)", -r(c.whTax)], ["중간예납", -s.prepaid],
    ["소득세 납부(환급) 예상", r(c.dueTax)], ["지방소득세 납부(환급) 예상", r(c.dueLocal)], ["부가세 납부 예상", c.vatExempt ? 0 : r(c.vatDue)],
    ["※", "장부 기록 기준 예상치. 신고 전 세무사 확인 필요."]];
}

export async function exportXlsx(mode) {
  if (!window.XLSX) throw new Error("엑셀 모듈이 아직 안 불러와졌어. 잠깐 뒤에 다시");
  const X = window.XLSX, sel = pickEntries(mode);
  const wb = X.utils.book_new();
  const sh1 = X.utils.aoa_to_sheet(rowsOf(sel.e)); sh1["!cols"] = [{ wch: 11 }, { wch: 12 }, { wch: 5 }, { wch: 14 }, { wch: 8 }, { wch: 32 }, { wch: 12 }, { wch: 6 }, { wch: 10 }, { wch: 8 }, { wch: 8 }, { wch: 9 }];
  X.utils.book_append_sheet(wb, sh1, "전체 기록");
  const sh2 = X.utils.aoa_to_sheet(monthlyRows(sel.e, sel.p)); sh2["!cols"] = [{ wch: 9 }, { wch: 12 }, { wch: 13 }, { wch: 13 }, { wch: 13 }];
  X.utils.book_append_sheet(wb, sh2, "월별 집계");
  const sh3 = X.utils.aoa_to_sheet(payRows(sel.p)); sh3["!cols"] = [{ wch: 11 }, { wch: 12 }, { wch: 9 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 7 }, { wch: 24 }];
  X.utils.book_append_sheet(wb, sh3, "원천징수 지급");
  const year = mode === "last" ? String(+today().slice(0, 4) - 1) : today().slice(0, 4);
  const sh4 = X.utils.aoa_to_sheet(taxRows(year)); sh4["!cols"] = [{ wch: 28 }, { wch: 16 }];
  X.utils.book_append_sheet(wb, sh4, "세무 요약 " + year);
  const b64 = X.write(wb, { bookType: "xlsx", type: "base64" });
  const fn = "가계부_" + sel.label.replace(/[^0-9가-힣~_-]/g, "") + "_" + today() + ".xlsx";
  const how = await deliver(fn, b64, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "가계부 엑셀");
  hooks.onAction("export", {});
  return { fn, how, n: sel.e.length };
}
export async function exportCsv(mode) {
  const sel = pickEntries(mode);
  const csv = "﻿" + rowsOf(sel.e).map(r => r.map(v => { const s = String(v == null ? "" : v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(",")).join("\r\n");
  const fn = "가계부_" + sel.label.replace(/[^0-9가-힣~_-]/g, "") + "_" + today() + ".csv";
  const how = await deliver(fn, b64FromString(csv), "text/csv", "가계부 CSV");
  hooks.onAction("export", {});
  return { fn, how, n: sel.e.length };
}
export async function backup() {
  const fn = "가계부백업_" + today() + ".json";
  const how = await deliver(fn, b64FromString(S.exportJSON()), "application/json", "가계부 백업");
  hooks.onAction("backup", {});
  return { fn, how };
}
export function restoreFromFile(file, mode) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => { try { resolve(S.importJSON(String(fr.result), mode)); } catch (e) { reject(e); } };
    fr.onerror = () => reject(new Error("파일을 못 읽었어"));
    fr.readAsText(file);
  });
}

export function renderMore() {
  if (P.view !== "more") return;
  const c = S.counts();
  $("appCounts").textContent = "기록 " + c.entries + "건 · 지급 " + c.payouts + "건";
  $("appVer").textContent = (window.APP_VERSION || "dev") + (window.APP_BUILD ? " (" + window.APP_BUILD + ")" : "");
  const g = S.gameState();
  $("backupInfo").textContent = g && g.lastBackup ? "마지막 백업: " + g.lastBackup : "아직 백업한 적 없어.";
}

export function initMore(h) {
  hooks = Object.assign(hooks, h || {});
  $("xlsxBtn").addEventListener("click", async () => {
    const b = $("xlsxBtn"); b.disabled = true;
    try { const r = await exportXlsx($("xRange").value); msgAt("xMsg", r.n + "건 → " + r.fn + (r.how === "shared" ? " 공유했어" : " 내려받았어"), true); }
    catch (e) { msgAt("xMsg", "실패: " + (e && e.message ? e.message : e)); }
    finally { b.disabled = false; }
  });
  $("csvBtn").addEventListener("click", async () => {
    try { const r = await exportCsv($("xRange").value); msgAt("xMsg", r.n + "건 → " + r.fn, true); }
    catch (e) { msgAt("xMsg", "실패: " + (e && e.message ? e.message : e)); }
  });
  $("backupBtn").addEventListener("click", async () => {
    try { const r = await backup(); msgAt("bMsg", r.fn + (r.how === "shared" ? " 공유 창에서 드라이브나 카톡으로 보내 둬" : " 내려받았어"), true); renderMore(); }
    catch (e) { msgAt("bMsg", "실패: " + (e && e.message ? e.message : e)); }
  });
  $("restoreBtn").addEventListener("click", () => $("restoreFile").click());
  $("restoreFile").addEventListener("change", async e => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    const replace = confirm("백업 내용으로 지금 기록을 덮어쓸까?\n\n확인 = 덮어쓰기(백업 상태로 복원)\n취소 = 합치기(백업에 있는 것만 추가·갱신)");
    try { const r = await restoreFromFile(f, replace ? "replace" : "merge"); msgAt("bMsg", "복원했어: 기록 " + r.entries + "건, 지급 " + r.payouts + "건", true); renderMore(); hooks.onRestore && hooks.onRestore(); }
    catch (err) { msgAt("bMsg", "복원 실패: " + (err && err.message ? err.message : err)); }
    e.target.value = "";
  });
  $("wipeBtn").addEventListener("click", () => {
    if (!confirm("정말 모든 기록을 지울까? 백업 먼저 해두는 게 좋아.")) return;
    if (!confirm("마지막 확인. 지우면 되돌릴 수 없어.")) return;
    S.importJSON(JSON.stringify({ entries: {}, payouts: {}, settings: { tax: null, withholding: { paid: {} } } }), "replace");
    msgAt("wMsg", "다 지웠어", true); renderMore(); hooks.onRestore && hooks.onRestore();
  });
}
