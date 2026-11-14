// 서버 연동 — 로그인(Supabase Auth), 진행 저장(pw_saves), 랭킹(pw_players). 라이브러리 없이 fetch.
import { SUPABASE_URL, SUPABASE_KEY } from "./config.js";
const AUTH = SUPABASE_URL + "/auth/v1", REST = SUPABASE_URL + "/rest/v1", KEY = "pw.session";
let sess = null;
try { sess = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { sess = null; }
export function user() { return sess && sess.user ? sess.user : null; }
function keep(s) { sess = s; if (s) localStorage.setItem(KEY, JSON.stringify(s)); else localStorage.removeItem(KEY); }

function ko(j) {
  const m = String((j && (j.msg || j.message || j.error_description || j.error_code || j.error)) || "");
  if (/invalid login credentials|invalid_credentials/i.test(m)) return "이메일이나 비밀번호가 틀렸어";
  if (/already registered|user_already_exists/i.test(m)) return "이미 가입된 이메일이야. 로그인해";
  if (/weak_password|password/i.test(m)) return "비밀번호는 6자 이상";
  if (/not.*confirmed/i.test(m)) return "이메일 확인이 안 됐어. 메일함 확인";
  if (/rate limit/i.test(m)) return "잠깐 너무 많이 시도했어. 1분 뒤에";
  if (/invalid.*email|validation_failed/i.test(m)) return "이메일 형식이 이상해";
  return m || "서버가 응답하지 않아";
}
async function auth(path, body) {
  const r = await fetch(AUTH + path, { method: "POST", headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(ko(j)); return j;
}
function store(j) { if (!j.access_token) throw new Error("로그인 정보가 비어 있어"); keep({ access_token: j.access_token, refresh_token: j.refresh_token, expires_at: Date.now() + (j.expires_in || 3600) * 1000, user: { id: j.user.id, email: j.user.email } }); }
export async function signUp(email, password) { if (!email || password.length < 6) throw new Error("이메일과 6자 이상 비밀번호"); const j = await auth("/signup", { email, password }); if (!j.access_token) return { needConfirm: true }; store(j); return { needConfirm: false }; }
export async function signIn(email, password) { if (!email || !password) throw new Error("이메일과 비밀번호를 적어"); store(await auth("/token?grant_type=password", { email, password })); }
export async function signOut() { if (sess) { try { await fetch(AUTH + "/logout", { method: "POST", headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + sess.access_token } }); } catch (e) { /* */ } } keep(null); }
async function token() {
  if (!sess) return null;
  if (Date.now() < sess.expires_at - 60000) return sess.access_token;
  try { store(await auth("/token?grant_type=refresh_token", { refresh_token: sess.refresh_token })); return sess.access_token; } catch (e) { keep(null); return null; }
}
async function rest(method, path, body, prefer) {
  const t = await token(); const h = { apikey: SUPABASE_KEY, "Content-Type": "application/json" }; if (t) h.Authorization = "Bearer " + t; if (prefer) h.Prefer = prefer;
  const r = await fetch(REST + path, { method, headers: h, body: body == null ? undefined : JSON.stringify(body) });
  if (r.status === 204) return null;
  const j = await r.json().catch(() => null);
  if (!r.ok) { const m = j && (j.message || j.hint) || ("서버 오류 " + r.status); if (/does not exist|schema cache|PGRST205/.test(m)) throw new Error("서버에 게임 표가 아직 없어 (설정 SQL 필요)"); throw new Error(m); }
  return j;
}
export async function loadSave() { const u = user(); if (!u) return null; const rows = await rest("GET", "/pw_saves?user_id=eq." + u.id + "&select=data,updated_at"); return rows && rows[0] ? rows[0] : null; }
export async function pushSave(data) { const u = user(); if (!u) return; await rest("POST", "/pw_saves?on_conflict=user_id", [{ user_id: u.id, data, updated_at: new Date().toISOString() }], "resolution=merge-duplicates,return=minimal"); }
export async function pushPlayer(p) { const u = user(); if (!u) return; await rest("POST", "/pw_players?on_conflict=id", [Object.assign({ id: u.id, updated_at: new Date().toISOString() }, p)], "resolution=merge-duplicates,return=minimal"); }
export async function leaderboard(limit) {
  const h = { apikey: SUPABASE_KEY }; const t = await token(); if (t) h.Authorization = "Bearer " + t;
  const r = await fetch(REST + "/pw_players?select=id,nickname,level,score,worlds,distance,updated_at&order=score.desc&limit=" + (limit || 30), { headers: h });
  if (!r.ok) throw new Error(r.status === 404 ? "서버에 게임 표가 아직 없어" : "랭킹 서버 응답 " + r.status);
  return r.json();
}
