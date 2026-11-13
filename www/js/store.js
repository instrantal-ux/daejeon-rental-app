// 저장소 — 기기 안에 저장 (localStorage) + 변경 알림.
// 나중에 클라우드 동기화를 붙일 때 이 파일만 바꾸면 되도록 화면 코드는 여기 함수만 쓴다.
import { normEntry, normPay, docFromEntry, normSettings } from "./data.js";
import { SEED_ENTRIES, SEED_SETTINGS } from "./seed.js";

const KEY = "drapp.v1";
const SCHEMA = 1;

function blank() {
  return { schema: SCHEMA, entries: {}, payouts: {}, settings: { tax: null, withholding: { paid: {} } }, game: null, meta: { created: Date.now(), seeded: false } };
}

let state = null;
const subs = new Set();
let saveTimer = null;
let onPersist = null; // 플랫폼(안드로이드)별 추가 백업 훅

function read() {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(KEY) : null;
    if (raw) { const s = JSON.parse(raw); if (s && typeof s === "object") return s; }
  } catch (e) { /* 깨진 저장은 무시 */ }
  return null;
}

export function init() {
  state = read();
  if (!state) {
    state = blank();
    // 처음 실행: 옛 가계부 기록 넣기
    Object.keys(SEED_ENTRIES).forEach(id => { state.entries[id] = Object.assign({}, SEED_ENTRIES[id]); });
    state.settings.withholding = SEED_SETTINGS.withholding;
    state.meta.seeded = true;
    persistNow();
  }
  if (!state.settings) state.settings = { tax: null, withholding: { paid: {} } };
  if (!state.settings.withholding) state.settings.withholding = { paid: {} };
  if (!state.meta) state.meta = { created: Date.now(), seeded: true };
  return state;
}

export function setPersistHook(fn) { onPersist = fn; }

function persistNow() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { console.warn("저장 실패", e); }
  if (onPersist) { try { onPersist(JSON.stringify(state)); } catch (e) { /* 무시 */ } }
}
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(persistNow, 150);
}
export function flush() { clearTimeout(saveTimer); persistNow(); }

export function subscribe(fn) { subs.add(fn); return () => subs.delete(fn); }
function emit(what) { subs.forEach(fn => { try { fn(what); } catch (e) { console.error(e); } }); }

// ---- 기록 ----
export function allEntries() { return Object.keys(state.entries).map(id => normEntry(id, state.entries[id])); }
export function entriesIn(months) { const set = new Set(months); return allEntries().filter(e => set.has(e.d.slice(0, 7))); }
export function entriesYear(y) { return allEntries().filter(e => e.d.slice(0, 4) === y); }
export function getEntry(id) { return state.entries[id] ? normEntry(id, state.entries[id]) : null; }
export function upsertEntry(id, doc) { state.entries[id] = doc; persist(); emit("entries"); }
export function upsertEntryObj(e) { upsertEntry(e.id, docFromEntry(e)); }
export function deleteEntry(id) { delete state.entries[id]; persist(); emit("entries"); }
export function fixedEntries() { return allEntries().filter(e => e.fixed); }

// ---- 원천징수 지급 ----
export function allPays() { return Object.keys(state.payouts).map(id => normPay(id, state.payouts[id])); }
export function paysYear(y) { return allPays().filter(p => p.d.slice(0, 4) === y); }
export function paysIn(months) { const set = new Set(months); return allPays().filter(p => set.has(p.m)); }
export function upsertPay(id, doc) { state.payouts[id] = doc; persist(); emit("payouts"); }
export function deletePay(id) { delete state.payouts[id]; persist(); emit("payouts"); }

// ---- 설정 ----
export function taxSettings() { return normSettings(state.settings.tax); }
export function hasTaxSettings() { return !!state.settings.tax; }
export function saveTaxSettings(s) { state.settings.tax = s; persist(); emit("settings"); }
export function whPaid() { return (state.settings.withholding && state.settings.withholding.paid) || {}; }
export function toggleWhPaid(key) {
  const next = Object.assign({}, whPaid());
  if (next[key]) delete next[key]; else next[key] = true;
  state.settings.withholding = { paid: next }; persist(); emit("settings");
}

// ---- 게임 ----
export function gameState() { return state.game; }
export function saveGame(g) { state.game = g; persist(); emit("game"); }

// ---- 백업 ----
export function exportJSON() { return JSON.stringify(Object.assign({}, state, { exportedAt: new Date().toISOString(), app: "daejeon-rental-app" }), null, 1); }
export function importJSON(text, mode) {
  const s = JSON.parse(text);
  if (!s || typeof s !== "object" || !s.entries || typeof s.entries !== "object") throw new Error("가계부 백업 파일이 아니야");
  if (mode === "replace") {
    state = { schema: SCHEMA, entries: s.entries || {}, payouts: s.payouts || {}, settings: s.settings || { tax: null, withholding: { paid: {} } }, game: s.game || state.game, meta: s.meta || state.meta };
  } else {
    Object.assign(state.entries, s.entries || {});
    Object.assign(state.payouts, s.payouts || {});
    if (s.settings && s.settings.tax) state.settings.tax = s.settings.tax;
    if (s.settings && s.settings.withholding) state.settings.withholding = s.settings.withholding;
  }
  if (!state.settings.withholding) state.settings.withholding = { paid: {} };
  persistNow(); emit("all");
  return { entries: Object.keys(s.entries || {}).length, payouts: Object.keys(s.payouts || {}).length };
}
export function counts() { return { entries: Object.keys(state.entries).length, payouts: Object.keys(state.payouts).length }; }
export function rawState() { return state; }
