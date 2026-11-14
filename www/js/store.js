// 저장소 — 기기 안에 저장 (localStorage) + 변경 알림.
// 나중에 클라우드 동기화를 붙일 때 이 파일만 바꾸면 되도록 화면 코드는 여기 함수만 쓴다.
import { normEntry, normPay, docFromEntry, normSettings } from "./data.js";
import { SEED_ENTRIES, SEED_SETTINGS } from "./seed.js";

const KEY = "drapp.v1";
const SCHEMA = 1;

function blank() {
  return { schema: SCHEMA, entries: {}, payouts: {}, settings: { tax: null, withholding: { paid: {} } }, game: null, meta: { created: Date.now(), seeded: false },
    sync: { dirty: {}, tomb: {}, cursor: "1970-01-01T00:00:00.000Z", session: null, lastSync: 0 } };
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
  if (!state.sync) state.sync = { dirty: {}, tomb: {}, cursor: "1970-01-01T00:00:00.000Z", session: null, lastSync: 0 };
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

// ---- 동기화용 변경 추적 ----
function mark(kind, id) { state.sync.dirty[kind + "|" + id] = Date.now(); delete state.sync.tomb[kind + "|" + id]; }
function markDel(kind, id) { state.sync.dirty[kind + "|" + id] = Date.now(); state.sync.tomb[kind + "|" + id] = true; }
export function dirtyDocs() {
  const out = [];
  Object.keys(state.sync.dirty).forEach(k => {
    const [kind, id] = k.split("|");
    if (state.sync.tomb[k]) { out.push({ kind, id, data: {}, deleted: true }); return; }
    let data = null;
    if (kind === "entry") data = state.entries[id]; else if (kind === "payout") data = state.payouts[id];
    else if (kind === "settings") data = id === "tax" ? state.settings.tax : state.settings.withholding;
    else if (kind === "game") data = state.game;
    if (data) out.push({ kind, id, data, deleted: false });
  });
  return out;
}
export function clearDirty(keys, since) {
  keys.forEach(k => { if (!since || !(state.sync.dirty[k] > since)) { delete state.sync.dirty[k]; delete state.sync.tomb[k]; } });
  persist();
}
export function isDirty(kind, id) { return !!state.sync.dirty[kind + "|" + id]; }
export function markAllDirty() {
  Object.keys(state.entries).forEach(id => mark("entry", id));
  Object.keys(state.payouts).forEach(id => mark("payout", id));
  if (state.settings.tax) mark("settings", "tax");
  mark("settings", "withholding");
  if (state.game) mark("game", "main");
  persist();
}
// 서버에서 받은 문서 적용 (로컬에서 아직 안 올린 변경이 있으면 로컬 우선)
export function applyRemote(rows) {
  let n = 0;
  rows.forEach(r => {
    const key = r.kind + "|" + r.id;
    if (state.sync.dirty[key]) return;
    if (r.kind === "entry") { if (r.deleted) delete state.entries[r.id]; else state.entries[r.id] = r.data; }
    else if (r.kind === "payout") { if (r.deleted) delete state.payouts[r.id]; else state.payouts[r.id] = r.data; }
    else if (r.kind === "settings") { if (r.id === "tax") state.settings.tax = r.deleted ? null : r.data; else if (r.id === "withholding") state.settings.withholding = r.deleted ? { paid: {} } : r.data; }
    else if (r.kind === "game") { if (!r.deleted) state.game = mergeGame(state.game, r.data); }
    n++;
  });
  if (n) { persist(); emit("all"); }
  return n;
}
function mergeGame(a, b) {
  if (!a) return b; if (!b) return a;
  // 기기 둘 다에서 쌓였을 수 있으니 큰 쪽 기준으로 합친다
  const g = Object.assign({}, a.xp >= b.xp ? a : b);
  g.xp = Math.max(a.xp || 0, b.xp || 0); g.best = Math.max(a.best || 0, b.best || 0);
  g.days = Object.assign({}, b.days || {}, a.days || {});
  Object.keys(b.days || {}).forEach(d => { g.days[d] = Math.max(a.days && a.days[d] || 0, b.days[d] || 0); });
  const seen = new Set(); g.log = (a.log || []).concat(b.log || []).filter(x => { const k = x.t + "|" + x.xp; if (seen.has(k)) return false; seen.add(k); return true; }).sort((x, y) => y.t - x.t).slice(0, 60);
  g.flags = Object.assign({}, b.flags || {}, a.flags || {});
  return g;
}
export function syncState() { return state.sync; }
export function setSession(sess) { state.sync.session = sess; persistNow(); emit("session"); }
export function setCursor(c) { state.sync.cursor = c; state.sync.lastSync = Date.now(); persist(); }

// ---- 기록 ----
export function allEntries() { return Object.keys(state.entries).map(id => normEntry(id, state.entries[id])); }
export function entriesIn(months) { const set = new Set(months); return allEntries().filter(e => set.has(e.d.slice(0, 7))); }
export function entriesYear(y) { return allEntries().filter(e => e.d.slice(0, 4) === y); }
export function getEntry(id) { return state.entries[id] ? normEntry(id, state.entries[id]) : null; }
export function upsertEntry(id, doc) { doc.u = Date.now(); state.entries[id] = doc; mark("entry", id); persist(); emit("entries"); }
export function upsertEntryObj(e) { upsertEntry(e.id, docFromEntry(e)); }
export function deleteEntry(id) { delete state.entries[id]; markDel("entry", id); persist(); emit("entries"); }
export function fixedEntries() { return allEntries().filter(e => e.fixed); }

// ---- 원천징수 지급 ----
export function allPays() { return Object.keys(state.payouts).map(id => normPay(id, state.payouts[id])); }
export function paysYear(y) { return allPays().filter(p => p.d.slice(0, 4) === y); }
export function paysIn(months) { const set = new Set(months); return allPays().filter(p => set.has(p.m)); }
export function upsertPay(id, doc) { doc.u = Date.now(); state.payouts[id] = doc; mark("payout", id); persist(); emit("payouts"); }
export function deletePay(id) { delete state.payouts[id]; markDel("payout", id); persist(); emit("payouts"); }

// ---- 설정 ----
export function taxSettings() { return normSettings(state.settings.tax); }
export function hasTaxSettings() { return !!state.settings.tax; }
export function saveTaxSettings(s) { state.settings.tax = s; mark("settings", "tax"); persist(); emit("settings"); }
export function whPaid() { return (state.settings.withholding && state.settings.withholding.paid) || {}; }
export function toggleWhPaid(key) {
  const next = Object.assign({}, whPaid());
  if (next[key]) delete next[key]; else next[key] = true;
  state.settings.withholding = { paid: next }; mark("settings", "withholding"); persist(); emit("settings");
}

// ---- 게임 ----
export function gameState() { return state.game; }
export function saveGame(g) { state.game = g; mark("game", "main"); persist(); emit("game"); }

// ---- 백업 ----
export function exportJSON() { const c = Object.assign({}, state, { exportedAt: new Date().toISOString(), app: "daejeon-rental-app" }); delete c.sync; return JSON.stringify(c, null, 1); }
export function importJSON(text, mode) {
  const s = JSON.parse(text);
  if (!s || typeof s !== "object" || !s.entries || typeof s.entries !== "object") throw new Error("가계부 백업 파일이 아니야");
  if (mode === "replace") {
    state = { schema: SCHEMA, entries: s.entries || {}, payouts: s.payouts || {}, settings: s.settings || { tax: null, withholding: { paid: {} } }, game: s.game || state.game, meta: s.meta || state.meta, sync: state.sync };
  } else {
    Object.assign(state.entries, s.entries || {});
    Object.assign(state.payouts, s.payouts || {});
    if (s.settings && s.settings.tax) state.settings.tax = s.settings.tax;
    if (s.settings && s.settings.withholding) state.settings.withholding = s.settings.withholding;
  }
  if (!state.settings.withholding) state.settings.withholding = { paid: {} };
  if (!state.sync) state.sync = { dirty: {}, tomb: {}, cursor: "1970-01-01T00:00:00.000Z", session: null, lastSync: 0 };
  if (mode === "replace") { state.sync.dirty = {}; state.sync.tomb = {}; }
  markAllDirty();
  persistNow(); emit("all");
  return { entries: Object.keys(s.entries || {}).length, payouts: Object.keys(s.payouts || {}).length };
}
export function counts() { return { entries: Object.keys(state.entries).length, payouts: Object.keys(state.payouts).length }; }
export function rawState() { return state; }
