// 헤드리스 크롬으로 앱을 띄워 오류를 잡고 화면을 찍는다 (개발용).  node scripts/smoke.mjs
import { spawn } from "node:child_process";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const WWW = path.join(ROOT, "www");
const OUT = path.join(ROOT, "_smoke"); fs.mkdirSync(OUT, { recursive: true });
const PORT = 8765, DBG = 9333;

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".json": "application/json", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml" };
// ---- 가짜 Supabase (동기화 흐름 검증용) ----
const mock = { users: {}, docs: [], profiles: {} };
function readBody(req) { return new Promise(r => { let b = ""; req.on("data", c => b += c); req.on("end", () => r(b ? JSON.parse(b) : null)); }); }
function parseFilters(qs) {
  const f = {}; for (const [k, v] of new URLSearchParams(qs)) { if (["select", "order", "limit", "on_conflict"].includes(k)) f["_" + k] = v; else { const m = v.match(/^(eq|gt|lt)\.(.*)$/); if (m) f[k] = { op: m[1], val: m[2] }; } } return f;
}
function matches(row, f) { return Object.keys(f).every(k => { if (k.startsWith("_")) return true; const { op, val } = f[k]; const rv = String(row[k]); return op === "eq" ? rv === val : op === "gt" ? rv > val : rv < val; }); }
async function mockHandle(req, res, p) {
  const [path, qs = ""] = req.url.replace("/mock", "").split("?");
  const json = (code, obj) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(obj)); };
  const uidOf = () => { const a = req.headers.authorization || ""; const t = a.replace("Bearer ", ""); const e = Object.keys(mock.users).find(u => mock.users[u].token === t); return e ? mock.users[e].id : null; };
  if (path.startsWith("/auth/v1/")) {
    const body = await readBody(req);
    if (path === "/auth/v1/signup") { if (mock.users[body.email]) return json(400, { msg: "User already registered" }); const id = "u-" + Object.keys(mock.users).length; mock.users[body.email] = { id, pw: body.password, token: "tok-" + id }; return json(200, { access_token: "tok-" + id, refresh_token: "ref-" + id, expires_in: 3600, user: { id, email: body.email } }); }
    if (path.startsWith("/auth/v1/token")) { const u = mock.users[body.email]; if (qs.includes("refresh_token")) { const e = Object.keys(mock.users).find(k => "ref-" + mock.users[k].id === body.refresh_token); return e ? json(200, { access_token: mock.users[e].token, refresh_token: body.refresh_token, expires_in: 3600, user: { id: mock.users[e].id, email: e } }) : json(400, { msg: "invalid refresh_token" }); } if (!u || u.pw !== body.password) return json(400, { msg: "Invalid login credentials" }); return json(200, { access_token: u.token, refresh_token: "ref-" + u.id, expires_in: 3600, user: { id: u.id, email: body.email } }); }
    if (path === "/auth/v1/logout") { res.writeHead(204); return res.end(); }
    return json(404, { msg: "nf" });
  }
  if (path.startsWith("/rest/v1/")) {
    const table = path.replace("/rest/v1/", ""), f = parseFilters(qs), uid = uidOf();
    if (table === "ledger_docs" && !uid) return json(401, { message: "JWT" });
    if (req.method === "GET") {
      let rows = table === "ledger_docs" ? mock.docs.filter(d => d.user_id === uid) : Object.values(mock.profiles);
      rows = rows.filter(r => matches(r, f));
      if (f._order) { const [col, dir] = f._order.split("."); rows.sort((a, b) => (a[col] > b[col] ? 1 : -1) * (dir === "desc" ? -1 : 1)); }
      if (f._limit) rows = rows.slice(0, +f._limit);
      return json(200, rows);
    }
    if (req.method === "POST") {
      const body = await readBody(req), now = new Date().toISOString();
      for (const r of body) {
        if (table === "ledger_docs") { if (r.user_id !== uid) return json(403, { message: "RLS" }); const i = mock.docs.findIndex(d => d.user_id === r.user_id && d.kind === r.kind && d.id === r.id); const row = Object.assign({}, r, { updated_at: new Date(Date.now() + 1).toISOString() }); if (i >= 0) mock.docs[i] = row; else mock.docs.push(row); await new Promise(x => setTimeout(x, 2)); }
        else { if (r.id !== uid) return json(403, { message: "RLS" }); mock.profiles[r.id] = Object.assign({}, mock.profiles[r.id] || {}, r, { updated_at: now }); }
      }
      res.writeHead(201); return res.end();
    }
  }
  json(404, { message: "nf" });
}
const server = http.createServer((req, res) => {
  if (req.url.startsWith("/mock/")) return mockHandle(req, res);
  let p = decodeURIComponent(req.url.split("?")[0]); if (p === "/") p = "/index.html";
  const f = path.join(WWW, p);
  if (!f.startsWith(WWW) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end("nf"); return; }
  res.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(PORT, r));

const chrome = spawn("google-chrome", ["--headless=new", "--no-sandbox", "--disable-gpu", "--hide-scrollbars", `--remote-debugging-port=${DBG}`, "--window-size=412,915", "--user-data-dir=/tmp/smoke-profile-" + Date.now(), "about:blank"], { stdio: "ignore" });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let targets = null;
for (let i = 0; i < 40 && !targets; i++) { await sleep(250); try { targets = await (await fetch(`http://127.0.0.1:${DBG}/json`)).json(); } catch { } }
const page = targets.find(t => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 0; const pending = new Map(); const errors = []; const logs = [];
ws.onmessage = ev => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
  if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
  if (m.method === "Runtime.consoleAPICalled") { const t = m.params.args.map(a => a.value ?? a.description).join(" "); logs.push(m.params.type + ": " + t); if (m.params.type === "error") errors.push(t); }
  if (m.method === "Log.entryAdded" && m.params.entry.level === "error") errors.push("[" + m.params.entry.source + "] " + m.params.entry.text + " " + (m.params.entry.url || ""));
};
const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send("Runtime.enable"); await send("Log.enable"); await send("Page.enable");
await send("Page.addScriptToEvaluateOnNewDocument", { source: `(() => { const of = window.fetch; window.fetch = (u, o) => { u = String(u); if (u.startsWith("https://gayojgyqrnejwfijbvls.supabase.co")) u = u.replace("https://gayojgyqrnejwfijbvls.supabase.co", "http://127.0.0.1:${PORT}/mock"); return of(u, o); }; if (sessionStorage.getItem("wipe")) { sessionStorage.removeItem("wipe"); localStorage.removeItem("drapp.v1"); } })();` });
await send("Emulation.setDeviceMetricsOverride", { width: 412, height: 915, deviceScaleFactor: 2, mobile: true });

const ev = async (expr) => { const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result.exceptionDetails) errors.push("eval: " + (r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text)); return r.result.result?.value; };
const shot = async (name, full) => {
  if (full) { const h = await ev("document.documentElement.scrollHeight"); await send("Emulation.setDeviceMetricsOverride", { width: 412, height: Math.min(h, 4000), deviceScaleFactor: 2, mobile: true }); }
  const r = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(OUT, name + ".png"), Buffer.from(r.result.data, "base64"));
  if (full) await send("Emulation.setDeviceMetricsOverride", { width: 412, height: 915, deviceScaleFactor: 2, mobile: true });
};

await send("Page.navigate", { url: `http://127.0.0.1:${PORT}/index.html#home` });
await sleep(1200);
await shot("01-home", true);
// 장부: 기록 하나 넣기
await ev("location.hash='#all'"); await sleep(300);
await shot("02-ledger-empty", true);
await ev(`(() => { const $=id=>document.getElementById(id);
  document.querySelector('#bookChips button:nth-child(1)').click();   // 대전악기렌탈
  $('segIn').click();
  $('amt').value='350,000'; $('memo').value='테스트 렌탈 수입';
  document.querySelector('#chips button').click();
  $('form').requestSubmit(); return 'ok'; })()`);
await sleep(400);
await ev(`(() => { const $=id=>document.getElementById(id);
  $('segOut').click(); $('amt').value='48,000'; $('memo').value='기타줄 구입';
  Array.from(document.querySelectorAll('#chips button')).find(b=>b.textContent.includes('수리')).click();
  $('form').requestSubmit(); return 'ok'; })()`);
await sleep(400);
await shot("03-ledger-after", true);
await ev("document.querySelector('#presets button[data-p=year]').click()"); await sleep(300);
await shot("04-ledger-year", true);
await ev("location.hash='#calendar'"); await sleep(300); await shot("05-calendar", true);
await ev("location.hash='#tax'"); await sleep(300);
await ev(`(() => { const $=id=>document.getElementById(id); $('payName').value='김세션'; $('payAmt').value='300,000'; $('payAmt').dispatchEvent(new Event('input')); $('payForm').requestSubmit(); return 'ok'; })()`);
await sleep(400);
await shot("06-tax", true);
await ev("location.hash='#more'"); await sleep(300); await shot("07-more", true);
await shot("07-more-loggedout", true);
await ev(`(() => { document.getElementById('acEmail').value='test@example.com'; document.getElementById('acPw').value='secret1'; Array.from(document.querySelectorAll('#acctBox button')).find(b=>b.textContent.includes('가입')).click(); return 'ok'; })()`);
await sleep(3500);
await shot("07b-more-loggedin", true);
const afterJoin = await ev("JSON.stringify({dirty:Object.keys(JSON.parse(localStorage.getItem('drapp.v1')).sync.dirty).length, user: JSON.parse(localStorage.getItem('drapp.v1')).sync.session && JSON.parse(localStorage.getItem('drapp.v1')).sync.session.user.email})");
console.log("after join:", afterJoin, "| server docs:", mock.docs.length, "profiles:", Object.keys(mock.profiles).length);
// 두 번째 기기 흉내: 저장소 비우고 로그인 → 서버 기록이 내려와야 함
await ev("sessionStorage.setItem('wipe','1')");
await send("Page.reload"); await sleep(1200);
console.log("wiped entries:", await ev("Object.keys(JSON.parse(localStorage.getItem('drapp.v1')).entries).length"), "(기대: 35 시드만)");
await ev("location.hash='#more'"); await sleep(300);
await ev(`(() => { document.getElementById('acEmail').value='test@example.com'; document.getElementById('acPw').value='secret1'; Array.from(document.querySelectorAll('#acctBox button')).find(b=>b.textContent.trim()==='로그인').click(); return 'ok'; })()`);
await sleep(1500);
const afterLogin = await ev("JSON.stringify({entries:Object.keys(JSON.parse(localStorage.getItem('drapp.v1')).entries).length, pays:Object.keys(JSON.parse(localStorage.getItem('drapp.v1')).payouts).length, xp: JSON.parse(localStorage.getItem('drapp.v1')).game && JSON.parse(localStorage.getItem('drapp.v1')).game.xp})");
console.log("2nd device after login:", afterLogin, "(기대: entries 37, pays 1, xp 104)");
await ev("location.hash='#home'"); await sleep(900); await shot("08-home-after", true);
const state = await ev("JSON.stringify({entries:Object.keys(JSON.parse(localStorage.getItem('drapp.v1')).entries).length, game: JSON.parse(localStorage.getItem('drapp.v1')).game})");
console.log("state:", state);
console.log("logs:", logs.slice(0, 20));
console.log(errors.length ? "ERRORS:\n" + errors.join("\n") : "no errors");
ws.close(); chrome.kill(); server.close();
process.exit(errors.length ? 1 : 0);
