// 빌드 준비: 버전 파일 쓰기 + 엑셀 라이브러리 복사
import fs from "node:fs";
import path from "node:path";
const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
const build = process.env.GITHUB_RUN_NUMBER || "";
fs.writeFileSync(path.join(ROOT, "www/version.js"), `// 자동 생성 (scripts/build-www.mjs)\nwindow.APP_VERSION = ${JSON.stringify(pkg.version)};\nwindow.APP_BUILD = ${JSON.stringify(build)};\n`);
const src = path.join(ROOT, "node_modules/xlsx/dist/xlsx.full.min.js");
fs.mkdirSync(path.join(ROOT, "www/vendor"), { recursive: true });
if (fs.existsSync(src)) { fs.copyFileSync(src, path.join(ROOT, "www/vendor/xlsx.full.min.js")); console.log("xlsx 복사 완료"); }
else console.warn("xlsx 라이브러리를 못 찾았어 (npm install 했는지 확인)");
// 캐패시터 플러그인 JS (번들러 없이 import map 으로 불러온다)
const capDir = path.join(ROOT, "www/vendor/cap");
fs.mkdirSync(capDir, { recursive: true });
const core = path.join(ROOT, "node_modules/@capacitor/core/dist/index.js");
if (fs.existsSync(core)) fs.copyFileSync(core, path.join(capDir, "core.js"));
for (const name of ["app", "browser", "filesystem", "share"]) {
  const esm = path.join(ROOT, "node_modules/@capacitor", name, "dist/esm");
  if (!fs.existsSync(esm)) { console.warn("플러그인 없음:", name); continue; }
  fs.cpSync(esm, path.join(capDir, name), { recursive: true });
}
console.log("버전", pkg.version, "빌드", build || "(없음)");
