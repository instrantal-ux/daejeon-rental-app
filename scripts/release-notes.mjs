// CHANGELOG.md 맨 위 항목을 릴리스 설명으로 출력
import fs from "node:fs";
import path from "node:path";
const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
const md = fs.readFileSync(path.join(ROOT, "CHANGELOG.md"), "utf8");
const m = md.match(new RegExp("## " + pkg.version.replace(/\./g, "\\.") + "[^\\n]*\\n([\\s\\S]*?)(?=\\n## |$)"));
const body = (m ? m[1] : "").trim() || "변경 내용 없음";
process.stdout.write(body + "\n\n---\n설치: 아래 .apk 파일을 폰에서 받아 열기 → 설치. 처음이면 \"출처를 알 수 없는 앱 허용\"을 켜야 해.\n");
