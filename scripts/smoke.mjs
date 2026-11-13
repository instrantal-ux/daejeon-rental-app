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
const server = http.createServer((req, res) => {
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
await ev("location.hash='#home'"); await sleep(400); await shot("08-home-after", true);
const state = await ev("JSON.stringify({entries:Object.keys(JSON.parse(localStorage.getItem('drapp.v1')).entries).length, game: JSON.parse(localStorage.getItem('drapp.v1')).game})");
console.log("state:", state);
console.log("logs:", logs.slice(0, 20));
console.log(errors.length ? "ERRORS:\n" + errors.join("\n") : "no errors");
ws.close(); chrome.kill(); server.close();
process.exit(errors.length ? 1 : 0);
