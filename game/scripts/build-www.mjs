import fs from "node:fs"; import path from "node:path";
const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
fs.writeFileSync(path.join(ROOT, "www/version.js"), `window.APP_VERSION = ${JSON.stringify(pkg.version)};\nwindow.APP_BUILD = ${JSON.stringify(process.env.GITHUB_RUN_NUMBER || "")};\n`);
const vend = path.join(ROOT, "www/vendor"); fs.mkdirSync(path.join(vend, "cap"), { recursive: true });
const three = path.join(ROOT, "node_modules/three/build/three.module.js");
if (!fs.existsSync(three)) { console.error("three.module.js 없음 — npm install 필요"); process.exit(1); }
fs.copyFileSync(three, path.join(vend, "three.module.js"));
const core = path.join(ROOT, "node_modules/@capacitor/core/dist/index.js"); if (fs.existsSync(core)) fs.copyFileSync(core, path.join(vend, "cap/core.js"));
for (const n of ["app", "browser"]) { const esm = path.join(ROOT, "node_modules/@capacitor", n, "dist/esm"); if (fs.existsSync(esm)) fs.cpSync(esm, path.join(vend, "cap", n), { recursive: true }); }
console.log("버전", pkg.version, "three 복사 완료");
