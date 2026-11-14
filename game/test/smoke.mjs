// 포탈 월드 로직 스모크 테스트 — three.js 를 가짜 모듈로 바꿔 헤드리스 크롬에서 게임 흐름을 돌려본다
import { spawn } from "node:child_process";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const HERE = path.resolve(new URL(".", import.meta.url).pathname), WWW = path.join(HERE, "..", "www");
const PORT = 8766, DBG = 9334;
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".png": "image/png" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]); if (p === "/") p = "/index.html";
  let f = path.join(WWW, p);
  if (p === "/vendor/three.module.js") f = path.join(HERE, "three-stub.js");
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end("nf"); return; }
  res.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(PORT, r));
const chrome = spawn("google-chrome", ["--headless=new", "--no-sandbox", "--disable-gpu", `--remote-debugging-port=${DBG}`, "--window-size=900,420", "--user-data-dir=/tmp/pw-smoke-" + Date.now(), "about:blank"], { stdio: "ignore" });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let targets = null; for (let i = 0; i < 40 && !targets; i++) { await sleep(250); try { targets = await (await fetch(`http://127.0.0.1:${DBG}/json`)).json(); } catch { } }
const ws = new WebSocket(targets.find(t => t.type === "page").webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 0; const pending = new Map(), errors = [], logs = [];
ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
  if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
  if (m.method === "Runtime.consoleAPICalled") { const t = m.params.args.map(a => a.value ?? a.description).join(" "); logs.push(m.params.type + ": " + t); if (m.params.type === "error") errors.push(t); }
  if (m.method === "Log.entryAdded" && m.params.entry.level === "error") errors.push("[" + m.params.entry.source + "] " + m.params.entry.text + " " + (m.params.entry.url || "")); };
const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send("Runtime.enable"); await send("Log.enable"); await send("Page.enable");
await send("Page.addScriptToEvaluateOnNewDocument", { source: `window.confirm = () => true; window.prompt = () => "테스터"; const of = window.fetch; window.fetch = (u, o) => String(u).includes("supabase.co") || String(u).includes("api.github.com") ? Promise.reject(new Error("offline-test")) : of(u, o);` });
const ev = async expr => { const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result.exceptionDetails) errors.push("eval: " + (r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text)); return r.result.result?.value; };
const shot = async name => { const r = await send("Page.captureScreenshot", { format: "png" }); fs.mkdirSync(path.join(HERE, "_out"), { recursive: true }); fs.writeFileSync(path.join(HERE, "_out", name + ".png"), Buffer.from(r.result.data, "base64")); };

await send("Page.navigate", { url: `http://127.0.0.1:${PORT}/index.html` }); await sleep(900);
await shot("01-title");
await ev("document.getElementById('nickInput').value='석재'; document.getElementById('startBtn').click(); 'ok'"); await ev("window.__game.ready"); await sleep(1500);
console.log("world props:", await ev("window.__game.world.props.length"), "frames:", await ev("window.__game.renderer.frames"));
await shot("02-hud");
// 앞으로 달리기 2초
await ev("window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyW'})); 'ok'"); await sleep(1500);
await ev("window.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyW'})); 'ok'");
console.log("after run:", await ev("JSON.stringify({pos:[Math.round(__game.player.pos.x),Math.round(__game.player.pos.y),Math.round(__game.player.pos.z)], dist:Math.round(__game.state.stats.distance)})"));
// 덤불 옆으로 순간이동해서 채집
const gather = async type => {
  await ev(`(() => { const g=__game; const t=g.world.byType['${type}'].find(p=>p.alive); g.player.pos.set(t.x+1.2, t.y, t.z); g.input.actHeld=true; return t.type; })()`);
  await sleep(2600);
  await ev("__game.input.actHeld=false; 'ok'");
  return ev("JSON.stringify(__game.state.inv)");
};
console.log("bush:", await gather("bush"));
console.log("tree x3:", await gather("tree"), await gather("tree"), await gather("tree"));
console.log("rock x2:", await gather("rock"), await gather("rock"));
console.log("score:", await ev("__game.state.score"), "target:", await ev("document.getElementById('targetTxt').textContent"));
// 광맥은 곡괭이 없이는 안 됨
console.log("ore w/o pick:", await gather("ore"));
// 도끼 제작 → 장착 → 나무가 빨라지는지
await ev("__game.hud.togglePanel('craft'); 'ok'"); await shot("03-craft");
console.log("craft axe:", await ev("(() => { const I=window.__I; return 'skip'; })()"));
await ev(`(() => { const g=__game; const btns=[...document.querySelectorAll('#panelBody .recipe button')]; const b=btns[0]; if(!b.disabled) b.click(); return g.state.tool; })()`).then(v => console.log("tool after craft:", v));
await ev("__game.hud.togglePanel(null); 'ok'");
// 치트로 재료 주고 모닥불·오두막·포탈 설치
await ev("Object.assign(__game.state.inv,{wood:80,stone:80,fiber:10,berry:20,ore:12,crystal:2}); 'ok'");
await ev("__game.hud.togglePanel('craft'); 'ok'");
for (const i of [2, 3, 4, 5, 5, 5, 5, 6]) await ev(`(() => { const b=[...document.querySelectorAll('#panelBody .recipe button')][${i}]; if(b && !b.disabled) b.click(); return 'ok'; })()`);
console.log("inv after crafts:", await ev("JSON.stringify(__game.state.inv)"));
await ev("__game.hud.togglePanel('build'); 'ok'"); await shot("04-build");
await ev("__game.placeItem('campfire'); __game.player.pos.x += 6; __game.placeItem('hut'); __game.player.pos.x += 6; __game.placeItem('portal'); 'ok'");
console.log("placed:", await ev("JSON.stringify(__game.world.placed.map(p=>p.kind))"), "world:", await ev("__game.state.world"));
// 포탈로 걸어 들어가기
await ev("(() => { const p=__game.world.placed.find(q=>q.kind==='portal'); __game.player.pos.set(p.x, __game.player.pos.y, p.z); return 'ok'; })()");
await sleep(1800);
console.log("after portal → world:", await ev("__game.state.world"), "unlocked:", await ev("JSON.stringify(__game.state.unlocked)"), "placed in new world:", await ev("JSON.stringify(__game.world.placed.map(p=>p.kind))"), "score:", await ev("__game.state.score"));
await shot("05-world2");
// 저장 → 새로고침 → 이어하기
await ev("__game.save(); 'ok'"); await send("Page.reload"); await sleep(900);
console.log("title info:", await ev("document.getElementById('titleInfo').textContent"));
await ev("document.getElementById('startBtn').click(); 'ok'"); await sleep(1200);
console.log("resumed world:", await ev("__game.state.world"), "score:", await ev("__game.state.score"), "inv keys:", await ev("Object.keys(__game.state.inv).length"));
// 낮밤 빨리 돌리기
await ev("__game.dayT = 0.0; 'ok'"); await sleep(300); console.log("night bg:", await ev("JSON.stringify(__game.scene.background)"));
await ev("__game.hud.togglePanel('rank'); 'ok'"); await sleep(400); await shot("06-rank");
await ev("__game.hud.togglePanel('acct'); 'ok'"); await sleep(200); await shot("07-acct");
console.log("logs:", logs.filter(l => !/offline-test/.test(l)).slice(0, 10));
console.log(errors.length ? "ERRORS:\n" + errors.join("\n") : "no errors");
ws.close(); chrome.kill(); server.close(); process.exit(errors.length ? 1 : 0);
