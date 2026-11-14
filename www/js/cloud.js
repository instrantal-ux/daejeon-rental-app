// 서버 연동 (Supabase) — 라이브러리 없이 fetch 로: 로그인, 동기화, 랭킹
import { SUPABASE_URL, SUPABASE_KEY } from "./config.js";
import * as S from "./store.js";

const AUTH = SUPABASE_URL + "/auth/v1", REST = SUPABASE_URL + "/rest/v1";
let syncing = false, timer = null;
const listeners = new Set();
export function onCloud(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function notify(ev) { listeners.forEach(fn => { try { fn(ev); } catch (e) { console.error(e); } }); }

export function session() { return S.syncState().session; }
export function user() { const s = session(); return s && s.user ? s.user : null; }
export function isOnline() { return typeof navigator === "undefined" ? true : navigator.onLine !== false; }

async function authFetch(path, body) {
  const r = await fetch(AUTH + path, { method: "POST", headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(koAuthError(j));
  return j;
}
function koAuthError(j) {
  const m = String((j && (j.msg || j.message || j.error_description || j.error_code || j.error)) || "");
  if (/invalid login credentials|invalid_credentials/i.test(m)) return "이메일이나 비밀번호가 틀렸어";
  if (/already registered|user_already_exists/i.test(m)) return "이미 가입된 이메일이야. 로그인으로 들어가";
  if (/password.*(short|least)|weak_password/i.test(m)) return "비밀번호는 6자 이상";
  if (/email.*not.*confirmed|email_not_confirmed/i.test(m)) return "이메일 확인이 안 됐어. 메일함(스팸함도)에서 확인 링크를 눌러";
  if (/rate limit|over_email_send_rate/i.test(m)) return "잠깐 너무 많이 시도했어. 1분 뒤에 다시";
  if (/invalid.*email|validation_failed/i.test(m)) return "이메일 형식이 이상해";
  if (/signups? not allowed|signup_disabled/i.test(m)) return "지금은 가입이 막혀 있어 (서버 설정)";
  if (/refresh_token|session/i.test(m)) return "로그인이 만료됐어. 다시 로그인";
  return m || "서버가 응답하지 않아";
}
function storeSession(j) {
  if (!j || !j.access_token) throw new Error("로그인 정보가 비어 있어");
  const sess = { access_token: j.access_token, refresh_token: j.refresh_token, expires_at: (j.expires_at ? j.expires_at * 1000 : Date.now() + (j.expires_in || 3600) * 1000), user: { id: j.user.id, email: j.user.email } };
  S.setSession(sess); return sess;
}
export async function signUp(email, password) {
  const j = await authFetch("/signup", { email, password });
  if (!j.access_token) return { needConfirm: true };           // 이메일 확인이 켜져 있으면 세션이 안 온다
  storeSession(j); await afterLogin(); return { needConfirm: false };
}
export async function signIn(email, password) { const j = await authFetch("/token?grant_type=password", { email, password }); storeSession(j); await afterLogin(); }
export async function resetPassword(email) { await authFetch("/recover", { email }); }
export async function signOut() {
  const s = session();
  if (s) { try { await fetch(AUTH + "/logout", { method: "POST", headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + s.access_token } }); } catch (e) { /* 무시 */ } }
  S.setSession(null); notify({ type: "logout" });
}
async function token() {
  const s = session(); if (!s) return null;
  if (Date.now() < s.expires_at - 60000) return s.access_token;
  try { const j = await authFetch("/token?grant_type=refresh_token", { refresh_token: s.refresh_token }); return storeSession(j).access_token; }
  catch (e) { S.setSession(null); notify({ type: "logout", reason: "expired" }); return null; }
}
async function rest(method, path, body, prefer) {
  const t = await token(); if (!t) throw new Error("로그인이 필요해");
  const h = { apikey: SUPABASE_KEY, Authorization: "Bearer " + t, "Content-Type": "application/json" };
  if (prefer) h.Prefer = prefer;
  const r = await fetch(REST + path, { method, headers: h, body: body == null ? undefined : JSON.stringify(body) });
  if (r.status === 204) return null;
  const j = await r.json().catch(() => null);
  if (!r.ok) {
    const m = j && (j.message || j.hint || j.details) || ("서버 오류 " + r.status);
    if (/relation .* does not exist|schema cache|PGRST205|42P01/.test(m)) throw new Error("서버에 표(테이블)가 아직 없어. 설정 안내대로 SQL 을 한 번 실행해야 해");
    throw new Error(m);
  }
  return j;
}

// 첫 로그인: 이 기기 기록을 전부 올릴 대상으로 표시하고 동기화
async function afterLogin() { S.markAllDirty(); await ensureProfile(); await sync(); notify({ type: "login" }); }

async function ensureProfile() {
  const u = user(); if (!u) return;
  const g = S.gameState() || {};
  const rows = await rest("GET", "/profiles?id=eq." + u.id + "&select=id,nickname");
  if (!rows || !rows.length) await rest("POST", "/profiles", [{ id: u.id, nickname: (g.name || "사장님").slice(0, 12) }], "return=minimal");
}

// ---- 동기화: 받기(커서 이후) → 보내기(변경분) → 프로필 ----
export async function sync(opts) {
  opts = opts || {};
  if (!session() || syncing || !isOnline()) return { skipped: true };
  syncing = true; notify({ type: "start" });
  try {
    const u = user();
    const cursor = S.syncState().cursor;
    const got = await rest("GET", "/ledger_docs?user_id=eq." + u.id + "&updated_at=gt." + encodeURIComponent(cursor) + "&order=updated_at.asc&limit=2000");
    let newCursor = cursor;
    if (got && got.length) { S.applyRemote(got); newCursor = got[got.length - 1].updated_at; }
    const dirty = S.dirtyDocs();
    const started = Date.now();
    if (dirty.length) {
      const rows = dirty.map(d => ({ user_id: u.id, kind: d.kind, id: d.id, data: d.data, deleted: d.deleted }));
      for (let i = 0; i < rows.length; i += 200) await rest("POST", "/ledger_docs?on_conflict=user_id,kind,id", rows.slice(i, i + 200), "resolution=merge-duplicates,return=minimal");
      S.clearDirty(dirty.map(d => d.kind + "|" + d.id), started);
      // 방금 올린 것들의 updated_at 이 커서보다 뒤라 다음에 또 받게 되는데, dirty 가 아니면 같은 값이라 무해하다
    }
    if (newCursor !== cursor) S.setCursor(newCursor); else S.setCursor(cursor);
    await pushProfile();
    notify({ type: "done", pulled: got ? got.length : 0, pushed: dirty.length });
    return { pulled: got ? got.length : 0, pushed: dirty.length };
  } catch (e) {
    notify({ type: "error", message: e.message });
    if (!opts.quiet) throw e;
    return { error: e.message };
  } finally { syncing = false; }
}
export async function pushProfile() {
  const u = user(); if (!u) return;
  const g = S.gameState(); if (!g) return;
  const { levelFor } = await import("./game.js");
  const { streakOf, todayCount } = await import("./game.js");
  const body = { id: u.id, nickname: (g.name || "사장님").slice(0, 12), level: levelFor(g.xp), xp: g.xp, streak: streakOf(g.days), best: g.best, today_count: todayCount(g), last_active: new Date().toISOString().slice(0, 10), updated_at: new Date().toISOString() };
  await rest("POST", "/profiles?on_conflict=id", [body], "resolution=merge-duplicates,return=minimal");
}
export async function leaderboard(limit) {
  const t = await token();
  const h = { apikey: SUPABASE_KEY }; if (t) h.Authorization = "Bearer " + t;
  const r = await fetch(REST + "/profiles?select=id,nickname,level,xp,streak,best,last_active&order=xp.desc&limit=" + (limit || 30), { headers: h });
  if (!r.ok) throw new Error("랭킹을 못 불러왔어");
  return r.json();
}

// 주기적 동기화 (화면 보이는 동안 90초마다) + 변경 직후 짧게
export function startAuto() {
  stopAuto();
  timer = setInterval(() => { if (document.visibilityState === "visible") sync({ quiet: true }); }, 90000);
}
export function stopAuto() { if (timer) clearInterval(timer); timer = null; }
let soon = null;
export function syncSoon() { if (!session()) return; clearTimeout(soon); soon = setTimeout(() => sync({ quiet: true }), 2500); }
