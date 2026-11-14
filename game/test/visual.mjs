// 진짜 three.js 로 렌더해서 스크린샷 찍기 (소프트웨어 WebGL). 사용: node test/visual.mjs [world] [hour 0-24]
import { spawn } from "node:child_process";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const HERE = path.resolve(new URL(".", import.meta.url).pathname), WWW = path.join(HERE, "..", "www"), OUT = path.join(HERE, "_shots");
const WORLD = Number(process.argv[2] || 0), HOUR = Number(process.argv[3] || 11), TAG = process.argv[4] || "";
const PORT = 8767, DBG = 9335;
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".jpg": "image/jpeg", ".json": "application/json", ".hdr": "application/octet-stream" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]); if (p === "/") p = "/index.html";
  const f = path.join(WWW, p);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end("nf"); return; }
  res.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(PORT, r));
const chrome = spawn("google-chrome", ["--headless=new", "--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", `--remote-debugging-port=${DBG}`, "--window-size=1280,600", "--user-data-dir=/tmp/pw-vis-" + Date.now(), "about:blank"], { stdio: "ignore" });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let targets = null; for (let i = 0; i < 40 && !targets; i++) { await sleep(250); try { targets = await (await fetch(`http://127.0.0.1:${DBG}/json`)).json(); } catch { } }
const ws = new WebSocket(targets.find(t => t.type === "page").webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 0; const pending = new Map(), errors = [];
ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
  if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
  if (m.method === "Runtime.consoleAPICalled" && (m.params.type === "error" || m.params.type === "warning")) errors.push(m.params.type + ": " + m.params.args.map(a => a.value ?? a.description).join(" ").slice(0, 300)); };
const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send("Runtime.enable"); await send("Page.enable");
await send("Page.addScriptToEvaluateOnNewDocument", { source: `window.confirm = () => true; const of = window.fetch; window.fetch = (u, o) => String(u).includes("supabase.co") || String(u).includes("api.github.com") ? Promise.reject(new Error("offline-test")) : of(u, o); localStorage.clear();` });
const ev = async expr => { const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result.exceptionDetails) errors.push("eval: " + (r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text)); return r.result.result?.value; };
fs.mkdirSync(OUT, { recursive: true });
const shot = async name => { const r = await send("Page.captureScreenshot", { format: "png" }); fs.writeFileSync(path.join(OUT, name + ".png"), Buffer.from(r.result.data, "base64")); console.log("📷", name); };

await send("Page.navigate", { url: `http://127.0.0.1:${PORT}/index.html` }); await sleep(1200);
await ev("document.getElementById('nickInput').value='석재'; document.getElementById('startBtn').click(); 'ok'");
await ev("window.__game.ready"); await sleep(400);
// 세계·시간 맞추기
if (WORLD) await ev(`__game.loadWorld(${WORLD}, true); 'ok'`);
await ev(`__game.dayT = ${HOUR / 24}; __game.camDist = 7; __game.camYaw = 0.35; 'ok'`);
await sleep(3500);   // HDRI·텍스처 로드 + 몇 프레임
console.log("env:", await ev("!!__game.env"), "shadow:", await ev("JSON.stringify({en:__game.renderer.shadowMap.enabled, cast:__game.sun.castShadow, map:!!__game.sun.shadow.map, far:__game.sun.shadow.camera.far, ter:__game.world.terrain.receiveShadow})"));
await ev("document.getElementById('hud').style.visibility='hidden'; 'ok'"); await sleep(300);
await shot(`w${WORLD}-h${HOUR}${TAG}-far`);
await ev("__game.camDist = 3.2; __game.camPitch = 0.18; 'ok'"); await sleep(900);
await shot(`w${WORLD}-h${HOUR}${TAG}-char`);
await ev("__game.camYaw = Math.PI; 'ok'"); await sleep(900);
await shot(`w${WORLD}-h${HOUR}${TAG}-face`);
if (errors.length) console.log("ERRORS:\n" + [...new Set(errors)].join("\n"));
chrome.kill(); server.close(); process.exit(0);
